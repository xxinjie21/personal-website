<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as THREE from 'three'
import TWEEN from '@tweenjs/tween.js'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  activeTags: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  layoutMode: { type: String, default: 'ring' }, // ring | force
})

const emit = defineEmits(['select', 'hover'])

const container = ref(null)
let renderer, scene, camera, rafId, resizeObs
let sprites = []
let edgeLines = null
let raycaster, pointerNDC
const disposables = []

// 相机交互状态
const orbit = { azimuth: 0, polar: Math.PI / 2, distance: 30, tAzimuth: 0, tPolar: Math.PI / 2, tDistance: 30 }
const pointers = new Map()
let pinchStart = 0
let dragMoved = 0

const STATUS_COLORS = {
  'not-started': '#8a8f98',
  learning: '#e0a83d',
  mastered: '#57a869',
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function statusColor(status) {
  const map = {
    'not-started': '--status-not-started',
    learning: '--status-learning',
    mastered: '--status-mastered',
  }
  return cssVar(map[status], STATUS_COLORS[status])
}

function isVisible(node) {
  if (!props.activeTags.length) return true
  return node.tags.some((t) => props.activeTags.includes(t))
}

function neighborIds(id) {
  const n = props.nodes.find((x) => x.id === id)
  return n ? n.neighbors : new Set()
}

// ---------- 布局 ----------
function ringRadius(n) {
  return Math.max(6, Math.sqrt(n) * 1.5)
}

function ringLayout(nodes) {
  const pos = new Map()
  const R = ringRadius(nodes.length)
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2
    pos.set(n.id, new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0))
  })
  return pos
}

function forceLayout(nodes, edges) {
  const pos = ringLayout(nodes)
  const idList = nodes.map((n) => n.id)
  const kRepel = 120 / Math.max(1, nodes.length)
  const kSpring = 0.04
  const rest = 6
  for (let iter = 0; iter < 260; iter++) {
    const disp = new Map(idList.map((id) => [id, new THREE.Vector3()]))
    for (let i = 0; i < idList.length; i++) {
      for (let j = i + 1; j < idList.length; j++) {
        const a = pos.get(idList[i])
        const b = pos.get(idList[j])
        const d = a.distanceTo(b) || 0.01
        const f = kRepel / (d * d)
        const dir = a.clone().sub(b).normalize().multiplyScalar(f)
        disp.get(idList[i]).add(dir)
        disp.get(idList[j]).sub(dir)
      }
    }
    for (const e of edges) {
      const a = pos.get(e.source)
      const b = pos.get(e.target)
      const d = a.distanceTo(b) || 0.01
      const f = (d - rest) * kSpring
      const dir = b.clone().sub(a).normalize().multiplyScalar(f)
      disp.get(e.source).sub(dir)
      disp.get(e.target).add(dir)
    }
    for (const id of idList) {
      const p = pos.get(id)
      p.add(disp.get(id))
      p.multiplyScalar(0.985) // 向中心收敛
      p.z = 0
    }
  }
  // 归一化到目标半径，避免力导向把节点推到视野外
  const R = ringRadius(nodes.length)
  for (const id of idList) {
    const p = pos.get(id)
    if (p.length() > R) p.setLength(R)
  }
  return pos
}

// ---------- 贴图 ----------
function makeNodeTexture(node) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  const color = statusColor(node.status)
  ctx.beginPath()
  ctx.arc(64, 52, 30, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.stroke()
  ctx.fillStyle = '#dcdee2'
  ctx.font = '20px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const label = node.title.length > 8 ? node.title.slice(0, 8) + '…' : node.title
  ctx.fillText(label, 64, 96)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---------- 场景构建 ----------
function clearScene() {
  if (!scene) return
  for (const s of sprites) {
    scene.remove(s)
    s.material.map?.dispose()
    s.material.dispose()
  }
  sprites = []
  if (edgeLines) {
    scene.remove(edgeLines)
    edgeLines.geometry.dispose()
    edgeLines.material.dispose()
    edgeLines = null
  }
}

function buildScene() {
  clearScene()
  const nodes = props.nodes
  if (!nodes.length) return

  // 相机距离随节点数自适应
  const dist = THREE.MathUtils.clamp(16 + Math.sqrt(nodes.length) * 2.0, 22, 60)
  orbit.distance = orbit.tDistance = dist
  const spriteScale = THREE.MathUtils.clamp(3.2 - nodes.length * 0.006, 1.3, 3.2)

  const pos = props.layoutMode === 'force' ? forceLayout(nodes, props.edges) : ringLayout(nodes)

  // 节点精灵
  for (const node of nodes) {
    const tex = makeNodeTexture(node)
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    const sprite = new THREE.Sprite(mat)
    const p = pos.get(node.id)
    sprite.position.copy(p)
    sprite.scale.set(spriteScale, spriteScale * 1.25, 1)
    sprite.userData = { id: node.id, base: new THREE.Vector3(spriteScale, spriteScale * 1.25, 1) }
    sprite.visible = isVisible(node)
    scene.add(sprite)
    sprites.push(sprite)
    disposables.push(tex)
  }

  // 边
  const edgeColor = new THREE.Color(cssVar('--edge-color', '#4a5568'))
  const pts = []
  for (const e of props.edges) {
    const a = pos.get(e.source)
    const b = pos.get(e.target)
    if (!a || !b) continue
    pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }
  if (pts.length) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const mat = new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.5 })
    edgeLines = new THREE.LineSegments(geo, mat)
    scene.add(edgeLines)
    disposables.push(geo, mat)
  }

  applyHighlight()
  // 入场：依次浮现（缩放从 0.01 过渡到基准尺寸）
  sprites.forEach((s, i) => {
    new TWEEN.Tween(s.scale)
      .to({ x: s.userData.base.x, y: s.userData.base.y }, 500)
      .delay(i * 20)
      .easing(TWEEN.Easing.Back.Out)
      .start()
  })
}

function applyHighlight() {
  const activeId = props.selectedId
  const neigh = activeId ? neighborIds(activeId) : new Set()
  for (const s of sprites) {
    const id = s.userData.id
    const isActive = id === activeId
    const isNeighbor = neigh.has(id)
    if (!activeId) {
      s.material.opacity = 1
    } else if (isActive || isNeighbor) {
      s.material.opacity = 1
    } else {
      s.material.opacity = 0.18
    }
  }
}

// ---------- 交互 ----------
function onPointerDown(e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  dragMoved = 0
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
  }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) {
    handleHover(e)
    return
  }
  const prev = pointers.get(e.pointerId)
  const dx = e.clientX - prev.x
  const dy = e.clientY - prev.y
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  dragMoved += Math.abs(dx) + Math.abs(dy)

  if (pointers.size === 1) {
    orbit.tAzimuth -= dx * 0.005
    orbit.tPolar = THREE.MathUtils.clamp(orbit.tPolar - dy * 0.005, 0.2, Math.PI - 0.2)
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    if (pinchStart > 0) {
      orbit.tDistance = THREE.MathUtils.clamp(orbit.tDistance * (pinchStart / d), 10, 60)
    }
    pinchStart = d
  }
}

function onPointerUp(e) {
  const wasClick = dragMoved < 6
  pointers.delete(e.pointerId)
  if (wasClick) handleClick(e)
}

function onWheel(e) {
  orbit.tDistance = THREE.MathUtils.clamp(orbit.tDistance + e.deltaY * 0.03, 10, 60)
}

function updateNDC(e) {
  const rect = container.value.getBoundingClientRect()
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
}

function pickSprite(e) {
  updateNDC(e)
  raycaster.setFromCamera(pointerNDC, camera)
  const hits = raycaster.intersectObjects(sprites)
  return hits.length ? hits[0].object.userData.id : null
}

function handleHover(e) {
  const id = pickSprite(e)
  if (id) {
    const node = props.nodes.find((n) => n.id === id)
    emit('hover', node || null)
    container.value.style.cursor = 'pointer'
  } else {
    emit('hover', null)
    container.value.style.cursor = 'grab'
  }
}

function handleClick(e) {
  const id = pickSprite(e)
  if (id) {
    const node = props.nodes.find((n) => n.id === id)
    emit('select', node || null)
  }
}

// ---------- 主循环 ----------
function animate() {
  rafId = requestAnimationFrame(animate)
  TWEEN.update()
  orbit.azimuth += (orbit.tAzimuth - orbit.azimuth) * 0.1
  orbit.polar += (orbit.tPolar - orbit.polar) * 0.1
  orbit.distance += (orbit.tDistance - orbit.distance) * 0.1
  camera.position.set(
    orbit.distance * Math.sin(orbit.polar) * Math.sin(orbit.azimuth),
    orbit.distance * Math.cos(orbit.polar),
    orbit.distance * Math.sin(orbit.polar) * Math.cos(orbit.azimuth)
  )
  camera.lookAt(0, 0, 0)
  renderer.render(scene, camera)
}

function init() {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)
  raycaster = new THREE.Raycaster()
  pointerNDC = new THREE.Vector2()

  resizeObs = new ResizeObserver(resize)
  resizeObs.observe(container.value)
  resize()

  const el = renderer.domElement
  el.style.touchAction = 'none'
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointerleave', onPointerUp)
  el.addEventListener('wheel', onWheel, { passive: true })

  buildScene()
  animate()
}

function resize() {
  if (!renderer || !container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

watch(
  () => [props.nodes, props.edges, props.activeTags, props.layoutMode],
  () => buildScene(),
  { deep: true }
)
watch(() => props.selectedId, () => applyHighlight())

onMounted(init)

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  resizeObs?.disconnect()
  const el = renderer?.domElement
  if (el) {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointerleave', onPointerUp)
    el.removeEventListener('wheel', onWheel)
  }
  disposables.forEach((d) => d?.dispose?.())
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div ref="container" class="graph-canvas"></div>
</template>

<style scoped>
.graph-canvas {
  width: 100%;
  height: 100%;
  min-height: 480px;
}
</style>
