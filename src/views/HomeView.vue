<script setup>
// 首页：流动雕塑 + 大标题 + 三卷分区 + 标签跑马灯
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import RibbonScene from '../components/RibbonScene.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const q = ref('')

function goSearch() {
  router.push(q.value ? { path: '/notes', query: { q: q.value } } : { path: '/notes' })
}

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

// 磁吸按钮：手册 04 那条，按钮被光标吸过去一点，划开弹回
function magnetMove(e) {
  if (e.pointerType !== 'mouse') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const r = e.currentTarget.getBoundingClientRect()
  const dx = Math.max(-9, Math.min(9, (e.clientX - (r.left + r.width / 2)) * 0.22))
  const dy = Math.max(-7, Math.min(7, (e.clientY - (r.top + r.height / 2)) * 0.22))
  e.currentTarget.style.transform = `translate(${dx}px, ${dy}px)`
}
function magnetReset(e) {
  e.currentTarget.style.transform = ''
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
        <button
          class="btn btn-primary"
          @click="goNotes"
          @pointermove="magnetMove"
          @pointerleave="magnetReset"
        >
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

      <form class="hero-search reveal reveal-d3" @submit.prevent="goSearch">
        <Icon name="search" :size="14" :weight="1.7" />
        <input v-model.trim="q" type="search" placeholder="搜笔记：标题、标签、关键字" aria-label="搜索笔记" />
        <button type="submit" class="mono">搜索</button>
      </form>

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

    <!-- 水豚走路：直接用 Uiverse.io by Novaxlo 的元素（https://uiverse.io/Novaxlo/kind-snail-5, MIT），只做缩放与定位适配 -->
    <div class="capy-stage" aria-hidden="true">
      <div class="capy-mover">
      <div class="capybaraloader">
        <div class="capybara">
          <div class="capyhead">
            <div class="capyear"><div class="capyear2"></div></div>
            <div class="capyear"></div>
            <div class="capymouth"><div class="capylips"></div><div class="capylips"></div></div>
            <div class="capyeye"></div>
            <div class="capyeye"></div>
          </div>
          <div class="capyleg"></div>
          <div class="capyleg2"></div>
          <div class="capyleg2"></div>
          <div class="capy"></div>
        </div>
        <div class="loader">
          <div class="loaderline"></div>
        </div>
      </div>
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
/* 水豚走路：照搬 Uiverse.io by Novaxlo 的元素（MIT），缩得更小并沿整条底线一直往前爬 */
.capy-stage{position:absolute;left:44px;right:300px;bottom:8px;height:72px;z-index:3;pointer-events:none;overflow:hidden;font-size:9px}
/* 底线：拉通整段，不再用元素自带的短虚线 */
.capy-stage::before{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:repeating-linear-gradient(90deg,rgba(126,84,46,.26) 0 7px,transparent 7px 15px)}
.capy-mover{position:absolute;left:0;bottom:1px;animation:capy-crawl 34s linear infinite}
@keyframes capy-crawl{0%{left:-104px;opacity:0}5%{opacity:1}92%{opacity:1}100%{left:100%;opacity:0}}
.capybaraloader{width:14em;height:7.5em;position:relative;z-index:1;--color:rgb(204,125,45);--color2:rgb(83,56,28);transform:scale(.75);transform-origin:bottom left}
.capybara{width:100%;height:7.5em;position:relative;z-index:1}
.loader{display:none}
.capy{width:85%;height:100%;background:linear-gradient(var(--color),90%,var(--color2));border-radius:45%;position:relative;z-index:1;animation:movebody 1s linear infinite}
.capyhead{width:7.5em;height:7em;bottom:0;right:0;position:absolute;background-color:var(--color);z-index:3;border-radius:3.5em;box-shadow:-1em 0 var(--color2);animation:movebody 1s linear infinite}
.capyear{width:2em;height:2em;background:linear-gradient(-45deg,var(--color),90%,var(--color2));top:0;left:0;border-radius:100%;position:absolute;overflow:hidden;z-index:3}
.capyear:nth-child(2){left:5em;background:linear-gradient(25deg,var(--color),90%,var(--color2))}
.capyear2{width:100%;height:1em;background-color:var(--color2);bottom:0;left:.5em;border-radius:100%;position:absolute;transform:rotate(-45deg)}
.capymouth{width:3.5em;height:2em;background-color:var(--color2);position:absolute;bottom:0;left:2.5em;border-radius:50%;display:flex;justify-content:space-around;align-items:center;padding:.5em}
.capylips{width:.25em;height:.75em;border-radius:100%;transform:rotate(-45deg);background-color:var(--color)}
.capylips:nth-child(2){transform:rotate(45deg)}
.capyeye{width:2em;height:.5em;background-color:var(--color2);position:absolute;bottom:3.5em;left:1.5em;border-radius:5em;transform:rotate(45deg)}
.capyeye:nth-child(4){transform:rotate(-45deg);left:5.5em;width:1.75em}
.capyleg{width:6em;height:5em;bottom:0;left:0;position:absolute;background:linear-gradient(var(--color),95%,var(--color2));z-index:2;border-radius:2em;animation:movebody 1s linear infinite}
.capyleg2{width:1.75em;height:3em;bottom:0;left:3.25em;position:absolute;background:linear-gradient(var(--color),80%,var(--color2));z-index:2;border-radius:.75em;box-shadow:inset 0 -.5em var(--color2);animation:moveleg 1s linear infinite}
.capyleg2:nth-child(3){width:1.25em;left:.5em;height:2em;animation:moveleg2 1s linear infinite .075s}
@keyframes moveleg{0%{transform:rotate(-45deg) translateX(-5%)}50%{transform:rotate(45deg) translateX(5%)}100%{transform:rotate(-45deg) translateX(-5%)}}
@keyframes moveleg2{0%{transform:rotate(45deg)}50%{transform:rotate(-45deg)}100%{transform:rotate(45deg)}}
@keyframes movebody{0%{transform:translateX(0)}50%{transform:translateX(2%)}100%{transform:translateX(0)}}
.loaderline{width:50em;height:.5em;border-top:.5em dashed var(--color2);animation:moveline 10s linear infinite;-webkit-mask-image:linear-gradient(90deg,#000 78%,transparent);mask-image:linear-gradient(90deg,#000 78%,transparent)}
@keyframes moveline{0%{transform:translateX(0);opacity:0}5%{opacity:1}95%{opacity:1}100%{opacity:0;transform:translateX(-70%)}}
@media (max-width: 640px) {
  .capy-stage {
    left: 18px;
    right: 18px;
    bottom: 6px;
    height: 58px;
    font-size: 7.5px;
  }
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
/* 首屏搜索只在窄屏出现，桌面仍用图谱和目录 */
.hero-search {
  display: none;
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
.cta .btn-primary {
  /* 磁吸要跟手，比全局 .btn 的 .35s 收短 */
  transition: transform 0.2s cubic-bezier(0.22, 0.9, 0.28, 1),
    background 0.3s var(--ease), box-shadow 0.3s var(--ease);
  will-change: transform;
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
  font-size: 10.5px;
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
    /* 手机上也撑满一屏，水豚的地面线才会压在屏幕底边，而不是悬在半空 */
    min-height: calc(100dvh - var(--nav-height));
    align-items: flex-start;
    padding: 24px 18px 38px;
  }
  .copy {
    max-width: none;
    width: 100%;
  }
  .copy h1 {
    margin: 14px 0 14px;
    font-size: clamp(30px, 8.8vw, 40px);
    line-height: 1.16;
  }
  .lede {
    max-width: none;
    margin-bottom: 22px;
    font-size: 13.5px;
    line-height: 1.75;
  }
  .cta {
    gap: 10px;
    margin-bottom: 14px;
  }
  .cta .btn {
    flex: 1 1 0;
    justify-content: center;
    min-height: 46px;
  }
  /* 手机上没有目录栏，先在首屏给一个直接搜索入口 */
  .hero-search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    margin: 0 0 22px;
    padding: 0 6px 0 12px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg-panel);
  }
  .hero-search :deep(svg) {
    flex: 0 0 auto;
    opacity: 0.55;
  }
  .hero-search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    outline: none;
    font-size: 13px;
    font-family: inherit;
    color: var(--text);
  }
  .hero-search input::placeholder {
    color: var(--text-muted);
  }
  .hero-search button {
    flex: 0 0 auto;
    height: 32px;
    padding: 0 13px;
    border: 1px solid rgba(217, 87, 26, 0.28);
    border-radius: 999px;
    background: rgba(217, 87, 26, 0.08);
    color: var(--accent-cream);
    font-size: 11.5px;
    letter-spacing: 0.04em;
  }
  .hero-search button:active {
    background: rgba(217, 87, 26, 0.16);
  }
  .vol-row {
    grid-template-columns: 1fr;
    gap: 8px;
    padding-top: 14px;
  }
  .vol {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    min-height: 54px;
    padding: 11px 14px;
  }
  .vol-top {
    width: auto;
    gap: 8px;
  }
  .vol-bar {
    display: none;
  }
  .capy-stage {
    left: 18px;
    right: 18px;
    bottom: 6px;
    height: 52px;
    font-size: 7.5px;
  }
}
</style>
