<script setup>
// 单篇笔记正文：Markdown + KaTeX 渲染、图片灯箱、双链点击、关键词高亮
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { renderMarkdown, enhanceRendered } from '../lib/markdown.js'

const props = defineProps({
  note: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  highlight: { type: String, default: '' },
  prev: { type: Object, default: null },
  next: { type: Object, default: null },
})
const emit = defineEmits(['open', 'lightbox', 'rendered'])

// 面包屑：rel 里的目录层级拆开，末段去掉 .md
const crumbs = computed(() => {
  const rel = props.note?.rel || ''
  return rel
    .replace(/\.md$/i, '')
    .split('/')
    .filter(Boolean)
})
// 元信息：字数 / 阅读时长 / 源文件更新时间
const updatedText = computed(() => {
  const m = props.note?.mtime
  if (!m) return ''
  const d = new Date(m)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const bodyRef = ref(null)
const html = computed(() => (props.note ? renderMarkdown(props.note.content || '') : ''))

let observer = null

function bindBody() {
  const el = bodyRef.value
  if (!el) return
  enhanceRendered(el)

  el.querySelectorAll('.wiki-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault()
      emit('open', a.dataset.target)
    })
  })
  el.querySelectorAll('.md-img').forEach((img) => {
    img.addEventListener('click', () => emit('lightbox', { src: img.src, alt: img.dataset.alt || '' }))
  })
  applyHighlight()
  fitMathBlocks(el)
}

// 长公式：先按容器宽度等比缩一点，尽量一屏看全；缩到 0.8 倍仍放不下的才留给横向滚动
function fitMathBlocks(root = bodyRef.value) {
  if (!root) return
  root.querySelectorAll('.md-math-block').forEach((mb) => {
    mb.style.fontSize = ''
    const base = parseFloat(getComputedStyle(mb).fontSize)
    if (!base) return
    const cw = mb.clientWidth
    const sw = mb.scrollWidth
    if (sw <= cw + 1) return
    const k = cw / sw
    if (k < 0.7) return
    let size = base * k * 0.99
    mb.style.fontSize = `${size.toFixed(2)}px`
    const sw2 = mb.scrollWidth
    if (sw2 > cw + 1) {
      size = parseFloat(mb.style.fontSize) * (cw / sw2)
      mb.style.fontSize = `${size.toFixed(2)}px`
    }
  })
}
let fitTimer = 0
function onResize() {
  clearTimeout(fitTimer)
  fitTimer = setTimeout(() => fitMathBlocks(), 160)
}

// 关键词高亮：只在文本节点上包裹，不破坏代码块结构
function applyHighlight() {
  const el = bodyRef.value
  const kw = props.highlight.trim()
  if (!el) return
  el.querySelectorAll('.kw-hit').forEach((node) => {
    node.replaceWith(document.createTextNode(node.textContent))
  })
  el.normalize()
  if (!kw) return
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const hits = []
  const lower = kw.toLowerCase()
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!node.nodeValue || node.nodeValue.toLowerCase().indexOf(lower) === -1) continue
    const tag = node.parentElement?.tagName
    if (['SCRIPT', 'STYLE', 'SVG'].includes(tag)) continue
    hits.push(node)
  }
  for (const node of hits) {
    const text = node.nodeValue
    const frag = document.createDocumentFragment()
    let idx = text.toLowerCase().indexOf(lower)
    let last = 0
    while (idx !== -1) {
      if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)))
      const mark = document.createElement('mark')
      mark.className = 'kw-hit'
      mark.textContent = text.slice(idx, idx + kw.length)
      frag.appendChild(mark)
      last = idx + kw.length
      idx = text.toLowerCase().indexOf(lower, last)
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
    node.replaceWith(frag)
  }
}

watch(
  () => props.note?.slug,
  async () => {
    await nextTick()
    bindBody()
    // 正文挂好之后再通知外层：此时标题都在 DOM 里，大纲可以定位当前项
    emit('rendered', props.note?.slug)
  }
)

watch(
  () => props.highlight,
  () => nextTick().then(applyHighlight)
)

onBeforeUnmount(() => observer?.disconnect())

defineExpose({ bindBody })

// 阅读进度：容器滚动比例，喂给顶部那条 2px 暖橙细线
const prog = ref(0)
const readerEl = ref(null)
function onScroll(e) {
  const el = e.currentTarget
  const total = el.scrollHeight - el.clientHeight
  prog.value = total > 8 ? Math.min(1, Math.max(0, el.scrollTop / total)) : 0
}
function toTop() {
  readerEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

// 公式放大：点整行公式，把同一段 KaTeX 复制到灯箱里按 1.45 倍看，长公式不用再横着拖
const zoomMath = ref('')
function onMathClick(e) {
  const mb = e.target.closest('.md-math-block')
  if (!mb) return
  zoomMath.value = mb.innerHTML
}
function closeMath() {
  zoomMath.value = ''
}
onMounted(() => {
  document.addEventListener('keydown', onMathKey)
  window.addEventListener('resize', onResize)
  if (document.fonts?.ready) document.fonts.ready.then(() => fitMathBlocks())
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onMathKey)
  window.removeEventListener('resize', onResize)
  clearTimeout(fitTimer)
})
function onMathKey(e) {
  if (e.key === 'Escape') closeMath()
}
</script>

<template>
  <div class="reader" ref="readerEl" @scroll="onScroll">
    <button
      v-if="prog > 0.1"
      type="button"
      class="to-top"
      title="回到顶部"
      @click="toTop"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    </button>
    <span class="read-bar" :style="{ transform: `scaleX(${prog})` }" aria-hidden="true"></span>
    <div v-if="loading" class="skeleton" aria-hidden="true">
      <div class="sk-dots"><i></i><i></i><i></i></div>
      <span class="sk-line sk-title"></span>
      <span class="sk-line"></span>
      <span class="sk-line w80"></span>
      <span class="sk-line w60"></span>
    </div>
    <div v-else-if="!note" class="state">
      <p class="state-title">还没有打开任何笔记</p>
      <p class="state-hint">从左侧目录选一篇，或在首页图谱里点一个节点。</p>
    </div>
    <article v-else :key="note.slug" class="article">
      <header class="head">
        <p class="crumb">
          <template v-for="(c, i) in crumbs" :key="i">
            <span v-if="i" class="crumb-sep">/</span><span class="crumb-part">{{ c }}</span>
          </template>
        </p>
        <h1 class="title">{{ note.title }}</h1>
        <p class="stats mono">
          <span>{{ note.chars || 0 }} 字</span>
          <span class="dot">·</span>
          <span>约 {{ note.minutes || 1 }} 分钟</span>
          <template v-if="updatedText">
            <span class="dot">·</span>
            <span>更新 {{ updatedText }}</span>
          </template>
        </p>
        <div class="meta">
          <span v-for="tag in note.tags" :key="tag" class="tag">#{{ tag }}</span>
          <span v-for="alias in note.aliases" :key="alias" class="alias">别名：{{ alias }}</span>
        </div>
      </header>
      <div ref="bodyRef" class="markdown" v-html="html" @click="onMathClick"></div>

      <nav v-if="prev || next" class="pager">
        <button v-if="prev" type="button" class="pager-btn prev" @click="emit('open', prev.slug)">
          <span class="pager-dir">← 上一篇</span>
          <span class="pager-name">{{ prev.title }}</span>
        </button>
        <span v-else class="pager-gap"></span>
        <button v-if="next" type="button" class="pager-btn next" @click="emit('open', next.slug)">
          <span class="pager-dir">下一篇 →</span>
          <span class="pager-name">{{ next.title }}</span>
        </button>
      </nav>
    </article>
  </div>

  <Teleport to="body">
    <Transition name="mathzoom">
      <div v-if="zoomMath" class="math-zoom" @click="closeMath">
        <div class="math-card" role="dialog" aria-label="公式放大">
          <div class="math-body" v-html="zoomMath"></div>
          <p class="math-hint">点击任意处或按 Esc 关闭</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.reader {
  min-height: 0;
  overflow-y: auto;
  /* 进度条比正文宽 44px，锁死横向滚动，避免底部出现一条假的横向滑条 */
  overflow-x: hidden;
  scroll-behavior: smooth;
  padding: 0 44px 90px;
}
/* 阅读进度线：贴住阅读区顶边，随滚动从左往右长 */
.read-bar {
  position: sticky;
  top: 0;
  z-index: 6;
  display: block;
  width: calc(100% + 88px);
  margin-left: -44px;
  height: 2px;
  margin-bottom: -2px;
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(217, 87, 26, 0), var(--accent) 45%, var(--accent-cream));
  transform-origin: 0 50%;
  /* 换成缓出曲线：滚快了也像“顺手拉长”，不是硬跟手 */
  transition: transform 0.24s var(--ease);
  box-shadow: 0 0 10px rgba(217, 87, 26, 0.5);
  pointer-events: none;
}
/* 阅读区不做入场动画：切篇、滚动都不让正文动，读者视线不被打断 */
.article {
  max-width: 768px;
  margin: 0 auto;
  padding-top: 34px;
}
.markdown > * {
  animation: none;
}
.state {
  padding: 60px 0;
  color: var(--text-muted);
  text-align: center;
}
/* 加载骨架：几道灰条从左往右扫一道光，比“加载中…”更像在等东西 */
.skeleton {
  max-width: 768px;
  margin: 0 auto;
  padding-top: 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sk-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    rgba(126, 84, 46, 0.08) 0%,
    rgba(126, 84, 46, 0.16) 40%,
    rgba(126, 84, 46, 0.08) 80%
  );
  background-size: 220% 100%;
  animation: sk-sweep 1.5s ease-in-out infinite;
}
/* 骨架屏上的三点跳动：告诉人正文在读，而不是卡住 */
.sk-dots {
  display: flex;
  gap: 7px;
  height: 8px;
  margin-bottom: 2px;
}
.sk-dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: linear-gradient(160deg, #f6a468, #d9571a);
  animation: sk-hop 0.42s cubic-bezier(0.22, 0.8, 0.2, 1) infinite;
  opacity: 0.6;
}
.sk-dots i:nth-child(2) {
  animation-delay: 0.085s;
}
.sk-dots i:nth-child(3) {
  animation-delay: 0.17s;
}
@keyframes sk-hop {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.55;
  }
  38% {
    transform: translateY(-6px);
    opacity: 1;
  }
  68% {
    transform: translateY(0);
    opacity: 0.75;
  }
}
.sk-title {
  height: 26px;
  width: 46%;
}
.w80 {
  width: 80%;
}
.w60 {
  width: 60%;
}
@keyframes sk-sweep {
  0% {
    background-position: 130% 0;
  }
  100% {
    background-position: -60% 0;
  }
}
.state-title {
  color: var(--text);
  font-size: 15px;
  margin-bottom: 6px;
}
.crumb {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}
.crumb-sep {
  margin: 0 5px;
  color: rgba(138, 115, 101, 0.55);
}
.crumb-part:last-child {
  color: var(--text-dim);
}
/* 元信息：字数 / 时长 / 更新时间，弱化但不隐形 */
.stats {
  display: flex;
  align-items: center;
  gap: 0;
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}
.stats .dot {
  margin: 0 7px;
  opacity: 0.6;
}
/* 底部翻页 */
.pager {
  display: flex;
  align-items: stretch;
  gap: 10px;
  margin: 46px 0 8px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}
.pager-gap {
  flex: 1 1 0;
}
.pager-btn {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(255, 253, 250, 0.6);
  text-align: left;
  transition: background 0.25s var(--ease), border-color 0.25s var(--ease),
    transform 0.25s var(--ease);
}
.pager-btn.next {
  text-align: right;
}
.pager-btn:hover {
  background: #fffdfa;
  border-color: rgba(217, 87, 26, 0.32);
  transform: translateY(-2px);
}
.pager-dir {
  font-size: 10.5px;
  color: var(--accent-soft);
  letter-spacing: 0.06em;
}
.pager-name {
  font-size: 12.5px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.title {
  margin: 0 0 12px;
  font-family: 'Noto Serif SC', 'Playfair Display', serif;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.32;
  letter-spacing: 0;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
}
.tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(217, 87, 26, 0.13);
  border: 1px solid rgba(217, 87, 26, 0.22);
  color: var(--accent-soft);
}
.alias {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-muted);
}

/* 正文链接：悬停时下划线从左长到右（动效手册 · 悬停下划线生长） */
.reader :deep(.markdown a) {
  color: var(--accent-cream);
  background-image: linear-gradient(90deg, var(--accent), rgba(217, 87, 26, 0.3));
  background-repeat: no-repeat;
  background-size: 0 1px;
  background-position: 0 100%;
  transition: background-size 0.34s var(--ease);
  padding-bottom: 1px;
}
.reader :deep(.markdown a:hover) {
  background-size: 100% 1px;
}
/* 正文图片：悬停轻微推近，点开进灯箱 */
.reader :deep(.markdown .md-img) {
  transition: transform 0.34s var(--ease), box-shadow 0.34s var(--ease);
}
.reader :deep(.markdown .md-img:hover) {
  box-shadow: 0 18px 36px -26px rgba(85, 53, 28, 0.6);
}

/* 回到顶部：只在窄屏出现，浮在右下角 */
.to-top {
  display: none;
}

/* ===== 公式放大：点整行公式，按 1.45 倍看，长推导不用横向来回拖 ===== */
.math-zoom {
  position: fixed;
  inset: 0;
  z-index: 9990;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(36, 26, 18, 0.52);
  cursor: zoom-out;
}
.math-card {
  max-width: min(92vw, 1040px);
  max-height: 86vh;
  overflow: auto;
  padding: 26px 30px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #fffdfa;
  box-shadow: 0 34px 70px -34px rgba(36, 26, 18, 0.62);
  cursor: default;
  animation: mathing 0.24s var(--ease) both;
}
.math-body {
  font-size: 1.45em;
  line-height: 1.5;
  overflow-x: auto;
}
.math-hint {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
@keyframes mathing {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.mathzoom-enter-active,
.mathzoom-leave-active {
  transition: opacity 0.2s ease;
}
.mathzoom-enter-from,
.mathzoom-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .to-top {
    position: fixed;
    right: 14px;
    bottom: calc(18px + env(safe-area-inset-bottom));
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: var(--bg-panel);
    color: var(--text-muted);
    box-shadow: 0 8px 18px -10px rgba(60, 38, 18, 0.5);
  }
  .to-top:active {
    color: var(--accent);
    border-color: rgba(217, 87, 26, 0.35);
  }
}

/* 手机：收窄到 18px 边距，标题降一档，正文行宽更适合竖屏 */
@media (max-width: 640px) {  .reader {
    padding: 0 18px 64px;
  }
  .read-bar {
    width: calc(100% + 36px);
    margin-left: -18px;
  }
  .article {
    padding-top: 22px;
  }
  .title {
    font-size: 23px;
    line-height: 1.34;
    margin-bottom: 10px;
  }
  .meta {
    gap: 5px;
    margin-bottom: 14px;
  }
}

/* 系统要求减少动效时，三点加载只留静止的点 */
@media (prefers-reduced-motion: reduce) {
  .sk-dots i {
    animation: none;
    opacity: 0.8;
  }
}
</style>
