<script setup>
// 左侧文件树：按 notes/ 目录层级折叠展示，支持过滤与学习状态点
import { computed, ref, watch } from 'vue'
import NoteTreeNode from './NoteTreeNode.vue'

const props = defineProps({
  notes: { type: Array, default: () => [] },
  activeSlug: { type: String, default: '' },
  keyword: { type: String, default: '' },
})
const emit = defineEmits(['select', 'update:keyword'])

// 展开状态只存在内存里：刷新后回到"顶层分区展开"的默认视图
const expanded = ref(new Set())

function topLevelDirs(list) {
  const set = new Set()
  for (const n of list) {
    const parts = n.rel.replace(/\.md$/, '').split('/')
    if (parts.length > 1) set.add(parts[0])
  }
  return set
}

// 首次进入：顶层分区展开，深层收起
expanded.value = topLevelDirs(props.notes)

function expandAncestors(slug) {
  const note = props.notes.find((n) => n.slug === slug)
  if (!note) return false
  const parts = note.rel.replace(/\.md$/, '').split('/').slice(0, -1)
  const s = new Set(expanded.value)
  let changed = false
  parts.forEach((_, i) => {
    const path = parts.slice(0, i + 1).join('/')
    if (!s.has(path)) {
      s.add(path)
      changed = true
    }
  })
  if (changed) {
    expanded.value = s
  }
  return changed
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

// 选中笔记时展开其所有父级目录（不接管用户已收起的层级）
watch(
  () => props.activeSlug,
  (slug) => {
    if (slug) expandAncestors(slug)
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
    <div class="tree-body">
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
