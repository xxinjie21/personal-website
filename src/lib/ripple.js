/**
 * 点击涟漪：CSS 动画 + 原生 Pointer 事件，无第三方依赖。
 * hover（鼠标）与 press（触屏 / 键盘）共用一条 fixed 覆盖层，
 * 元素不改 position / overflow，不占布局、不影响滚动。
 */
const HOSTS = '[data-ripple], .btn, .btn-primary, .nav-link, .tab, .card'
const PRESS_MS = 420
const HOVER_MS = 380
const PRESS_SIZE = 200
const HOVER_SIZE = 132

let layer = null
const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
const calm = window.matchMedia('(prefers-reduced-motion: reduce)')

function ensureLayer() {
  if (layer && layer.isConnected) return layer
  layer = document.createElement('div')
  layer.className = 'ripple-layer'
  layer.setAttribute('aria-hidden', 'true')
  document.body.appendChild(layer)
  return layer
}

function spawn(x, y, size, ms, opacity) {
  if (calm.matches) return
  const root = ensureLayer()
  const wave = document.createElement('span')
  wave.className = 'ripple-wave'
  wave.style.setProperty('--x', `${x}px`)
  wave.style.setProperty('--y', `${y}px`)
  wave.style.setProperty('--d', `${size}px`)
  wave.style.setProperty('--ms', `${ms}ms`)
  wave.style.setProperty('--o', `${opacity}`)
  wave.addEventListener('animationend', () => wave.remove(), { once: true })
  root.appendChild(wave)
  // 兜底：动画被裁掉或标签页切后台时也能清掉
  setTimeout(() => wave.remove(), ms + 120)
}

function hostOf(target) {
  return target instanceof Element ? target.closest(HOSTS) : null
}

// 触屏按下、鼠标左键按下都算“点到了”；不 preventDefault，滚动照常
document.addEventListener(
  'pointerdown',
  (event) => {
    if (event.button !== 0) return
    const host = hostOf(event.target)
    if (!host) return
    spawn(event.clientX, event.clientY, PRESS_SIZE, PRESS_MS, 0.5)
  },
  { capture: true, passive: true }
)

// 桌面悬停：仅在精确指针设备上，移动到目标内部不重复触发
document.addEventListener(
  'pointerover',
  (event) => {
    if (!fine.matches || event.pointerType !== 'mouse') return
    const host = hostOf(event.target)
    if (!host || (event.relatedTarget instanceof Element && host.contains(event.relatedTarget))) return
    spawn(event.clientX, event.clientY, HOVER_SIZE, HOVER_MS, 0.34)
  },
  { passive: true }
)

// 键盘 Enter / Space 触发时没有坐标，从元素中心荡开
document.addEventListener('click', (event) => {
  if (event.detail !== 0) return
  const host = hostOf(event.target)
  if (!host) return
  const rect = host.getBoundingClientRect()
  spawn(rect.left + rect.width / 2, rect.top + rect.height / 2, HOVER_SIZE, HOVER_MS, 0.34)
})
