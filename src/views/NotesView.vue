<script setup>
// 阶段 3：三栏阅读视图 —— 左文件树 / 中多标签正文 / 右大纲 + 反向链接。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import manifest from '../data/site-manifest.json'
import NoteTree from '../components/NoteTree.vue'
import NoteReader from '../components/NoteReader.vue'
import { getProgress, updateProgress, initSync } from '../lib/store.js'
import { slugifyHeading } from '../lib/markdown.js'
import { normalizeStatus } from '../lib/graph.js'

const route = useRoute()
const router = useRouter()

const notes = manifest.notes || []
const noteBySlug = new Map(notes.map((n) => [n.slug, n]))

// 双链目标 → slug（与 parse / graph 规则一致）
const bySlug = new Map(notes.map((n) => [n.slug, n.slug]))
const byBase = new Map(notes.map((n) => [n.rel.replace(/\.md$/, '').split('/').pop(), n.slug]))
const byTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n.slug]))
const byAlias = new Map()
for (const n of notes) for (const a of n.aliases || []) byAlias.set(a.toLowerCase(), n.slug)

function resolveTarget(target) {
  const t = (target || '').trim().replace(/\.md$/, '')
  const base = t.split('/').pop()
  return bySlug.get(t) || bySlug.get(t.replace(/\//g, '-')) || byBase.get(base) || byTitle.get(t.toLowerCase()) || byAlias.get(t.toLowerCase()) || null
}

// 正文懒加载
const noteModules = import.meta.glob('../data/notes/*.json')
const loaded = ref(null)
const loading = ref(false)
const cache = new Map()

const TABS_KEY = 'pw-open-tabs'
const LAST_KEY = 'pw-last-note'
const tabs = ref([])
const activeSlug = ref('')
const keyword = ref('')
const lightbox = ref(null)

const progress = ref(getProgress())

function persistTabs() {
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs.value))
  } catch {}
}

function noteTitle(slug) {
  return noteBySlug.get(slug)?.title || slug
}

async function loadNote(slug) {
  if (!slug) {
    loaded.value = null
    return
  }
  const entry = noteBySlug.get(slug)
  if (!entry) return
  if (cache.has(slug)) {
    loaded.value = cache.get(slug)
    return
  }
  const key = `../data/notes/${entry.file}.json`
  const importer = noteModules[key]
  if (!importer) {
    loaded.value = null
    return
  }
  loading.value = true
  try {
    const mod = await importer()
    cache.set(slug, mod.default)
    loaded.value = mod.default
  } catch (err) {
    console.warn('[notes] 读取失败', slug, err)
    loaded.value = null
  } finally {
    loading.value = false
  }
}

function openNote(slug, { addTab = true } = {}) {
  if (!slug || !noteBySlug.has(slug)) return
  if (addTab && !tabs.value.includes(slug)) {
    tabs.value = [...tabs.value, slug].slice(-8)
  }
  activeSlug.value = slug
  persistTabs()
  try {
    localStorage.setItem(LAST_KEY, slug)
  } catch {}
  router.replace({ query: { ...route.query, note: slug } })
  loadNote(slug)
}

function closeTab(slug) {
  const idx = tabs.value.indexOf(slug)
  tabs.value = tabs.value.filter((s) => s !== slug)
  if (activeSlug.value === slug) {
    const next = tabs.value[Math.max(0, idx - 1)]
    if (next) openNote(next, { addTab: false })
    else {
      activeSlug.value = ''
      loaded.value = null
      router.replace({ query: { ...route.query, note: undefined } })
    }
  }
  persistTabs()
}

// 标签页右键菜单：关闭 / 关闭其他 / 关闭全部 / 复制链接 / 打开新窗口
const tabMenu = ref(null)
const MENU_W = 172
const MENU_H = 168

function openTabMenu(e, slug) {
  const x = Math.min(e.clientX, window.innerWidth - MENU_W - 8)
  const y = Math.min(e.clientY, window.innerHeight - MENU_H - 8)
  tabMenu.value = { x, y, slug }
}

function closeMenu(e) {
  if (e && e.target && e.target.closest && e.target.closest('.tab-menu')) return
  tabMenu.value = null
}

function menuCloseOthers() {
  const slug = tabMenu.value?.slug
  closeMenu()
  if (!slug) return
  tabs.value = [slug]
  if (activeSlug.value !== slug) openNote(slug, { addTab: false })
  persistTabs()
}

function menuCloseAll() {
  closeMenu()
  tabs.value = []
  activeSlug.value = ''
  loaded.value = null
  persistTabs()
  router.replace({ query: { ...route.query, note: undefined } })
}

async function menuCopyLink() {
  const slug = tabMenu.value?.slug
  closeMenu()
  if (!slug) return
  const url = `${location.origin}${location.pathname}#/notes?note=${encodeURIComponent(slug)}`
  try {
    await navigator.clipboard.writeText(url)
    toast.value = '链接已复制'
  } catch (err) {
    window.prompt('复制这个链接：', url)
  }
}

function menuOpenWindow() {
  const slug = tabMenu.value?.slug
  closeMenu()
  if (!slug) return
  const url = `${location.origin}${location.pathname}#/notes?note=${encodeURIComponent(slug)}`
  window.open(url, '_blank', 'noopener')
}

const toast = ref('')
let toastTimer = null
watch(toast, (v) => {
  clearTimeout(toastTimer)
  if (v) toastTimer = setTimeout(() => (toast.value = ''), 1600)
})

onMounted(() => {
  window.addEventListener('pointerdown', closeMenu, true)
  window.addEventListener('keydown', menuKey)
  window.addEventListener('scroll', closeMenu, true)
  window.addEventListener('resize', closeMenu)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', closeMenu, true)
  window.removeEventListener('keydown', menuKey)
  window.removeEventListener('scroll', closeMenu, true)
  window.removeEventListener('resize', closeMenu)
  clearTimeout(toastTimer)
})

function menuKey(e) {
  if (e.key === 'Escape') closeMenu()
}

// 双链跳转：未解析到的目标给出提示而不是崩溃
function followLink(target) {
  const slug = resolveTarget(target)
  if (slug) return openNote(slug)
  const base = (target || '').split('/').pop()
  if (window.confirm(`「${base}」这篇笔记还不存在，去新建吗？`)) {
    console.log('[notes] todo: create', target)
  }
}

// 大纲：按标题的编号语义重排层级，去掉书名重复项与“✅/❌/方式一”这类注脚噪声
const CN_SECTION = /^([一二三四五六七八九十]+)、/
const NUM_SECTION = /^(\d+)[.、]\s*/
const NUM_SUB = /^(\d+(?:\.\d+)+)/
const NOTE_LIKE = /^(方式|方案|做法|✅|❌|注意|示例|对比|优点|缺点|小结)/

function outlineDepth(text, rawLevel) {
  if (CN_SECTION.test(text)) return 1
  const sub = text.match(NUM_SUB)
  if (sub) return Math.min(3, sub[1].split('.').length)
  if (NUM_SECTION.test(text)) return 1
  if (NOTE_LIKE.test(text)) return 3
  return Math.min(3, rawLevel || 1)
}

const outline = computed(() => {
  const items = loaded.value?.headings || []
  const title = (loaded.value?.title || '').replace(/^\s*\d+\s*[-–]\s*/, '').replace(/\s+/g, '')
  const ids = new Map()
  const out = []
  let prev = 1
  items.forEach((h, i) => {
    const text = (h.text || '').trim()
    if (!text) return
    if (i === 0 && text.replace(/\s+/g, '').includes(title.slice(0, 8))) return
    if (out.length && out[out.length - 1].text === text) return
    const level = Math.min(outlineDepth(text, h.level), prev + 1)
    prev = level
    const base = slugifyHeading(h.text)
    const n = (ids.get(base) || 0) + 1
    ids.set(base, n)
    out.push({ text, level, id: n === 1 ? base : `${base}-${n}` })
  })
  return out
})

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Obsidian 式折叠大纲：有子标题的层级可展开/收起，收起后整枝隐藏
const collapsed = ref(new Set())
const outlineRows = computed(() => {
  const items = outline.value
  const stack = []
  const rows = items.map((h, i) => {
    const parent = stack[h.level - 1] ?? -1
    let hidden = false
    let p = parent
    while (p >= 0) {
      if (collapsed.value.has(items[p].id)) {
        hidden = true
        break
      }
      p = items[p].parent
    }
    stack[h.level] = i
    stack.length = h.level + 1
    return { ...h, parent, hidden }
  })
  rows.forEach((r, i) => {
    const next = rows[i + 1]
    r.hasChildren = !!next && next.level > r.level
  })
  return rows.filter((r) => !r.hidden)
})

function isCollapsed(id) {
  return collapsed.value.has(id)
}

function toggleCollapse(id) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

// 三栏：左右两栏都能拖宽、能收起，宽度和开合状态记在本地
const LAYOUT_KEY = 'notes-layout-v2'
const leftW = ref(250)
const rightW = ref(272)
const leftOpen = ref(true)
const rightOpen = ref(true)
const dragging = ref('')

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

try {
  const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}')
  if (typeof saved.leftW === 'number') leftW.value = clamp(saved.leftW, 190, 460)
  if (typeof saved.rightW === 'number') rightW.value = clamp(saved.rightW, 200, 480)
  if (typeof saved.leftOpen === 'boolean') leftOpen.value = saved.leftOpen
  if (typeof saved.rightOpen === 'boolean') rightOpen.value = saved.rightOpen
} catch (err) {
  /* 本地布局读不出来就退回默认 */
}

function saveLayout() {
  try {
    localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify({
        leftW: leftW.value,
        rightW: rightW.value,
        leftOpen: leftOpen.value,
        rightOpen: rightOpen.value,
      }),
    )
  } catch (err) {
    /* 隐私模式下写不进去不影响使用 */
  }
}

function togglePane(side) {
  if (side === 'left') leftOpen.value = !leftOpen.value
  else rightOpen.value = !rightOpen.value
  saveLayout()
}

// 拖动：按住分隔条横向拉，拉到很窄就吸附收起，从收起处往回拖就重新展开
const MIN_LEFT = 190
const MAX_LEFT = 460
const MIN_RIGHT = 200
const MAX_RIGHT = 480
const SNAP_CLOSE = 110

function startDrag(side, e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  const startX = e.clientX
  const isLeft = side === 'left'
  const startW = isLeft ? (leftOpen.value ? leftW.value : 0) : rightOpen.value ? rightW.value : 0
  // 从收起状态起手：先把栏打开到 0 宽，跟着手指长出来
  if (isLeft) {
    leftOpen.value = true
    leftW.value = startW
  } else {
    rightOpen.value = true
    rightW.value = startW
  }
  dragging.value = side
  let current = startW
  const max = isLeft ? MAX_LEFT : MAX_RIGHT
  const min = isLeft ? MIN_LEFT : MIN_RIGHT
  const move = (ev) => {
    const dx = ev.clientX - startX
    current = Math.max(0, Math.min(max, (isLeft ? startW + dx : startW - dx)))
    if (isLeft) leftW.value = current
    else rightW.value = current
  }
  const stop = () => {
    dragging.value = ''
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
    // 松手判定：没过吸附线就收起来，过了就落在一个可用的宽度上
    const open = current >= SNAP_CLOSE
    if (isLeft) {
      leftOpen.value = open
      leftW.value = open ? clamp(current, min, max) : Math.max(min, leftW.value)
    } else {
      rightOpen.value = open
      rightW.value = open ? clamp(current, min, max) : Math.max(min, rightW.value)
    }
    saveLayout()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
  window.addEventListener('pointercancel', stop)
}

const status = computed(() => (activeSlug.value ? normalizeStatus(activeSlug.value) : 'not-started'))
const STATUS_LABEL = { 'not-started': '未开始', learning: '学习中', mastered: '已掌握' }

function setStatus(value) {
  if (!activeSlug.value) return
  progress.value = updateProgress({ noteStatus: { [activeSlug.value]: value } })
}

const backlinks = computed(() => loaded.value?.backlinks || [])
const outlinks = computed(() => {
  const note = noteBySlug.get(activeSlug.value)
  return (note?.links || []).map((t) => ({ target: t, slug: resolveTarget(t) }))
})

function toggleLightbox(payload) {
  lightbox.value = payload
}

function onKey(e) {
  if (e.key === 'Escape') lightbox.value = null
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w' && activeSlug.value) {
    e.preventDefault()
    closeTab(activeSlug.value)
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  initSync().then(() => (progress.value = getProgress()))
  let saved = []
  try {
    saved = JSON.parse(localStorage.getItem(TABS_KEY) || '[]')
  } catch {}
  tabs.value = saved.filter((s) => noteBySlug.has(s))
  const fromQuery = String(route.query.note || '')
  let last = ''
  try {
    last = localStorage.getItem(LAST_KEY) || ''
  } catch {}
  if (fromQuery && noteBySlug.has(fromQuery)) openNote(fromQuery)
  // 地址里没带笔记：先回到上次关页面时看的那篇
  else if (last && noteBySlug.has(last)) openNote(last, { addTab: false })
  else if (tabs.value.length) openNote(tabs.value[0], { addTab: false })
  else {
    const first =
      notes.find((n) => n.rel.includes('00-考研总览')) ||
      notes.find((n) => n.rel.startsWith('考研/')) ||
      notes[0]
    if (first) openNote(first.slug)
  }
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(
  () => route.query.note,
  (slug) => {
    if (slug && slug !== activeSlug.value) openNote(String(slug))
  }
)
</script>

<template>
  <section class="notes-view" :class="{ dragging: !!dragging }">
    <button
      v-if="!leftOpen"
      type="button"
      class="edge-handle left"
      title="拖动或点击展开目录栏"
      @pointerdown="startDrag('left', $event)"
      @click="togglePane('left')"
    >
      <span>›</span>
    </button>

    <div class="pane pane-left" :class="{ closed: !leftOpen }" :style="{ width: leftOpen ? leftW + 'px' : '0px' }">
      <NoteTree
        class="pane-body"
        :style="{ width: leftW + 'px' }"
        :notes="notes"
        :active-slug="activeSlug"
        :keyword="keyword"
        @update:keyword="keyword = $event"
        @select="openNote($event)"
      />
    </div>

    <div
      class="splitter"
      :class="{ closed: !leftOpen, active: dragging === 'left' }"
      role="separator"
      aria-orientation="vertical"
      @pointerdown="startDrag('left', $event)"
      @dblclick="togglePane('left')"
    >
      <span class="splitter-grip"></span>
    </div>

    <main class="center">
      <div class="tabs">
        <button
          type="button"
          class="pane-toggle"
          :class="{ off: !leftOpen }"
          :title="leftOpen ? '收起目录栏' : '展开目录栏'"
          @click="togglePane('left')"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="2.5" y="4" width="15" height="12" rx="2" />
            <line x1="7.5" y1="4" x2="7.5" y2="16" />
          </svg>
        </button>
        <span class="tabs-brand">
          <i>LIBRARY</i>
          <b class="mono">{{ notes.length }}</b>
        </span>
        <button
          v-for="slug in tabs"
          :key="slug"
          type="button"
          class="tab"
          :class="{ active: slug === activeSlug }"
          :title="noteBySlug.get(slug)?.rel"
          @click="openNote(slug, { addTab: false })"
          @contextmenu.prevent="openTabMenu($event, slug)"
        >
          <span class="dot" :class="normalizeStatus(slug)"></span>
          <span class="tab-name">{{ noteTitle(slug) }}</span>
          <span class="tab-close" @click.stop="closeTab(slug)">×</span>
        </button>
        <span v-if="!tabs.length" class="tabs-empty">未打开笔记</span>
        <span class="tabs-spacer"></span>
        <span class="tabs-count">{{ notes.length }} 篇</span>
        <button
          type="button"
          class="pane-toggle"
          :class="{ off: !rightOpen }"
          :title="rightOpen ? '收起信息栏' : '展开信息栏'"
          @click="togglePane('right')"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="2.5" y="4" width="15" height="12" rx="2" />
            <line x1="12.5" y1="4" x2="12.5" y2="16" />
          </svg>
        </button>
      </div>

      <NoteReader
        :note="loaded"
        :loading="loading"
        :highlight="keyword"
        @open="followLink"
        @lightbox="toggleLightbox"
      />
    </main>

    <div
      class="splitter"
      :class="{ closed: !rightOpen, active: dragging === 'right' }"
      role="separator"
      aria-orientation="vertical"
      @pointerdown="startDrag('right', $event)"
      @dblclick="togglePane('right')"
    >
      <span class="splitter-grip"></span>
    </div>

    <div class="pane pane-right" :class="{ closed: !rightOpen }" :style="{ width: rightOpen ? rightW + 'px' : '0px' }">
      <aside class="rail pane-body" :style="{ width: rightW + 'px' }">
      <div class="rail-block">
        <div class="rail-head">
          <span><em class="rail-idx mono">01</em>学习状态</span>
        </div>
        <select
          class="status-select"
          :value="status"
          :disabled="!activeSlug"
          @change="setStatus($event.target.value)"
        >
          <option v-for="(label, key) in STATUS_LABEL" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>

      <div class="rail-block outline-block">
        <div class="rail-head">
          <span><em class="rail-idx mono">02</em>大纲</span>
          <span class="rail-count">{{ outline.length }}</span>
        </div>
        <ul v-if="outline.length" class="outline">
          <li
            v-for="h in outlineRows"
            :key="h.id"
            class="outline-item"
            :class="'lv' + h.level"
            :style="{
              paddingLeft: (h.level - 1) * 14 + 8 + 'px',
              '--rail': (h.level - 1) * 14 + 2 + 'px',
            }"
            @click="scrollTo(h.id)"
          >
            <button
              v-if="h.hasChildren"
              type="button"
              class="outline-caret"
              :class="{ open: !isCollapsed(h.id) }"
              :aria-label="isCollapsed(h.id) ? '展开' : '收起'"
              @click.stop="toggleCollapse(h.id)"
            >
              ▸
            </button>
            <span v-else class="outline-caret ghost"></span>
            <span class="outline-text">{{ h.text }}</span>
          </li>
        </ul>
        <p v-else class="rail-empty">暂无标题</p>
      </div>

      <div class="rail-block">
        <div class="rail-head">
          <span><em class="rail-idx mono">03</em>反向链接</span>
          <span class="rail-count">{{ backlinks.length }}</span>
        </div>
        <ul v-if="backlinks.length" class="links">
          <li v-for="b in backlinks" :key="b.slug">
            <button type="button" class="link" @click="openNote(b.slug)">{{ b.title }}</button>
          </li>
        </ul>
        <p v-else class="rail-empty">还没有其他笔记引用本篇</p>
      </div>

      <div class="rail-block">
        <div class="rail-head">
          <span><em class="rail-idx mono">04</em>出链</span>
          <span class="rail-count">{{ outlinks.length }}</span>
        </div>
        <ul v-if="outlinks.length" class="links">
          <li v-for="(l, i) in outlinks" :key="i">
            <button
              type="button"
              class="link"
              :class="{ missing: !l.slug }"
              @click="followLink(l.target)"
            >
              {{ l.target.split('/').pop() }}<span v-if="!l.slug" class="muted">（未创建）</span>
            </button>
          </li>
        </ul>
        <p v-else class="rail-empty">本篇没有双链</p>
      </div>
    </aside>
    </div>

    <button
      v-if="!rightOpen"
      type="button"
      class="edge-handle right"
      title="拖动或点击展开信息栏"
      @pointerdown="startDrag('right', $event)"
      @click="togglePane('right')"
    >
      <span>‹</span>
    </button>

    <div v-if="lightbox" class="lightbox" @click="lightbox = null">
      <img :src="lightbox.src" :alt="lightbox.alt" />
      <p class="lightbox-cap">{{ lightbox.alt }}</p>
    </div>

    <Teleport to="body">
      <Transition name="menu">
        <div
          v-if="tabMenu"
          class="tab-menu"
          :style="{ left: tabMenu.x + 'px', top: tabMenu.y + 'px' }"
          @pointerdown.stop
        >
          <button type="button" class="mi" @click="closeTab(tabMenu.slug)">
            <span>关闭</span>
            <em class="mini-key">Del</em>
          </button>
          <button type="button" class="mi" @click="menuCloseOthers()">
            <span>关闭其他</span>
          </button>
          <button type="button" class="mi" @click="menuCloseAll()">
            <span>关闭全部</span>
          </button>
          <div class="mi-sep"></div>
          <button type="button" class="mi" @click="menuCopyLink()">
            <span>复制笔记链接</span>
          </button>
          <button type="button" class="mi" @click="menuOpenWindow()">
            <span>在新窗口打开</span>
          </button>
        </div>
      </Transition>
      <Transition name="toast">
        <div v-if="toast" class="toast">{{ toast }}</div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.notes-view {
  display: flex;
  position: relative;
  height: calc(100vh - var(--nav-height));
  overflow: hidden;
}

/* 栏收起后，屏幕边留一条能抓的窄条：拖它拉宽，点它整栏回来 */
.edge-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 30;
  width: 14px;
  padding: 0;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  color: var(--accent-soft);
  background: linear-gradient(90deg, rgba(255, 122, 47, 0.16), rgba(255, 122, 47, 0));
  transition: background 0.22s var(--ease), color 0.22s var(--ease);
}
.edge-handle.left {
  left: 0;
}
.edge-handle.right {
  right: 0;
  background: linear-gradient(270deg, rgba(255, 122, 47, 0.16), rgba(255, 122, 47, 0));
}
.edge-handle span {
  font-size: 11px;
  opacity: 0.75;
  transform: translateY(-1px);
}
.edge-handle:hover {
  color: var(--accent-cream);
  background: rgba(255, 122, 47, 0.26);
}
.edge-handle:hover span {
  opacity: 1;
}

/* 可收起的栏：宽度动画收放，拖动时关掉过渡跟手 */
.pane {
  flex: none;
  overflow: hidden;
  min-height: 0;
  transition: width 0.34s var(--ease), opacity 0.26s var(--ease);
  will-change: width;
}
.pane.closed {
  opacity: 0;
}
.notes-view.dragging .pane {
  transition: none;
}
.pane-body {
  flex: none;
  height: 100%;
}

/* 分隔条：一条细线 + 中间的抓手点，hover 才亮起来 */
.splitter {
  flex: none;
  position: relative;
  width: 7px;
  margin: 0 -3px;
  z-index: 20;
  cursor: col-resize;
  touch-action: none;
  background: transparent;
}
.splitter::before {
  content: '';
  position: absolute;
  inset: 0 3px;
  background: rgba(255, 169, 110, 0.1);
  transition: background 0.22s var(--ease), box-shadow 0.22s var(--ease);
}
.splitter-grip {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 3px;
  height: 34px;
  transform: translate(-50%, -50%) scaleY(0.6);
  border-radius: 3px;
  background: rgba(255, 169, 110, 0.4);
  opacity: 0;
  transition: opacity 0.22s var(--ease), transform 0.22s var(--ease), background 0.22s var(--ease);
}
.splitter:hover::before,
.splitter.active::before {
  background: rgba(255, 122, 47, 0.55);
  box-shadow: 0 0 18px rgba(255, 122, 47, 0.45);
}
.splitter:hover .splitter-grip,
.splitter.active .splitter-grip {
  opacity: 1;
  transform: translate(-50%, -50%) scaleY(1);
  background: var(--accent-cream);
}
.splitter.active::before {
  background: var(--accent);
}
/* 收起之后分隔条还留在原地，抓手点常亮，提示这里能拖回来 */
.splitter.closed .splitter-grip {
  opacity: 1;
  transform: translate(-50%, -50%) scaleY(1);
  background: rgba(255, 176, 103, 0.55);
}
.splitter.closed:hover .splitter-grip {
  background: var(--accent-cream);
}

/* 右键菜单 */
.tab-menu {
  position: fixed;
  z-index: 900;
  width: 168px;
  padding: 6px;
  border: 1px solid rgba(255, 169, 110, 0.22);
  border-radius: 12px;
  background: rgba(20, 15, 12, 0.96);
  backdrop-filter: blur(18px);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 214, 184, 0.06);
}
.mi {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--text-dim);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s linear, color 0.15s linear;
}
.mi:hover {
  background: rgba(255, 122, 47, 0.16);
  color: var(--accent-cream);
}
.mi-sep {
  height: 1px;
  margin: 5px 4px;
  background: rgba(255, 169, 110, 0.14);
}
.mini-key {
  font-style: normal;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--muted);
  border: 1px solid rgba(255, 169, 110, 0.2);
  border-radius: 4px;
  padding: 1px 4px;
}
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.16s linear, transform 0.18s var(--ease);
  transform-origin: top left;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}
/* 复制成功的小提示 */
.toast {
  position: fixed;
  left: 50%;
  bottom: 38px;
  transform: translateX(-50%);
  z-index: 950;
  padding: 9px 16px;
  border: 1px solid rgba(255, 122, 47, 0.35);
  border-radius: 999px;
  background: rgba(26, 18, 14, 0.94);
  color: var(--accent-cream);
  font-size: 12px;
  letter-spacing: 0.02em;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.24s var(--ease), transform 0.24s var(--ease);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

/* 顶部开合按钮 */
.pane-toggle {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 169, 110, 0.05);
  color: var(--accent-soft);
  cursor: pointer;
  transition: color 0.2s var(--ease), border-color 0.2s var(--ease), background 0.2s var(--ease);
}
.pane-toggle svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  opacity: 0.9;
}
.pane-toggle:hover {
  color: var(--accent-cream);
  border-color: rgba(255, 122, 47, 0.5);
  background: rgba(255, 122, 47, 0.12);
}
.pane-toggle.off {
  color: var(--muted);
  border-color: rgba(255, 169, 110, 0.1);
}
.tabs-spacer {
  flex: 1 1 auto;
}
.center {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
}
.tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: rgba(18, 13, 10, 0.72);
  backdrop-filter: blur(16px);
  overflow-x: auto;
  flex: none;
}
.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border: 1px solid transparent;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}
.tab:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.04);
}
.tab.active {
  background: rgba(255, 122, 47, 0.08);
  border-color: rgba(255, 169, 110, 0.28);
  border-bottom-color: transparent;
  color: var(--accent-cream);
  box-shadow: inset 0 1px 0 rgba(255, 176, 103, 0.2);
}
.tab-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab-close {
  opacity: 0.5;
  padding: 0 2px;
}
.tab-close:hover {
  opacity: 1;
  color: #e0746b;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
}
.dot.not-started {
  background: var(--status-not-started);
}
.dot.learning {
  background: var(--status-learning);
}
.dot.mastered {
  background: var(--status-mastered);
}
.tabs-empty {
  font-size: 12px;
  color: var(--text-muted);
}
.tabs-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
.tabs-brand {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 0 12px 0 4px;
  margin-right: 4px;
  border-right: 1px solid var(--line);
  flex: none;
}
.tabs-brand i {
  font-style: normal;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--accent-soft);
}
.tabs-brand b {
  font-size: 11px;
  font-weight: 400;
  color: var(--muted);
}
.rail {
  background: linear-gradient(180deg, #14100d, #0d0a08);
  overflow: hidden;
  padding: 16px 14px 20px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.rail-block.outline-block {
  flex: 0 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.rail-block + .rail-block {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
.rail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-soft);
  margin-bottom: 10px;
}
.rail-idx {
  font-style: normal;
  font-size: 9px;
  margin-right: 8px;
  color: var(--muted);
  opacity: 0.75;
}
.rail-count {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 11px;
}
.rail-empty {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}
.status-select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 169, 110, 0.05);
  color: var(--text);
  font-size: 12px;
  outline: none;
  transition: border-color 0.3s var(--ease), box-shadow 0.3s var(--ease);
}
.status-select:focus {
  border-color: rgba(255, 122, 47, 0.55);
  box-shadow: 0 0 0 3px rgba(255, 122, 47, 0.1);
}
.outline {
  list-style: none;
  margin: 0;
  padding: 0 2px 0 0;
  flex: 0 1 auto;
  min-height: 0;
  max-height: 46vh;
  overflow-y: auto;
}
.outline-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 3px;
  padding: 3px 6px 3px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.16s var(--ease), color 0.16s var(--ease);
}
/* 每级父线上挂出的细导引线，连续多行自然接成一条 */
.outline-item.lv2::before,
.outline-item.lv3::before {
  content: '';
  position: absolute;
  left: var(--rail, 16px);
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 169, 110, 0.12);
}
.outline-caret {
  flex: none;
  width: 11px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-soft);
  font-size: 9px;
  line-height: 1;
  opacity: 0.7;
  cursor: pointer;
  transition: transform 0.18s var(--ease), opacity 0.18s var(--ease);
}
.outline-caret.open {
  transform: rotate(90deg);
}
.outline-caret.ghost {
  visibility: hidden;
}
.outline-caret:hover,
.outline-item:hover .outline-caret {
  opacity: 1;
  color: var(--accent);
}
.outline-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-top: 1px;
}
.outline-item.lv1 {
  margin-top: 2px;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--text);
}
.outline-item.lv2 {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-dim);
}
.outline-item.lv3 {
  font-size: 11.5px;
  color: var(--muted);
}
.outline-item:hover {
  background: rgba(255, 169, 110, 0.07);
  color: var(--accent-cream);
}
.links {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}
.link {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 11.5px;
  padding: 3px 0;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.link:hover {
  color: var(--accent);
}
.link.missing {
  color: var(--text-muted);
}
.muted {
  opacity: 0.6;
}
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 60;
  cursor: zoom-out;
}
.lightbox img {
  max-width: 86vw;
  max-height: 82vh;
  border-radius: 8px;
  background: #fff;
}
.lightbox-cap {
  color: #cfd3d8;
  font-size: 12px;
}
</style>
