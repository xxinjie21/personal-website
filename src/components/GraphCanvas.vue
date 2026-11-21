<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  activeTags: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  layoutMode: { type: String, default: 'cluster' }, // cluster | force(螺旋)
})

const emit = defineEmits(['select'])

const container = ref(null)
const hoverNode = ref(null)
const tip = ref({ x: 0, y: 0 })

let renderer, scene, camera, raf, resizeObs, clock
let nodePoints = null, nodeGeo = null
let edgeLines = null, pulsePoints = null, pulseGeo = null
let starPoints = null, glowSprite = null, ringSprite = null
let labelSprites = []
let arrowGroup = null
let raycaster, pointerNDC, uniforms
let positions = [], indexById = new Map(), curves = [], pulses = []
let hoverIdx = -1
let dragging = false, dragMoved = 0
let pointers = new Map(), pinchStart = 0
let lastInteract = 0

const orbit = { az: 0.35, polar: 1.25, dist: 47, tAz: 0.35, tPolar: 1.25, tDist: 47 }
let fitDist = 47
let userZoomed = false
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const STATUS_COLOR = {
  'not-started': new THREE.Color('#8a6a57'),
  learning: new THREE.Color('#ff9e3d'),
  mastered: new THREE.Color('#ff5e2c'),
}

// ---------- 工具 ----------
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 99991
  return h / 99991
}
function folderOf(n) {
  return (n.rel || '').split('/')[0] || 'root'
}
function nodeColor(status) {
  return STATUS_COLOR[status] || STATUS_COLOR['not-started']
}

// ---------- 布局 ----------
// 星群：按顶层文件夹分成三个星系，群内用向日葵螺旋铺开
function clusterLayout(nodes) {
  const groups = new Map()
  for (const n of nodes) {
    const g = folderOf(n)
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g).push(n)
  }
  const names = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length)
  const pos = new Map()
  const labels = []
  const RC = 17.5
  names.forEach((g, gi) => {
    const ang = (gi / names.length) * Math.PI * 2 + Math.PI / 2
    const center = new THREE.Vector3(Math.cos(ang) * RC, Math.sin(ang) * RC * 0.55, 0)
    const list = groups.get(g).slice().sort((a, b) => b.neighbors.size - a.neighbors.size)
    const count = list.length
    const rg = Math.min(9.4, 3.6 + Math.sqrt(count) * 0.55)
    list.forEach((n, i) => {
      const r = rg * Math.sqrt((i + 0.5) / count)
      const th = i * 2.39996 + gi * 0.9
      const jx = (hashStr(n.id + 'jx') - 0.5) * rg * 0.16
      const jy = (hashStr(n.id + 'jy') - 0.5) * rg * 0.16
      pos.set(
        n.id,
        new THREE.Vector3(
          center.x + Math.cos(th) * r + jx,
          center.y + Math.sin(th) * r * 0.8 + jy,
          (hashStr(n.id) - 0.5) * 5
        )
      )
    })
    labels.push({
      text: g,
      count,
      pos: center.clone().add(new THREE.Vector3(0, -(rg * 0.8 + 4.0), -1.6)),
    })
  })
  return { pos, labels }
}

// 螺旋：单臂银河，按连接数从内到外排
function spiralLayout(nodes) {
  const pos = new Map()
  const list = nodes.slice().sort((a, b) => b.neighbors.size - a.neighbors.size)
  const total = list.length || 1
  list.forEach((n, i) => {
    const t = (i + 0.5) / total
    const ang = t * Math.PI * 7.4 + 0.4
    const r = 3.4 + t * 16.4
    pos.set(n.id, new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r, Math.sin(t * 10) * 2.6))
  })
  return { pos, labels: [] }
}

// 连线弧
function arcPoints(a, b) {
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const len = a.distanceTo(b)
  const out = mid.length() > 0.01 ? mid.clone().normalize() : new THREE.Vector3(0, 1, 0)
  mid.add(out.multiplyScalar(len * 0.16))
  mid.z += len * 0.12 + 0.4
  return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone()).getPoints(10)
}

// ---------- 贴图 ----------
function dotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,225,190,1)')
  g.addColorStop(0.4, 'rgba(255,150,80,0.75)')
  g.addColorStop(1, 'rgba(255,120,50,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function labelTexture(text, count) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const ctx = c.getContext('2d')
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255, 205, 170, 0.85)'
  ctx.font = '600 56px "Noto Serif SC", "Songti SC", serif'
  ctx.fillText(text, 256, 76)
  ctx.fillStyle = 'rgba(255, 176, 120, 0.5)'
  ctx.font = '400 24px "JetBrains Mono", monospace'
  ctx.fillText(`${String(count).padStart(3, '0')} NOTES`, 256, 122)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function nodeLabelTexture(text) {
  const c = document.createElement('canvas')
  const pad = 24
  const fs = 34
  const ctx0 = c.getContext('2d')
  ctx0.font = `500 ${fs}px "Noto Sans SC", "PingFang SC", sans-serif`
  const trimmed = text.length > 12 ? text.slice(0, 12) + '…' : text
  const w = Math.ceil(ctx0.measureText(trimmed).width) + pad * 2
  c.width = Math.max(80, w)
  c.height = 64
  const ctx = c.getContext('2d')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255, 231, 212, 0.92)'
  ctx.font = `500 ${fs}px "Noto Sans SC", "PingFang SC", sans-serif`
  ctx.fillText(trimmed, c.width / 2, 33)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return { tex: t, aspect: c.width / c.height, text: trimmed }
}

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(255, 140, 70, 0.55)')
  g.addColorStop(0.35, 'rgba(255, 110, 45, 0.18)')
  g.addColorStop(1, 'rgba(255, 90, 30, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function ringTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.strokeStyle = 'rgba(255, 214, 180, 0.55)'
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.arc(128, 128, 100, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 170, 110, 0.95)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(128, 128, 100, 0, Math.PI * 2)
  ctx.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ---------- 着色器 ----------
const VERT = `
attribute float aSize;
attribute vec3 aColor;
attribute float aSeed;
attribute float aGlow;
uniform float uTime;
uniform float uPx;
varying vec3 vColor;
varying float vGlow;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vColor = aColor;
  vGlow = aGlow;
  float pulse = 0.9 + 0.1 * sin(uTime * 1.2 + aSeed * 6.2832);
  gl_PointSize = aSize * uPx * pulse / max(0.001, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = `
varying vec3 vColor;
varying float vGlow;

void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float d = length(p);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.16, d);
  float halo = smoothstep(0.5, 0.34, d) * 0.34;
  float alpha = (pow(core, 2.1) * 0.86 + halo) * vGlow;
  vec3 col = vColor * (0.95 + core * 0.85);
  gl_FragColor = vec4(col, alpha);
}
`

// ---------- 场景 ----------
function clearScene() {
  if (!scene) return
  const kill = (obj) => {
    if (!obj) return
    scene.remove(obj)
    obj.geometry?.dispose?.()
    obj.material?.map?.dispose?.()
    obj.material?.dispose?.()
  }
  kill(nodePoints)
  kill(edgeLines)
  kill(pulsePoints)
  kill(starPoints)
  kill(glowSprite)
  kill(ringSprite)
  if (arrowGroup) {
    arrowGroup.children.forEach(kill)
    scene.remove(arrowGroup)
    arrowGroup = null
  }
  labelSprites.forEach(kill)
  nodePoints = null
  nodeGeo = null
  edgeLines = null
  pulsePoints = null
  pulseGeo = null
  starPoints = null
  glowSprite = null
  ringSprite = null
  labelSprites = []
  curves = []
  pulses = []
}

function calcPixelScale() {
  if (!container.value || !camera) return 1
  const h = container.value.clientHeight || 600
  const fov = (camera.fov * Math.PI) / 180
  return (h / 2) / Math.tan(fov / 2) * Math.min(window.devicePixelRatio, 2)
}

function buildScene() {
  clearScene()
  if (!props.nodes.length) {
    hoverNode.value = null
    hoverIdx = -1
    return
  }

  const { pos, labels } = props.layoutMode === 'force' ? spiralLayout(props.nodes) : clusterLayout(props.nodes)

  const N = props.nodes.length
  // 节点配色跟随文件夹（与左上环形图一致），状态色只留给详情卡
  const folderOrder = [...new Set(props.nodes.map(folderOf))]
    .sort(
      (a, b) =>
        props.nodes.filter((n) => folderOf(n) === b).length -
        props.nodes.filter((n) => folderOf(n) === a).length
    )
  const PALETTE = ['#ff7a2f', '#ffb067', '#ffd7b8', '#cf8a63']
  const folderColorOf = new Map(
    folderOrder.map((f, i) => [f, new THREE.Color(PALETTE[i % PALETTE.length])])
  )

  const arrPos = new Float32Array(N * 3)
  const arrCol = new Float32Array(N * 3)
  const arrSize = new Float32Array(N)
  const arrSeed = new Float32Array(N)
  const arrGlow = new Float32Array(N).fill(1)

  positions = []
  indexById = new Map()
  const colors = []

  props.nodes.forEach((n, i) => {
    indexById.set(n.id, i)
    const p = pos.get(n.id) || new THREE.Vector3()
    positions.push(p)
    arrPos[i * 3] = p.x
    arrPos[i * 3 + 1] = p.y
    arrPos[i * 3 + 2] = p.z
    const c = (folderColorOf.get(folderOf(n)) || nodeColor(n.status)).clone()
      .lerp(new THREE.Color(0xffe6cf), hashStr(n.id + 'cl') * 0.34)
      .multiplyScalar(0.84 + hashStr(n.id + 'cb') * 0.3)
    colors.push(c)
    arrCol[i * 3] = c.r
    arrCol[i * 3 + 1] = c.g
    arrCol[i * 3 + 2] = c.b
    arrSize[i] = Math.min(1.5, 0.62 + Math.min(n.neighbors.size, 10) * 0.075) *
      (0.9 + hashStr(n.id + 'sz') * 0.3)
    arrSeed[i] = hashStr(n.id)
  })

  nodeGeo = new THREE.BufferGeometry()
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(arrPos, 3))
  nodeGeo.setAttribute('aColor', new THREE.BufferAttribute(arrCol, 3))
  nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(arrSize, 1))
  nodeGeo.setAttribute('aSeed', new THREE.BufferAttribute(arrSeed, 1))
  nodeGeo.setAttribute('aGlow', new THREE.BufferAttribute(arrGlow, 1))

  uniforms = { uTime: { value: 0 }, uPx: { value: calcPixelScale() } }

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  nodePoints = new THREE.Points(nodeGeo, mat)
  nodePoints.frustumCulled = false
  scene.add(nodePoints)

  // 连线
  const segPos = []
  const segCol = []
  props.edges.forEach((e) => {
    const a = pos.get(e.source)
    const b = pos.get(e.target)
    const ia = indexById.get(e.source)
    const ib = indexById.get(e.target)
    if (!a || !b || ia === undefined || ib === undefined) return
    const pts = arcPoints(a, b)
    curves.push(pts)
    const c1 = colors[ia]
    const c2 = colors[ib]
    for (let k = 0; k < pts.length - 1; k++) {
      const p1 = pts[k]
      const p2 = pts[k + 1]
      segPos.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
      const t1 = k / (pts.length - 1)
      const t2 = (k + 1) / (pts.length - 1)
      const k1 = c1.clone().lerp(c2, t1).multiplyScalar(1.5)
      const k2 = c1.clone().lerp(c2, t2).multiplyScalar(1.5)
      segCol.push(k1.r, k1.g, k1.b, k2.r, k2.g, k2.b)
    }
  })

  if (segPos.length) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(segPos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(segCol, 3))
    edgeLines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    edgeLines.frustumCulled = false
    scene.add(edgeLines)
  }

  // 方向箭头：沿弧线 62% 处放个小锥体，指明 A → B
  arrowGroup = new THREE.Group()
  const arrowGeo = new THREE.ConeGeometry(0.1, 0.32, 5)
  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0xffb377,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  curves.forEach((pts) => {
    const i0 = Math.floor(pts.length * 0.62)
    const p0 = pts[i0]
    const p1 = pts[Math.min(i0 + 1, pts.length - 1)]
    if (!p0 || !p1) return
    const dir = p1.clone().sub(p0)
    if (dir.lengthSq() < 1e-9) return
    const mesh = new THREE.Mesh(arrowGeo, arrowMat)
    mesh.position.copy(p0)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    arrowGroup.add(mesh)
  })
  scene.add(arrowGroup)

  // 沿边的流光
  const count = Math.min(26, curves.length)
  pulses = []
  const pArr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    pulses.push({ pts: curves[(i * 7) % curves.length], t: Math.random(), sp: 0.006 + Math.random() * 0.012 })
  }
  pulseGeo = new THREE.BufferGeometry()
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3))
  pulsePoints = new THREE.Points(
    pulseGeo,
    new THREE.PointsMaterial({
      color: 0xffc08a,
      size: 0.55,
      map: dotTexture(),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  pulsePoints.frustumCulled = false
  scene.add(pulsePoints)

  // 星尘
  const starPos = new Float32Array(240 * 3)
  for (let i = 0; i < 240; i++) {
    const r = 34 + Math.random() * 46
    const th = Math.random() * Math.PI * 2
    const ph = Math.acos(2 * Math.random() - 1)
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th)
    starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7
    starPos[i * 3 + 2] = r * Math.cos(ph) * 0.75
  }
  const sGeo = new THREE.BufferGeometry()
  sGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  starPoints = new THREE.Points(
    sGeo,
    new THREE.PointsMaterial({
      color: 0xffb98a,
      size: 0.3,
      map: dotTexture(),
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  scene.add(starPoints)

  // 极细的经纬线：只留两圈，压到几乎看不见，给暗场一点纹理
  for (const rr of [24, 33]) {
    const pts = []
    for (let i = 0; i <= 140; i++) {
      const a = (i / 140) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr * 0.62, -1.2))
    }
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color: 0xffa96e,
          transparent: true,
          opacity: 0.05,
          depthWrite: false,
        })
      )
    )
  }

  // 中心体积光
  glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  glowSprite.scale.set(62, 62, 1)
  glowSprite.position.set(0, 0, -14)
  scene.add(glowSprite)

  // 选中环
  ringSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: ringTexture(),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
  )
  ringSprite.renderOrder = 4
  ringSprite.visible = false
  scene.add(ringSprite)

  // 星群标签
  labels.forEach((l) => {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: labelTexture(l.text, l.count),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 0.95,
      })
    )
    sp.renderOrder = 3
    sp.position.copy(l.pos)
    sp.scale.set(10, 3.2, 1)
    scene.add(sp)
    labelSprites.push(sp)
  })

  // 节点名：度数≥3 的节点挂个小标签，让“谁连着谁”读得出来
  props.nodes.forEach((n, i) => {
    if (n.neighbors.size < 3) return
    const p = positions[i]
    if (!p) return
    const { tex, aspect } = nodeLabelTexture(n.title || n.id)
    const h = 1.1
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.8 })
    )
    sp.center.set(0, 0.5)
    sp.position.set(p.x + 0.85, p.y - 0.1, p.z)
    sp.scale.set(h * aspect, h, 1)
    sp.renderOrder = 2
    scene.add(sp)
    labelSprites.push(sp)
  })

  applyGlow()
}

function applyGlow() {
  if (!nodeGeo) return
  const attr = nodeGeo.getAttribute('aGlow')
  const sel = props.selectedId
  let neigh = null
  let selNode = null
  if (sel) {
    selNode = props.nodes.find((n) => n.id === sel)
    neigh = selNode?.neighbors || null
  }
  props.nodes.forEach((n, i) => {
    let g = 1
    if (props.activeTags.length && !(n.tags || []).some((t) => props.activeTags.includes(t))) g = 0.14
    if (selNode) {
      if (n.id === sel) g = Math.max(g, 2.1)
      else if (neigh && neigh.has(n.id)) g = Math.max(g, 1.45)
      else g = Math.min(g, 0.2)
    }
    if (!selNode && hoverIdx >= 0) {
      const hn = props.nodes[hoverIdx]
      if (i === hoverIdx) g = 1.85
      else if (hn?.neighbors.has(n.id)) g = 1.35
      else g = Math.min(g, 0.4)
    }
    attr.array[i] = g
  })
  attr.needsUpdate = true
}

// ---------- 交互 ----------
function updateNDC(e) {
  const rect = container.value.getBoundingClientRect()
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
}

function pick(e) {
  if (!nodePoints) return -1
  updateNDC(e)
  raycaster.setFromCamera(pointerNDC, camera)
  const hits = raycaster.intersectObject(nodePoints)
  return hits.length ? hits[0].index : -1
}

function setHover(idx) {
  if (idx === hoverIdx) return
  hoverIdx = idx
  hoverNode.value = idx >= 0 ? props.nodes[idx] : null
  applyGlow()
}

function onPointerDown(e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  dragging = true
  dragMoved = 0
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
  }
  lastInteract = performance.now()
  container.value.style.cursor = 'grabbing'
}

function onPointerMove(e) {
  updateNDC(e)
  lastInteract = performance.now()

  if (pointers.has(e.pointerId)) {
    const prev = pointers.get(e.pointerId)
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    dragMoved += Math.abs(dx) + Math.abs(dy)

    if (pointers.size === 1) {
      orbit.tAz -= dx * 0.006
      orbit.tPolar = THREE.MathUtils.clamp(orbit.tPolar - dy * 0.005, 0.5, Math.PI - 0.5)
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinchStart > 0) orbit.tDist = THREE.MathUtils.clamp(orbit.tDist * (pinchStart / d), 16, 96)
      pinchStart = d
    }
    setHover(-1)
    return
  }

  const idx = pick(e)
  setHover(idx)
  container.value.style.cursor = idx >= 0 ? 'pointer' : 'grab'
}

function onPointerUp(e) {
  const wasClick = dragMoved < 7
  pointers.delete(e.pointerId)
  if (pointers.size === 0) {
    dragging = false
    container.value.style.cursor = 'grab'
  }
  if (!wasClick) return
  const idx = pick(e)
  if (idx >= 0) emit('select', props.nodes[idx])
  else emit('select', null)
}

function onPointerLeave(e) {
  pointers.delete(e.pointerId)
  dragging = false
  setHover(-1)
}

function onWheel(e) {
  orbit.tDist = THREE.MathUtils.clamp(orbit.tDist + e.deltaY * 0.035, 16, 96)
  lastInteract = performance.now()
}

// ---------- 循环 ----------
function animate() {
  raf = requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime

  if (!dragging && !reduceMotion && performance.now() - lastInteract > 2400) {
    orbit.tAz += dt * 0.06
  }

  orbit.az += (orbit.tAz - orbit.az) * 0.09
  orbit.polar += (orbit.tPolar - orbit.polar) * 0.09
  orbit.dist += (orbit.tDist - orbit.dist) * 0.09

  const px = reduceMotion ? 0 : pointerNDC.x * 1.6
  const py = reduceMotion ? 0 : pointerNDC.y * 0.9

  const sp = Math.sin(orbit.polar) * orbit.dist
  camera.position.set(
    sp * Math.sin(orbit.az) + px,
    orbit.dist * Math.cos(orbit.polar) + py,
    sp * Math.cos(orbit.az)
  )
  camera.lookAt(0, 0, 0)

  if (uniforms) uniforms.uTime.value = t

  // 流光
  if (pulsePoints && pulses.length) {
    const attr = pulseGeo.getAttribute('position')
    pulses.forEach((p, i) => {
      p.t += p.sp * dt * 60
      if (p.t > 1) p.t -= 1
      const pts = p.pts
      const fi = p.t * (pts.length - 1)
      const i0 = Math.floor(fi)
      const i1 = Math.min(pts.length - 1, i0 + 1)
      const k = fi - i0
      const a = pts[i0]
      const b = pts[i1]
      attr.array[i * 3] = a.x + (b.x - a.x) * k
      attr.array[i * 3 + 1] = a.y + (b.y - a.y) * k
      attr.array[i * 3 + 2] = a.z + (b.z - a.z) * k
    })
    attr.needsUpdate = true
  }

  // 标签跟随
  if (hoverIdx >= 0 && positions[hoverIdx] && container.value) {    const v = positions[hoverIdx].clone().project(camera)
    tip.value = {
      x: (v.x * 0.5 + 0.5) * container.value.clientWidth,
      y: (-v.y * 0.5 + 0.5) * container.value.clientHeight,
    }
  }

  // 选中环脉冲
  if (ringSprite) {
    const selIdx = props.selectedId ? indexById.get(props.selectedId) : -1
    if (selIdx !== undefined && selIdx >= 0 && positions[selIdx]) {
      ringSprite.visible = true
      ringSprite.position.copy(positions[selIdx])
      const s = 5.4 + Math.sin(t * 2.4) * 0.45
      ringSprite.scale.set(s, s, 1)
      ringSprite.material.opacity = 0.5 + Math.sin(t * 2.4) * 0.14
    } else {
      ringSprite.visible = false
    }
  }

  renderer.render(scene, camera)
}

function resize() {
  if (!renderer || !container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  renderer.setSize(w, h, false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  fitDist = 47 * Math.min(2.15, Math.max(1, 980 / Math.max(w, 1)))
  if (!userZoomed) orbit.tDist = fitDist
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  if (uniforms) uniforms.uPx.value = calcPixelScale()
}

function init() {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 260)
  scene.fog = new THREE.FogExp2(0x080605, 0.006)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  container.value.appendChild(renderer.domElement)

  raycaster = new THREE.Raycaster()
  raycaster.params.Points = { threshold: 1.4 }
  pointerNDC = new THREE.Vector2(0, 0)
  clock = new THREE.Clock()

  resizeObs = new ResizeObserver(resize)
  resizeObs.observe(container.value)
  resize()

  const el = renderer.domElement
  el.style.touchAction = 'none'
  el.style.display = 'block'
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointerleave', onPointerLeave)
  el.addEventListener('wheel', onWheel, { passive: true })

  buildScene()
  animate()
}

// ---------- 对外 ----------
function zoom(delta) {
  orbit.tDist = THREE.MathUtils.clamp(orbit.tDist + delta, 16, 96)
  userZoomed = true
  lastInteract = performance.now()
}
function resetView() {
  orbit.tAz = 0.35
  orbit.tPolar = 1.25
  orbit.tDist = fitDist
  userZoomed = false
  lastInteract = performance.now()
}
defineExpose({ zoom, resetView })

watch(
  () => [props.nodes, props.edges, props.activeTags, props.layoutMode],
  () => buildScene(),
  { deep: true }
)
watch(() => props.selectedId, () => applyGlow())

onMounted(init)

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObs?.disconnect()
  const el = renderer?.domElement
  if (el) {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointerleave', onPointerLeave)
    el.removeEventListener('wheel', onWheel)
  }
  clearScene()
  renderer?.dispose()
  el?.remove()
})
</script>

<template>
  <div ref="container" class="graph-canvas">
    <div
      v-if="hoverNode"
      class="node-tip"
      :style="{ left: tip.x + 'px', top: tip.y + 'px' }"
    >
      <span class="t">{{ hoverNode.title }}</span>
      <span class="m mono">{{ hoverNode.rel.split('/')[0] }} · {{ hoverNode.neighbors.size }} links</span>
    </div>
  </div>
</template>

<style scoped>
.graph-canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.node-tip {
  position: absolute;
  z-index: 7;
  transform: translate(-50%, -130%);
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 169, 110, 0.28);
  background: rgba(18, 12, 9, 0.86);
  backdrop-filter: blur(10px);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-width: 220px;
  box-shadow: 0 12px 30px -14px rgba(0, 0, 0, 0.9);
  animation: tipIn 0.2s ease both;
}
@keyframes tipIn {
  from {
    opacity: 0;
    transform: translate(-50%, -120%);
  }
}
.node-tip .t {
  font-size: 12.5px;
  color: #ffe9da;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.node-tip .m {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: #a08b7c;
  text-transform: uppercase;
}
</style>
