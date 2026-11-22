<script setup>
// 动态雕塑：150 片方块沿螺旋线流动，暖橙到奶白的渐变（Mini 3D hero 的 ribbon 思路）
import * as THREE from 'three'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const el = ref(null)

let renderer, scene, camera, raf, obs, group, inst
let clock
const pointer = { x: 0, y: 0 }
const COUNT = 150
// 颜色沿 ribbon 流动：起点暖橙、尾部奶白
const WARM = new THREE.Color('#d9521b')
const CREAM = new THREE.Color('#ffe3cd')
const TINT = new THREE.Color()

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128)
  g.addColorStop(0, 'rgba(230, 130, 70, 0.35)')
  g.addColorStop(0.45, 'rgba(217, 87, 26, 0.1)')
  g.addColorStop(1, 'rgba(217, 87, 26, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function build() {
  if (!el.value) return
  const w = el.value.clientWidth || 1
  const h = el.value.clientHeight || 1

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 160)
  camera.position.set(0, 0, 26)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  // 手机 / 平板 GPU 弱一些：像素比封到 1.5，避免满血 2x 掉帧
  const isSmall = w < 900
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2))
  renderer.setSize(w, h, false)
  renderer.setClearColor(0x000000, 0)
  el.value.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0xfff0e0, 0.9))
  const key = new THREE.DirectionalLight(0xffc79a, 1.9)
  key.position.set(7, 9, 12)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xff8a4a, 0.85)
  fill.position.set(-9, -5, 7)
  scene.add(fill)
  const rim = new THREE.DirectionalLight(0xfffaf2, 1.3)
  rim.position.set(0, -7, -9)
  scene.add(rim)

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  glow.scale.set(22, 22, 1)
  glow.position.set(7.5, 0, -6)
  scene.add(glow)

  group = new THREE.Group()
  group.position.set(6.6, 0, 0)
  group.scale.setScalar(1.45)
  scene.add(group)

  const geo = new THREE.BoxGeometry(2.4, 0.18, 2.4)
  const mat = new THREE.MeshStandardMaterial({
    metalness: 0.28,
    roughness: 0.4,
    emissive: new THREE.Color('#3a1c11'),
    emissiveIntensity: 0.35,
  })
  inst = new THREE.InstancedMesh(geo, mat, COUNT)
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  for (let i = 0; i < COUNT; i++) {
    inst.setColorAt(i, WARM)
  }
  inst.instanceColor.needsUpdate = true
  group.add(inst)

  clock = new THREE.Clock()
  animate()
}

const dummy = new THREE.Object3D()
const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()

function ribbonPoint(t, out) {
  const coils = 2
  const radius = 3.6
  const angle = t * Math.PI * 2 * coils
  out.set(Math.sin(angle) * radius, (0.5 - t) * 12, Math.cos(angle) * radius)
  return out
}

function animate() {
  raf = requestAnimationFrame(animate)
  const time = clock.getElapsedTime()

  // 缓动跟随鼠标
  group.rotation.y += (Math.sin(time * 0.16) * 0.22 + pointer.x * 0.35 - group.rotation.y) * 0.06
  group.rotation.x += (-pointer.y * 0.18 + Math.sin(time * 0.22) * 0.08 - group.rotation.x) * 0.06

  for (let i = 0; i < COUNT; i++) {
    const t = (i / COUNT + time * 0.0028) % 1
    ribbonPoint(t, tmpA)
    ribbonPoint(Math.min(0.999, t + 0.002), tmpB)
    dummy.position.copy(tmpA)
    dummy.lookAt(tmpB)
    dummy.rotateX(Math.PI / 2)
    dummy.rotateY(t * Math.PI * 4 - time * 0.004)

    // 首尾各 18% 缩到 0，形成无缝循环
    const edge = Math.min(1, Math.min(t, 1 - t) / 0.18)
    const scale = Math.max(0.001, edge * edge)
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    inst.setMatrixAt(i, dummy.matrix)

    // 颜色跟着 t 走，形成沿雕塑流动的渐变
    TINT.copy(WARM).lerp(CREAM, t * 0.9)
    inst.setColorAt(i, TINT)
  }
  inst.instanceColor.needsUpdate = true
  inst.instanceMatrix.needsUpdate = true

  renderer.render(scene, camera)
}

function resize() {
  if (!renderer || !el.value) return
  const w = el.value.clientWidth || 1
  const h = el.value.clientHeight || 1
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}

function onPointer(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1
}

onMounted(() => {
  build()
  obs = new ResizeObserver(resize)
  obs.observe(el.value)
  window.addEventListener('pointermove', onPointer, { passive: true })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  obs?.disconnect()
  window.removeEventListener('pointermove', onPointer)
  inst?.geometry?.dispose()
  inst?.material?.dispose()
  renderer?.dispose()
  renderer?.domElement?.remove()
})
</script>

<template>
  <div ref="el" class="ribbon-scene" aria-hidden="true"></div>
</template>

<style scoped>
.ribbon-scene {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.ribbon-scene canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
