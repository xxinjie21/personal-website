<script setup>
// 首页：流动雕塑 + 大标题 + 三卷分区 + 标签跑马灯
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import RibbonScene from '../components/RibbonScene.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()

const manifest = ref({ notes: [], edges: [], tags: [] })

// 标题末尾的词：打字机 + 输入光标 —— 逐字打出、停留、逐字删掉，再换下一个
// 四个词都取"知识会自然生长"的意象：索引=可查、年轮=时间、河床=沉积、根系=连接
const words = ['索引', '年轮', '河床', '根系']
const wi = ref(0)
const typed = ref('')
let rotTimer = null

const TYPE_MS = 130
const HOLD_MS = 1500
const DEL_MS = 80
const GAP_MS = 340

function typeStep() {
  const target = words[wi.value]
  if (typed.value.length < target.length) {
    typed.value = target.slice(0, typed.value.length + 1)
    rotTimer = setTimeout(typeStep, TYPE_MS)
    return
  }
  rotTimer = setTimeout(eraseStep, HOLD_MS)
}

function eraseStep() {
  if (typed.value.length > 0) {
    typed.value = typed.value.slice(0, -1)
    rotTimer = setTimeout(eraseStep, DEL_MS)
    return
  }
  wi.value = (wi.value + 1) % words.length
  rotTimer = setTimeout(typeStep, GAP_MS)
}

const notes = computed(() => manifest.value.notes || [])
const total = computed(() => notes.value.length)
const tagCount = computed(() => (manifest.value.tags || []).length)

const FOLDER_COLORS = ['#ff7a2f', '#ffb067', '#ffd7b8', '#cf8a63']

const folders = computed(() => {
  const map = new Map()
  notes.value.forEach((n) => {
    const f = (n.rel || '').split('/')[0] || '未分类'
    map.set(f, (map.get(f) || 0) + 1)
  })
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({
      name,
      count,
      idx: String(i + 1).padStart(2, '0'),
      color: FOLDER_COLORS[i % FOLDER_COLORS.length],
      pct: count / (total.value || 1),
    }))
})

function goNotes() {
  router.push('/notes')
}

// 卡片聚光：光标位置写进 CSS 变量，由 ::after 的径向渐变跟过去（Uiverse spotlight card）
function volSpot(e) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

onMounted(async () => {
  try {
    const mod = await import('../data/site-manifest.json')
    manifest.value = mod.default
  } catch (err) {
    console.warn('manifest 读取失败', err)
  }
  rotTimer = setTimeout(typeStep, 160)
})

onBeforeUnmount(() => clearTimeout(rotTimer))
</script>

<template>
  <section class="hero">
    <RibbonScene class="ribbon" />
    <div class="hero-mask" aria-hidden="true"></div>

    <div class="copy">
      <p class="eyebrow reveal"><i class="live"></i> KNOWLEDGE ATLAS — 2026</p>

      <h1 class="reveal reveal-d1">
        笔记不是仓库，<br />
        是<em class="typeword">{{ typed }}<i class="capline"></i></em>
      </h1>

      <p class="lede reveal reveal-d2">
        {{ total }} 篇笔记、{{ tagCount }} 个标签，按考研、开发、实习分成三卷。
        写作、连缀、回看，都在这里。
      </p>

      <div class="cta reveal reveal-d3">
        <button class="btn btn-primary" @click="goNotes">
          进入笔记库 <Icon name="arrow-up-right" class="arw" :size="12" />
        </button>
        <a
          class="btn ghost"
          href="https://github.com/xxinjie21"
          target="_blank"
          rel="noreferrer"
        >
          GitHub <Icon name="arrow-up-right" class="arw" :size="12" />
        </a>
      </div>

      <div class="vol-row reveal reveal-d3">
        <button
          v-for="f in folders"
          :key="f.name"
          class="vol"
          :style="{ '--vol': f.color, '--pct': f.pct }"
          @mousemove="volSpot"
          @click="goNotes"
        >
          <span class="vol-top">
            <em class="vol-idx mono">{{ f.idx }}</em>
            <b class="vol-count mono">{{ f.count }}</b>
          </span>
          <span class="vol-name">{{ f.name }}</span>
          <span class="vol-bar"><i></i></span>
        </button>
      </div>
    </div>

    <p class="stage-note mono">MOVE THE CURSOR · THE RIBBON BREATHES</p>

    <!-- 毛毛虫爬行：走线思路参考 Uiverse.io by Novaxlo (https://uiverse.io/Novaxlo/kind-snail-5, MIT)，动物与身体结构为本站自绘 -->
    <div class="crawl-track" aria-hidden="true">
      <div class="crawler">
        <span class="c-seg" style="--k: 3"></span>
        <span class="c-seg" style="--k: 2"></span>
        <span class="c-seg" style="--k: 1"></span>
        <span class="c-seg" style="--k: 0"></span>
        <span class="c-head">
          <span class="c-eye"></span>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  display: flex;
  align-items: center;
  min-height: calc(100vh - var(--nav-height));
  padding: 40px 44px 56px;
  overflow: hidden;
  border-bottom: 1px solid var(--line);
}
.ribbon {
  position: absolute;
  inset: 0;
  z-index: 1;
}
.hero-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(90deg, #f7f2ec 0%, rgba(247, 242, 236, 0.94) 30%, rgba(247, 242, 236, 0.55) 52%, rgba(247, 242, 236, 0.12) 70%, transparent 82%),
    linear-gradient(180deg, rgba(247, 242, 236, 0.75), transparent 22%, transparent 78%, rgba(247, 242, 236, 0.8));
}
.copy {
  position: relative;
  z-index: 3;
max-width: 560px;
}
/* 毛毛虫：沿 hero 底部的虚线从左爬到右 */
.crawl-track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 9px;
  height: 26px;
  z-index: 3;
  pointer-events: none;
  overflow: hidden;
}
.crawl-track::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5px;
  height: 1px;
  background: repeating-linear-gradient(
    90deg,
    rgba(126, 84, 46, 0.26) 0 7px,
    transparent 7px 15px
  );
}
.crawler {
  position: absolute;
  left: 0;
  bottom: 6px;
  display: flex;
  align-items: flex-end;
  gap: 1px;
  transform: scale(1.3);
  transform-origin: bottom left;
  animation: crawl-x 23s linear infinite;
}
@keyframes crawl-x {
  0% {
    left: -54px;
    opacity: 0;
  }
  4% {
    opacity: 1;
  }
  92% {
    opacity: 1;
  }
  100% {
    left: 100%;
    opacity: 0;
  }
}
/* 身体分段：越靠尾越细，一节节上下拱 */
.c-seg {
  position: relative;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 28%, #e9a163, #b26a33 72%, #8a4b22);
  box-shadow: 0 2px 3px -2px rgba(90, 50, 20, 0.5);
  animation: seg-wave 0.52s ease-in-out infinite alternate;
  animation-delay: calc(var(--k) * -0.09s);
}
.c-seg:nth-child(1) {
  width: 6.5px;
  height: 6.5px;
  opacity: 0.8;
}
.c-seg:nth-child(2) {
  width: 7.5px;
  height: 7.5px;
  opacity: 0.9;
}
.c-seg:nth-child(3) {
  width: 8.5px;
  height: 8.5px;
}
/* 每节的腿：两根细线交替摆，像真的在蹬 */
.c-seg::before,
.c-seg::after {
  content: '';
  position: absolute;
  top: 6px;
  width: 1.6px;
  height: 5px;
  border-radius: 2px;
  background: #8a5528;
  transform-origin: top center;
  animation: leg-swing 0.52s ease-in-out infinite alternate;
  animation-delay: calc(var(--k) * -0.09s);
}
.c-seg::before {
  left: 1px;
}
.c-seg::after {
  right: 1px;
  animation-delay: calc(var(--k) * -0.09s - 0.26s);
}
@keyframes seg-wave {
  from {
    transform: translateY(0) rotate(-2deg);
  }
  to {
    transform: translateY(-1.6px) rotate(2deg);
  }
}
@keyframes leg-swing {
  from {
    transform: rotate(-22deg);
  }
  to {
    transform: rotate(24deg);
  }
}
/* 头：比身体略大，两根触须探路 */
.c-head {
  position: relative;
  width: 12px;
  height: 12px;
  margin-left: 1px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 30%, #f0b276, #a75f2c 74%, #7f4520);
  animation: head-bob 0.52s ease-in-out infinite alternate;
}
@keyframes head-bob {
  from {
    transform: translateY(-1px) rotate(-3deg);
  }
  to {
    transform: translateY(1px) rotate(3deg);
  }
}
.c-head::before,
.c-head::after {
  content: '';
  position: absolute;
  top: -5px;
  width: 1.5px;
  height: 6px;
  border-radius: 2px;
  background: #8a5528;
  transform-origin: bottom center;
  animation: antenna 1.3s ease-in-out infinite alternate;
}
.c-head::before {
  left: 3px;
  transform: rotate(-24deg);
}
.c-head::after {
  right: 3px;
  transform: rotate(24deg);
  animation-delay: -0.65s;
}
@keyframes antenna {
  from {
    rotate: -7deg;
  }
  to {
    rotate: 9deg;
  }
}
.c-eye {
  position: absolute;
  top: 3px;
  right: 2.5px;
  width: 2.6px;
  height: 2.6px;
  border-radius: 50%;
  background: #2a1a10;
  box-shadow: 0 0 0 0.6px rgba(255, 232, 210, 0.7);
}
.live {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 9px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 0 rgba(217, 87, 26, 0.6);
  animation: live 2.4s infinite;
}
@keyframes live {
  0% {
    box-shadow: 0 0 0 0 rgba(217, 87, 26, 0.55);
  }
  70% {
    box-shadow: 0 0 0 9px rgba(217, 87, 26, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(217, 87, 26, 0);
  }
}
.copy h1 {
  margin: 18px 0 18px;
  font-size: clamp(34px, 4.6vw, 68px);
  line-height: 1.12;
  letter-spacing: -0.015em;
  font-weight: 700;
}
.copy h1 em {
  font-style: normal;
  font-family: 'Noto Serif SC', 'Playfair Display', serif;
  font-weight: 600;
  color: var(--accent);
  text-shadow: 0 0 52px rgba(217, 87, 26, 0.38);
}
.typeword {
  white-space: nowrap;
}
/* 输入光标：细竖条 + 暖光，按终端节奏闪 */
.capline {
  display: inline-block;
  width: 2px;
  height: 0.82em;
  margin-left: 5px;
  vertical-align: 0.02em;
  background: var(--accent-cream);
  box-shadow: 0 0 14px rgba(217, 87, 26, 0.85);
  animation: capline 1.05s steps(1, end) infinite;
}
@keyframes capline {
  0%,
  46% {
    opacity: 1;
  }
  54%,
  100% {
    opacity: 0.12;
  }
}
.lede {
  margin: 0 0 26px;
  max-width: 440px;
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--text-dim);
}
.cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 34px;
}
.cta .arw {
  color: currentColor;
  transition: transform 0.35s var(--ease);
}
.more-arw {
  color: currentColor;
  transition: transform 0.35s var(--ease);
}
.more:hover .more-arw {
  transform: translateX(3px);
}
.cta .btn:hover .arw {
  transform: translate(2px, -2px);
}
.ghost {
  background: transparent;
  border-color: rgba(86, 56, 36, 0.22);
  color: var(--text-dim);
  text-decoration: none;
}
/* 三卷：直接并进首屏左栏，做成一行紧凑卡片，不再单独占一整块 */
.vol-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}
.vol {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 13px 10px;
  text-align: left;
  cursor: pointer;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.7), rgba(255, 250, 244, 0.82));
  color: var(--text);
  overflow: hidden;
  transition: transform 0.4s var(--ease), border-color 0.4s var(--ease),
    box-shadow 0.4s var(--ease);
}
.vol::before {
  content: '';
  position: absolute;
  width: 150px;
  height: 150px;
  right: -70px;
  top: -80px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--vol), transparent 62%);
  opacity: 0.16;
  transition: opacity 0.5s var(--ease), transform 0.6s var(--ease);
}
.vol:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--vol) 45%, transparent);
  box-shadow: 0 18px 40px -26px rgba(217, 87, 26, 0.55);
}
.vol:hover::before {
  opacity: 0.32;
  transform: scale(1.12);
}
/* 跟光：一层随鼠标走的暖光 */
.vol::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(150px circle at var(--mx, 50%) var(--my, 0%), rgba(230, 150, 90, 0.16), transparent 68%);
  transition: opacity 0.4s var(--ease);
}
.vol:hover::after {
  opacity: 1;
}
.vol:active {
  transform: translateY(-1px) scale(0.994);
}
.vol-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  width: 100%;
}
.vol-idx {
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--muted);
}
.vol-count {
  font-size: 24px;
  font-weight: 500;
  line-height: 1;
  color: var(--vol);
}
.vol-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}
.vol-bar {
  position: relative;
  display: block;
  width: 100%;
  height: 1px;
  margin-top: 4px;
  background: rgba(86, 56, 36, 0.08);
  overflow: hidden;
}
.vol-bar i {
  position: absolute;
  left: 0;
  top: 0;
  height: 1px;
  width: calc(var(--pct) * 100%);
  background: var(--vol);
}
.stage-note {
  position: absolute;
  right: 44px;
  bottom: 30px;
  z-index: 3;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  letter-spacing: 0.2em;
  color: rgba(120, 80, 50, 0.62);
  text-transform: uppercase;
}
.stage-note::before {
  content: '';
  width: 26px;
  height: 1px;
  background: linear-gradient(90deg, rgba(217, 87, 26, 0.8), rgba(196, 118, 46, 0.15));
}

/* 三卷 */

@media (max-width: 1024px) {
  .hero-mask {
    background:
      linear-gradient(180deg, rgba(247, 242, 236, 0.92) 0%, rgba(247, 242, 236, 0.7) 55%, rgba(247, 242, 236, 0.95)),
      linear-gradient(90deg, #f7f2ec 0%, rgba(247, 242, 236, 0.75) 45%, transparent 80%);
  }
  .vol-grid {
    grid-template-columns: 1fr;
  }
}
@media (min-width: 1500px) {
  .copy {
    max-width: 680px;
  }
  .copy h1 {
    font-size: clamp(52px, 4vw, 74px);
    word-break: keep-all;
  }
  .lede {
    max-width: 480px;
    font-size: 16px;
  }
  .eyebrow {
    font-size: 12px;
  }
  .stats .stat-cell b {
    font-size: 36px;
  }
  .stats .stat-cell span,
  .stats .stat-cell small {
    font-size: 12px;
  }
  .stage-note {
    font-size: 14px;
    right: 52px;
    bottom: 34px;
  }
}
@media (min-width: 2100px) {
  .hero {
    padding: 56px 64px 64px;
  }
  .copy {
    max-width: 820px;
  }
  .copy h1 {
    font-size: clamp(70px, 3.6vw, 92px);
  }
  .lede {
    max-width: 520px;
    font-size: 17.5px;
  }
  .vol-count {
    font-size: 28px;
  }
  .stage-note {
    font-size: 15px;
    right: 64px;
    bottom: 40px;
  }
}
@media (max-width: 960px) {
  .hero {
    padding: 30px 22px 44px;
  }
  .stage-note {
    display: none;
  }
}
@media (max-width: 640px) {
  .hero {
    padding: 22px 18px 34px;
  }
  .vol-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .vol {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
  .vol-top {
    width: auto;
    gap: 8px;
  }
  .vol-bar {
    display: none;
  }
}
</style>
