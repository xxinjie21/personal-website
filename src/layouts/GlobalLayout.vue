<script setup>
// 纯阅读站点：不取进度、不连 Worker
import { onBeforeUnmount, onMounted, computed, ref } from 'vue'

// 28 考研初试：2027 年 12 月下旬（占位 12-21，临近再校准）
const EXAM_DATE = new Date('2027-12-21T00:00:00+08:00')
const daysLeft = computed(() => {
  const ms = EXAM_DATE - new Date()
  return Math.max(0, Math.ceil(ms / 86400000))
})

// 数字滚动入场
const shownDays = ref(0)
onMounted(() => {
  const target = daysLeft.value
  const t0 = performance.now()
  const dur = 900
  const step = () => {
    const p = Math.min(1, (performance.now() - t0) / dur)
    const e = 1 - Math.pow(1 - p, 3)
    shownDays.value = Math.round(target * e)
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
})

// 顶栏：页面一滚就加投影，跟内容分层（阅读区内部滚动也要算，用捕获阶段接）
const lifted = ref(false)
const onScroll = () => {
  const reader = document.querySelector('.reader')
  const y = Math.max(window.scrollY || 0, reader ? reader.scrollTop : 0)
  lifted.value = y > 8
}
onMounted(() => {
  onScroll()
  document.addEventListener('scroll', onScroll, { passive: true, capture: true })
})
onBeforeUnmount(() => document.removeEventListener('scroll', onScroll, true))

const links = [
  { to: '/', label: '首页', en: 'HOME' },
  { to: '/notes', label: '笔记库', en: 'LIBRARY' },
  { to: '/custom-pages', label: '自定义页', en: 'PAGES' },
]

// 点击品牌：文字补扫一次光；已在首页时顺手回顶部（给一个“到站了”的反馈）
const sweeping = ref(false)
let sweepTimer = null
const onBrandClick = () => {
  sweeping.value = false
  requestAnimationFrame(() => {
    sweeping.value = true
    clearTimeout(sweepTimer)
    sweepTimer = setTimeout(() => (sweeping.value = false), 1200)
  })
  if (window.location.pathname === '/') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <header class="topbar" :class="{ lift: lifted }">
    <router-link
      to="/"
      class="brand"
      :class="{ sweeping: sweeping }"
      title="回首页"
      @click="onBrandClick"
    >
      <span class="mark"><i></i></span>
      <span class="brand-text">
        <!-- 描线生长动效参考 Uiverse.io by SelfMadeSystem (https://uiverse.io/SelfMadeSystem/pretty-treefrog-77, MIT)；字形与配色为本站自绘 -->
        <svg class="wordmark" viewBox="0 0 100 30" role="img" aria-label="XXJ">
          <defs>
            <linearGradient id="xxj-grad" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#d9571a" />
              <stop offset="1" stop-color="#ffb067" />
            </linearGradient>
          </defs>
          <path class="stroke s1" pathLength="100" d="M4 6 L18 24" />
          <path class="stroke s1" pathLength="100" d="M18 6 L4 24" />
          <path class="stroke s2" pathLength="100" d="M28 6 L42 24" />
          <path class="stroke s2" pathLength="100" d="M42 6 L28 24" />
          <path class="stroke s3" pathLength="100" d="M58 6 V18 C58 25 54 27.5 51 24" />
        </svg>
      </span>
    </router-link>

    <nav class="nav">
      <router-link v-for="(l, i) in links" :key="l.to" :to="l.to" class="nav-link">
        <i>0{{ i + 1 }}</i>
        <span>{{ l.label }}</span>
      </router-link>
    </nav>

    <div class="meta">
      <div class="countdown">
        <span class="cd-label">距 28 考研初试</span>
        <b class="mono">{{ shownDays }}</b>
        <span class="cd-unit">天</span>
      </div>
    </div>
  </header>

  <main class="content">
    <slot />
  </main>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--nav-height);
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 0 24px;
  background: rgba(255, 253, 250, 0.86);
  backdrop-filter: blur(22px) saturate(120%);
  -webkit-backdrop-filter: blur(22px) saturate(120%);
  border-bottom: 1px solid var(--line);
  box-shadow: 0 12px 30px -28px rgba(85, 53, 28, 0.4);
  transition: background 0.3s var(--ease), box-shadow 0.3s var(--ease),
    border-color 0.3s var(--ease);
}
/* 页面往下滚一点：顶栏底色更实、投影加深，和内容分层 */
.topbar.lift {
  background: rgba(255, 253, 250, 0.96);
  border-color: rgba(126, 84, 46, 0.22);
  box-shadow: 0 14px 34px -22px rgba(85, 53, 28, 0.5);
}

/* 品牌 */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  transition: transform 0.35s var(--ease);
}
.brand:active {
  transform: scale(0.985);
}
.mark {
  --breathe: 0.075;
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: conic-gradient(from 140deg, #ff5e22, #ffb067, #7a3d1d, #ff5e22);
  /* 环在转 + 整体随呼吸缩放、光圈一明一暗（3.9s 一呼一吸） */
  animation: mark-spin 9s linear infinite, mark-breathe 3.9s ease-in-out infinite;
}
@keyframes mark-spin {
  to {
    transform: rotate(1turn);
  }
}
/* 用独立的 scale 属性做呼吸，不和旋转用的 transform 打架 */
@keyframes mark-breathe {
  0%,
  100% {
    scale: 1;
    box-shadow: 0 0 18px -6px rgba(217, 87, 26, 0.5), 0 0 0 0 rgba(217, 87, 26, 0);
  }
  50% {
    scale: calc(1 + var(--breathe));
    box-shadow: 0 0 46px 2px rgba(255, 110, 40, 0.72), 0 0 0 5px rgba(217, 87, 26, 0.08);
  }
}
/* 指针停上来：呼吸幅度加深，像人注意到你 */
.brand:hover .mark {
  --breathe: 0.13;
  animation-duration: 2.4s, 2.2s;
}
.mark::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: #f7f2ec;
}
/* 外圈呼吸环：从中心向外扩散一圈再消失 */
.mark::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 50%;
  border: 1.5px solid rgba(217, 87, 26, 0.6);
  animation: mark-pulse 3.9s var(--ease) infinite;
}
@keyframes mark-pulse {
  0% {
    transform: scale(0.78);
    opacity: 0.85;
  }
  70% {
    transform: scale(1.5);
    opacity: 0;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}
.mark i {
  position: relative;
  z-index: 1;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-cream);
  box-shadow: 0 0 12px rgba(196, 118, 46, 0.9);
  animation: core-breathe 3.9s var(--ease) infinite;
}
@keyframes core-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.78;
    box-shadow: 0 0 10px rgba(196, 118, 46, 0.7);
  }
  50% {
    transform: scale(1.5);
    opacity: 1;
    box-shadow: 0 0 22px rgba(255, 140, 60, 0.95);
  }
}
/* 品牌字占满原来两行的高度：单行放大，垂直居中 */
.brand-text {
  display: flex;
  align-items: center;
  align-self: stretch;
  line-height: 1;
}
/* 品牌字：三笔描线，像手写一样一笔笔长出来，6 秒一轮；线条本身有暖橙渐变 */
.wordmark {
  display: block;
  width: 67px;
  height: 20px;
  overflow: visible;
}
.wordmark .stroke {
  fill: none;
  stroke: url(#xxj-grad);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: xxj-draw 6s cubic-bezier(0.22, 0.9, 0.28, 1) infinite,
    brand-breathe 3.9s ease-in-out infinite;
}
/* 三笔错峰：X、X、J 依次落笔 */
.wordmark .s1 {
  animation-delay: 0s, 0s;
}
.wordmark .s2 {
  animation-delay: 0.26s, 0s;
}
.wordmark .s3 {
  animation-delay: 0.52s, 0s;
}
@keyframes xxj-draw {
  0% {
    stroke-dashoffset: 100;
    opacity: 0;
  }
  4% {
    opacity: 1;
  }
  26% {
    stroke-dashoffset: 0;
  }
  86% {
    stroke-dashoffset: 0;
  }
  94% {
    stroke-dashoffset: -100;
    opacity: 1;
  }
  96.5%,
  100% {
    stroke-dashoffset: -100;
    opacity: 0;
  }
}
/* 字也跟着同一口气起伏：从 88% 到不透明的极轻变化，和圆环同频 */
@keyframes brand-breathe {
  0%,
  100% {
    opacity: 0.86;
  }
  50% {
    opacity: 1;
  }
}
/* 指针停在品牌上：落笔提速，让人知道这里可以点 */
.brand:hover .wordmark .stroke {
  animation-duration: 3s, 2.2s;
}
/* 点击触发：整字快速重写一遍，作为“回首页”的动作反馈 */
.brand.sweeping .wordmark .stroke {
  animation: xxj-draw 1.1s ease-out 1 both;
  animation-delay: 0s;
}
.brand.sweeping .wordmark .s2 {
  animation-delay: 0.18s;
}
.brand.sweeping .wordmark .s3 {
  animation-delay: 0.36s;
}
/* 核心点：hover 时更亮更实，点击回收 */
.brand:hover .mark i {
  animation-duration: 1.6s;
}
/* 导航 */
.nav {
  display: flex;
  align-items: center;
  gap: 4px;
}
.nav-link {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 999px;
  color: var(--text-dim);
  transition: color 0.3s var(--ease), background 0.3s var(--ease),
    transform 0.3s var(--ease), box-shadow 0.3s var(--ease);
}
.nav-link i {
  font-family: 'JetBrains Mono', monospace;
  font-style: normal;
  font-size: 9px;
  color: var(--muted);
  opacity: 0.7;
}
.nav-link span {
  font-size: 13.5px;
}
.nav-link em {
  font-style: normal;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  letter-spacing: 0.14em;
  color: var(--muted);
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.3s var(--ease), transform 0.3s var(--ease);
}
.nav-link:hover {
  color: var(--text);
  background: rgba(217, 87, 26, 0.06);
  transform: translateY(-1px);
  box-shadow: 0 10px 22px -16px rgba(217, 87, 26, 0.9);
}
.nav-link:hover em {
  opacity: 0.8;
  transform: translateY(0);
}
.nav-link.router-link-active {
  color: var(--accent-cream);
}
.nav-link.router-link-active::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 2px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  box-shadow: 0 0 10px rgba(217, 87, 26, 0.8);
  transform-origin: 50% 50%;
  animation: navline 0.6s var(--ease) both;
}
@keyframes navline {
  0% {
    transform: scaleX(0);
    opacity: 0;
  }
  60% {
    opacity: 1;
  }
  100% {
    transform: scaleX(1);
    opacity: 1;
  }
}
.nav-link.router-link-active em {
  opacity: 0.55;
  color: var(--accent-soft);
}

/* 右侧 */
.meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}
.sync {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--text-dim);
  background: rgba(86, 56, 36, 0.03);
  font-variant-numeric: tabular-nums;
  transition: color 0.4s var(--ease), border-color 0.4s var(--ease), background 0.4s var(--ease);
}
.sync-text {
  font-family: 'JetBrains Mono', 'Noto Sans SC', monospace;
  font-size: 10.5px;
  letter-spacing: 0.02em;
}
.syncfade-enter-active,
.syncfade-leave-active {
  transition: opacity 0.28s var(--ease), transform 0.28s var(--ease);
}
.syncfade-enter-from {
  opacity: 0;
  transform: translateY(3px);
}
.syncfade-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
.sync .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--muted);
  transition: background 0.4s var(--ease), box-shadow 0.4s var(--ease);
}
/* 已同步：小点常亮 + 一圈缓慢呼吸，和品牌环呼应 */
.sync.online .dot {
  background: var(--status-mastered);
  box-shadow: 0 0 8px rgba(255, 94, 44, 0.9);
  animation: syncbreathe 2.6s var(--ease) infinite;
}
@keyframes syncbreathe {
  0%,
  100% {
    box-shadow: 0 0 8px rgba(255, 94, 44, 0.9), 0 0 0 0 rgba(217, 87, 26, 0.45);
  }
  70% {
    box-shadow: 0 0 8px rgba(255, 94, 44, 0.9), 0 0 0 7px rgba(217, 87, 26, 0);
  }
}
.sync.error {
  color: #e0746b;
  border-color: rgba(224, 116, 107, 0.35);
}
.sync.error .dot {
  background: #e0746b;
}
.sync.online {
  color: var(--status-mastered);
  border-color: rgba(255, 94, 44, 0.3);
}
.sync.offline {
  color: var(--accent-soft);
  border-color: rgba(196, 118, 46, 0.3);
}
.sync.guest {
  color: var(--muted);
  border-color: var(--line);
}
.sync.offline .dot {
  background: var(--accent-soft);
}
.sync.syncing .dot {
  background: var(--accent);
  animation: blink 1s infinite;
}
@keyframes blink {
  50% {
    opacity: 0.2;
  }
}

.countdown {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-left: 16px;
  border-left: 1px solid var(--line);
}
.cd-label {
  font-size: 10.5px;
  color: var(--muted);
  letter-spacing: 0.06em;
}
.countdown b {
  font-size: 20px;
  font-weight: 500;
  color: var(--accent-cream);
  letter-spacing: 0.02em;
  text-shadow: 0 0 26px rgba(217, 87, 26, 0.5);
}
.cd-unit {
  font-size: 10.5px;
  color: var(--muted);
}

.content {
  min-height: calc(100vh - var(--nav-height));
}

@media (max-width: 1180px) {
  .nav-link em {
    display: none;
  }
}
@media (max-width: 900px) {
  .topbar {
    gap: 16px;
    padding: 0 14px;
  }
  .nav-link {
    padding: 8px 8px;
  }
  .nav-link i {
    display: none;
  }
  .cd-label {
    display: none;
  }
  .countdown {
    padding-left: 10px;
    gap: 3px;
  }
  .countdown b {
    font-size: 16px;
  }
  .sync {
    display: none;
  }
}
@media (max-width: 620px) {
  .brand-text {
    display: none;
  }
  .nav-link span {
    font-size: 12.5px;
  }
}
</style>

