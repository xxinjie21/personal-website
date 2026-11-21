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

      <div class="stats reveal reveal-d3">
        <div class="stat-cell">
          <b>{{ total }}</b>
          <small>笔记</small>
        </div>
        <div class="stat-cell">
          <b>{{ tagCount }}</b>
          <small>标签</small>
        </div>
        <div class="stat-cell">
          <b>{{ folders.length }}</b>
          <small>分区</small>
        </div>
      </div>
    </div>

    <p class="stage-note mono">MOVE THE CURSOR · THE RIBBON BREATHES</p>
  </section>

  <section class="volumes">
    <div class="vol-head">
      <p class="eyebrow">VOLUMES — {{ String(folders.length).padStart(2, '0') }}</p>
      <h2 class="reveal">三卷分区</h2>
      <button class="more link-x" @click="goNotes">看全部 <Icon name="arrow-right" class="more-arw" :size="11" /></button>
    </div>

    <div class="vol-grid">
      <button
        v-for="f in folders"
        :key="f.name"
        class="vol"
        :style="{ '--vol': f.color, '--pct': f.pct }"
        @mousemove="volSpot"
        @click="goNotes"
      >
        <span class="vol-idx mono">{{ f.idx }}</span>
        <b class="vol-count mono">{{ f.count }}</b>
        <h3>{{ f.name }}</h3>
        <span class="vol-bar"><i></i></span>
        <span class="vol-go">打开这一卷 <em><Icon name="arrow-up-right" :size="10" /></em></span>
      </button>
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
.stats {
  display: inline-flex;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.stats .stat-cell {
  padding: 0 26px;
  border-left: 1px solid var(--line);
}
.stats .stat-cell:first-child {
  padding-left: 0;
  border-left: none;
}
.stats .stat-cell:last-child {
  padding-right: 0;
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
.volumes {
  padding: 64px 44px 88px;
}
.vol-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 26px;
}
.vol-head h2 {
  margin: 10px 0 0;
  font-family: 'Noto Serif SC', 'Playfair Display', serif;
  font-size: clamp(22px, 2.2vw, 30px);
  font-weight: 600;
}
.more {
  border: none;
  background: none;
  color: var(--text-dim);
  font-size: 12px;
  cursor: pointer;
  padding: 6px 0;
}
.vol-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.vol {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 22px 22px 18px;
  min-height: 176px;
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.6), rgba(255, 250, 244, 0.72));
  color: var(--text);
  overflow: hidden;
  transition: transform 0.45s var(--ease), border-color 0.45s var(--ease),
    box-shadow 0.45s var(--ease);
}
.vol::before {
  content: '';
  position: absolute;
  width: 220px;
  height: 220px;
  right: -90px;
  top: -110px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--vol), transparent 62%);
  opacity: 0.16;
  transition: opacity 0.5s var(--ease), transform 0.6s var(--ease);
}
.vol:hover {
  transform: translateY(-5px);
  border-color: color-mix(in srgb, var(--vol) 45%, transparent);
  box-shadow: 0 30px 60px -34px rgba(217, 87, 26, 0.55);
}
.vol:hover::before {
  opacity: 0.32;
  transform: scale(1.12);
}
/* 跟光：一层随鼠标走的暖光 + 一圈细描边高光 */
.vol::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(190px circle at var(--mx, 50%) var(--my, 0%), rgba(230, 150, 90, 0.16), transparent 68%),
    radial-gradient(320px circle at var(--mx, 50%) var(--my, 0%), rgba(217, 87, 26, 0.08), transparent 72%);
  transition: opacity 0.4s var(--ease);
}
.vol:hover::after {
  opacity: 1;
}
.vol:active {
  transform: translateY(-2px) scale(0.994);
}
.vol-idx {
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--muted);
}
.vol-count {
  font-size: 44px;
  font-weight: 500;
  line-height: 1;
  color: var(--vol);
  text-shadow: 0 0 30px rgba(217, 87, 26, 0.28);
}
.vol h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}
.vol-bar {
  position: relative;
  display: block;
  width: 100%;
  height: 1px;
  margin-top: auto;
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
.vol-go {
  font-size: 11px;
  color: var(--muted);
  transition: color 0.3s var(--ease);
}
.vol-go em {
  font-style: normal;
}
.vol:hover .vol-go {
  color: var(--accent-cream);
}

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
  .stats .stat-cell b {
    font-size: 40px;
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
  .volumes {
    padding: 44px 18px 26px;
  }
  .stats {
    width: 100%;
    justify-content: space-between;
  }
  .stat-row .stat-cell,
  .stats .stat-cell {
    padding: 0 14px;
  }
}
</style>
