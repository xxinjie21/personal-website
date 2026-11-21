<script setup>
// 文件树节点（递归）：目录可折叠，文件显示学习状态点
import { computed } from 'vue'
import { normalizeStatus } from '../lib/graph.js'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  openPaths: { type: Object, default: () => ({}) },
  activeSlug: { type: String, default: '' },
})
const emit = defineEmits(['toggle', 'select'])

const dirs = computed(() => [...props.node.dirs.values()])
const isOpen = computed(() => !!props.openPaths[props.node.path])
const total = computed(() => {
  const count = (n) => n.files.length + [...n.dirs.values()].reduce((a, c) => a + count(c), 0)
  return count(props.node)
})
</script>

<template>
  <div class="group" :class="{ nest: depth > 0 }" :style="{ paddingLeft: depth ? '13px' : '0' }">
    <button
      v-if="node.name"
      class="dir"
      :class="'d' + Math.min(depth, 2)"
      type="button"
      :title="node.path"
      @click="emit('toggle', node.path)"
    >
      <span class="caret" :class="{ open: isOpen }">▸</span>
      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3.5 7.4A2 2 0 0 1 5.5 5.4h3.5l1.9 2.1h7.6a2 2 0 0 1 2 2v7.4a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z"
        />
      </svg>
      <span class="dir-name">{{ node.name }}</span>
      <span class="count">{{ total }}</span>
    </button>
    <div v-show="!node.name || isOpen">
      <NoteTreeNode
        v-for="dir in dirs"
        :key="dir.path"
        :node="dir"
        :depth="depth + 1"
        :open-paths="openPaths"
        :active-slug="activeSlug"
        @toggle="emit('toggle', $event)"
        @select="emit('select', $event)"
      />
      <button
        v-for="note in node.files"
        :key="note.slug"
        type="button"
        class="file"
        :class="{ active: note.slug === activeSlug }"
        :title="note.rel"
        :style="{ paddingLeft: (node.name ? 25 : 6) + 'px' }"
        @click="emit('select', note.slug)"
      >
        <span class="dot" :class="normalizeStatus(note.slug)"></span>
        <span class="file-name">{{ note.title }}</span>
      </button>
    </div>
  </div>
</template>

<script>
export default { name: 'NoteTreeNode' }
</script>

<style scoped>
.group {
  position: relative;
}
/* 层级导轨：每一层一条竖线，比缩进更好判断“谁在谁里面” */
.group.nest::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 2px;
  bottom: 2px;
  width: 1px;
  border-radius: 1px;
  background: linear-gradient(
    180deg,
    rgba(255, 169, 110, 0.18),
    rgba(255, 169, 110, 0.07) 70%,
    rgba(255, 169, 110, 0.16)
  );
  pointer-events: none;
}
.dir,
.file {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
/* 折角：从导轨接到这一行的名字 */
.dir.d1::before,
.dir.d2::before {
  content: '';
  position: absolute;
  left: -7px;
  top: 50%;
  width: 6px;
  height: 1px;
  background: rgba(255, 169, 110, 0.22);
}
.dir:hover,
.file:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
}
.dir-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  opacity: 0.6;
}
/* 文件夹图标：和文件行的“状态圆点”拉开差别 */
.ico {
  width: 13px;
  height: 13px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  opacity: 0.7;
}
.dir:hover .ico {
  opacity: 1;
}
.caret {
  display: inline-block;
  width: 11px;
  color: var(--accent-soft);
  opacity: 0.75;
  transition: transform 0.18s ease, color 0.18s ease, opacity 0.18s ease;
}
.dir:hover .caret {
  color: var(--accent);
  opacity: 1;
}
.caret.open {
  transform: rotate(90deg);
}
.file {
  color: var(--text);
}
.file.active {
  background: rgba(255, 122, 47, 0.15);
  box-shadow: inset 2px 0 0 var(--accent);
  color: var(--accent-cream);
}
.dir.d0 {
  margin-top: 8px;
  padding: 8px 8px 8px 6px;
  border-left: 2px solid rgba(255, 122, 47, 0.5);
  border-radius: 0 6px 6px 0;
  background: linear-gradient(90deg, rgba(255, 122, 47, 0.07), transparent 78%);
}
.dir.d0 .dir-name {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent-soft);
}
.dir.d0 .ico,
.dir.d0 .caret {
  color: var(--accent);
}
.dir.d0 .count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  opacity: 0.55;
}
.dir.d1 {
  margin-top: 3px;
}
.dir.d1 .dir-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}
.dir.d2 .dir-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-dim);
}
.dir.d1 .ico,
.dir.d2 .ico {
  color: var(--accent-soft);
}
.file {
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text-dim);
}
.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
</style>
