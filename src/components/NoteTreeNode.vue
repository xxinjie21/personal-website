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
  <div class="group" :class="{ nest: depth > 0 }" :style="{ '--depth': depth }">
    <button
      v-if="node.name"
      class="dir"
      :class="'d' + Math.min(depth, 3)"
      type="button"
      :title="node.path"
      :style="{ paddingLeft: depth * 16 + 'px' }"
      @click="emit('toggle', node.path)"
    >
      <span class="caret" :class="{ open: isOpen }">▸</span>
      <span class="dir-name">{{ node.name }}</span>
      <span v-if="depth <= 2" class="count">{{ total }}</span>
    </button>
    <Transition name="fold">
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
        :style="{ paddingLeft: (node.name ? (depth + 1) * 16 + 6 : 6) + 'px' }"
        @click="emit('select', note.slug)"
      >
        <span class="file-name">{{ note.title }}</span>
        <span class="dot" :class="normalizeStatus(note.slug)"></span>
      </button>
      </div>
    </Transition>
  </div>
</template>

<script>
export default { name: 'NoteTreeNode' }
</script>

<style scoped>
/* 参照 Obsidian 的大纲观感：只有缩进 + 极细导轨 + 三角，靠层级和留白区分，不加装饰 */
.group {
  position: relative;
}
/* 层级导轨：每一层在父目录的 caret 下方拉一条极淡的竖线，层级一眼看出来 */
.group.nest::before {
  content: '';
  position: absolute;
  left: calc(var(--depth) * 16px - 5px);
  top: 3px;
  bottom: 3px;
  width: 1px;
  background: linear-gradient(
    180deg,
    rgba(255, 169, 110, 0.18),
    rgba(255, 169, 110, 0.05) 70%,
    transparent
  );
  pointer-events: none;
}

.dir,
.file {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 3px 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-dim);
  font-size: 12.5px;
  line-height: 1.7;
  text-align: left;
  cursor: pointer;
  transition: background 0.16s var(--ease), color 0.16s var(--ease);
}
.dir:hover,
.file:hover {
  background: rgba(255, 246, 238, 0.045);
  color: var(--text);
}

.dir-name,
.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 目录比文件亮一档、厚一档：层级先靠颜色拉开，再靠缩进 */
.dir.d1 .dir-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.dir.d2 .dir-name {
  font-weight: 600;
  color: var(--text-dim);
}
.dir.d3 .dir-name {
  font-weight: 500;
  color: var(--text-dim);
}
.dir:hover .dir-name {
  color: var(--text);
}

/* 文件最暗，行首一个小小的 # 作为笔记标记（很淡，只在 hover 亮起） */
.file {
  color: var(--muted);
}
.file::before {
  content: '#';
  flex: none;
  width: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: rgba(255, 169, 110, 0.42);
  transition: color 0.16s var(--ease);
}
.file:hover::before {
  color: var(--accent-soft);
}
.file.active {
  background: linear-gradient(90deg, rgba(255, 122, 47, 0.16), rgba(255, 122, 47, 0.04));
  box-shadow: inset 2px 0 0 var(--accent);
  color: var(--accent-cream);
}

.caret {
  flex: none;
  width: 10px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: var(--text-dim);
  opacity: 0.9;
  transition: transform 0.22s var(--ease), color 0.16s linear, opacity 0.16s linear;
}
.dir:hover .caret {
  color: var(--accent-soft);
  opacity: 1;
}
.caret.open {
  transform: rotate(90deg);
}

.count {
  flex: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  color: var(--muted);
  opacity: 0.55;
}
.dir:hover .count {
  opacity: 0.85;
  color: var(--accent-soft);
}

.dot {
  flex: none;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  opacity: 0.8;
}
.dot.not-started {
  background: var(--status-not-started);
  opacity: 0.35;
}
.dot.learning {
  background: var(--status-learning);
}
.dot.mastered {
  background: var(--status-mastered);
}

/* 目录展开/收起：子级整体轻微下滑淡入，收起时反向 */
.fold-enter-active,
.fold-leave-active {
  transition: opacity 0.2s var(--ease), transform 0.24s var(--ease);
  transform-origin: top center;
}
.fold-enter-from,
.fold-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
