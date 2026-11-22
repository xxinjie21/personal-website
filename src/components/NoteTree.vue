<script setup>
// 左侧文件树：按 notes/ 目录层级折叠展示，支持过滤与学习状态点
import { computed, nextTick, ref, watch } from 'vue'
import NoteTreeNode from './NoteTreeNode.vue'

const props = defineProps({
  notes: { type: Array, default: () => [] },
  activeSlug: { type: String, default: '' },
  keyword: { type: String, default: '' },
})
const emit = defineEmits(['select', 'update:keyword'])

// 展开状态只存在内存里：进入笔记库时只展开当前笔记的父级目录，其余全部收起
const expanded = ref(new Set())

function topLevelDirs(list) {
  const set = new Set()
  for (const n of list) {
    const parts = n.rel.replace(/\.md$/, '').split('/')
    if (parts.length > 1) set.add(parts[0])
  }
  return set
}

// 没有当前笔记时才退回"顶层分区展开"的默认视图；有则直接只展开它的祖先，首帧就定好
expanded.value = props.activeSlug ? ancestorsOf(props.activeSlug) || new Set() : topLevelDirs(props.notes)

// 首次定位：只保留当前笔记所在路径（祖先展开，其余全部收起）
// 之后切笔记只补展开祖先，不再动用户手动展开的分区
function ancestorsOf(slug) {
  const note = props.notes.find((n) => n.slug === slug)
  if (!note) return null
  const parts = note.rel.replace(/\.md$/, '').split('/').slice(0, -1)
  const set = new Set()
  parts.forEach((_, i) => set.add(parts.slice(0, i + 1).join('/')))
  return set
}

function focusAncestors(slug) {
  const next = ancestorsOf(slug)
  if (!next) return
  expanded.value = next
}

function expandAncestors(slug) {
  const next = ancestorsOf(slug)
  if (!next || [...next].every((p) => expanded.value.has(p))) return
  expanded.value = new Set([...expanded.value, ...next])
}

function buildTree(list) {
  const root = { name: '', path: '', dirs: new Map(), files: [] }
  for (const note of list) {
    const parts = note.rel.replace(/\.md$/, '').split('/')
    let node = root
    parts.slice(0, -1).forEach((seg, i) => {
      const path = parts.slice(0, i + 1).join('/')
      if (!node.dirs.has(seg)) node.dirs.set(seg, { name: seg, path, dirs: new Map(), files: [] })
      node = node.dirs.get(seg)
    })
    node.files.push(note)
  }
  return root
}

const filtered = computed(() => {
  const kw = props.keyword.trim().toLowerCase()
  if (!kw) return props.notes
  return props.notes.filter(
    (n) => n.title.toLowerCase().includes(kw) || n.rel.toLowerCase().includes(kw)
  )
})

const tree = computed(() => buildTree(filtered.value))

// 过滤时全部展开，避免命中结果藏在折叠目录里
const openPaths = computed(() => {
  if (props.keyword.trim()) return new Proxy({}, { get: () => true })
  const map = {}
  for (const path of expanded.value) map[path] = true
  return map
})

function toggle(path) {
  const s = new Set(expanded.value)
  if (s.has(path)) s.delete(path)
  else s.add(path)
  expanded.value = s
}

// 选中笔记时只展开它的父级目录，其余文件夹收起，并把它滚到树栏中间
const bodyEl = ref(null)

function scrollToActive(smooth = true) {
  const body = bodyEl.value
  const el = body?.querySelector('.file.active')
  if (!body || !el) return
  const r = el.getBoundingClientRect()
  const b = body.getBoundingClientRect()
  const top = body.scrollTop + r.top - b.top - (b.height - r.height) / 2
  body.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
}

// 进入笔记库的第一次定位才收拢目录，之后只补展开；首帧已有当前笔记就不再收一次
let focusedOnce = Boolean(props.activeSlug)
let scrolledOnce = false

watch(
  () => props.activeSlug,
  async (slug) => {
    if (slug) {
      if (!focusedOnce) {
        focusAncestors(slug)
        focusedOnce = true
      } else {
        expandAncestors(slug)
      }
    }
    await nextTick()
    scrollToActive(scrolledOnce)
    scrolledOnce = true
  },
  { immediate: true }
)
</script>

<template>
  <aside class="tree">
    <div class="tree-head">
      <span class="eyebrow">NOTES</span>
      <b class="mono">{{ notes.length }}</b>
    </div>
    <div class="tree-search">
      <input
        :value="keyword"
        type="search"
        placeholder="筛选笔记…"
        @input="emit('update:keyword', $event.target.value)"
      />
    </div>
    <div ref="bodyEl" class="tree-body">
      <NoteTreeNode
        :node="tree"
        :open-paths="openPaths"
        :active-slug="activeSlug"
        @toggle="toggle"
        @select="emit('select', $event)"
      />
      <p v-if="!notes.length" class="empty">笔记库为空（notes/ 为占位子模块或未拉取）</p>
      <p v-else-if="!filtered.length" class="empty">无匹配结果</p>
    </div>
  </aside>
</template>

<style scoped>
.tree {
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #fffdfa, #f8f1e8);
  border-right: 1px solid var(--border);
  box-shadow: inset -14px 0 28px -30px rgba(85, 53, 28, 0.35);
  min-height: 0;
  overflow: hidden;
}
.tree-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 14px 14px 8px;
}
.tree-head .eyebrow {
  font-size: 9.5px;
  letter-spacing: 0.2em;
}
.tree-head b {
  font-size: 10.5px;
  font-weight: 400;
  color: var(--muted);
}
.tree-search {
  padding: 10px;
  border-bottom: 1px solid var(--border);
}
.tree-search input {
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 12px;
  outline: none;
}
.tree-search input:focus {
  border-color: rgba(217, 87, 26, 0.55);
  box-shadow: 0 0 0 3px rgba(217, 87, 26, 0.1);
}
.tree-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 6px 24px;
}
.empty {
  padding: 12px;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
