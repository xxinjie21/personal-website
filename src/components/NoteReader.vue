<script setup>
// 单篇笔记正文：Markdown + KaTeX 渲染、图片灯箱、双链点击、关键词高亮
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { renderMarkdown, enhanceRendered } from '../lib/markdown.js'

const props = defineProps({
  note: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  highlight: { type: String, default: '' },
})
const emit = defineEmits(['open', 'lightbox'])

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
function onScroll(e) {
  const el = e.currentTarget
  const total = el.scrollHeight - el.clientHeight
  prog.value = total > 8 ? Math.min(1, Math.max(0, el.scrollTop / total)) : 0
}
</script>

<template>
  <div class="reader" @scroll="onScroll">
    <span class="read-bar" :style="{ transform: `scaleX(${prog})` }" aria-hidden="true"></span>
    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="!note" class="state">
      <p class="state-title">还没有打开任何笔记</p>
      <p class="state-hint">从左侧目录选一篇，或在首页图谱里点一个节点。</p>
    </div>
    <article v-else class="article">
      <header class="head">
        <p class="crumb">{{ note.rel }}</p>
        <h1 class="title">{{ note.title }}</h1>
        <div class="meta">
          <span v-for="tag in note.tags" :key="tag" class="tag">#{{ tag }}</span>
          <span v-for="alias in note.aliases" :key="alias" class="alias">别名：{{ alias }}</span>
        </div>
      </header>
      <div ref="bodyRef" class="markdown" v-html="html"></div>
    </article>
  </div>
</template>

<style scoped>
.reader {
  min-height: 0;
  overflow-y: auto;
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
  background: linear-gradient(90deg, rgba(255, 122, 47, 0), var(--accent) 45%, var(--accent-cream));
  transform-origin: 0 50%;
  transition: transform 0.12s linear;
  box-shadow: 0 0 10px rgba(255, 122, 47, 0.5);
  pointer-events: none;
}
.article {
  max-width: 820px;
  margin: 0 auto;
  padding-top: 34px;
}
.state {
  padding: 60px 0;
  color: var(--text-muted);
  text-align: center;
}
.state-title {
  color: var(--text);
  font-size: 15px;
  margin-bottom: 6px;
}
.crumb {
  margin: 0 0 6px;
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
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
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 122, 47, 0.13);
  border: 1px solid rgba(255, 122, 47, 0.22);
  color: var(--accent-soft);
}
.alias {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-muted);
}
</style>
