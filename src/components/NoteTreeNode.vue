<script setup>
// 文件树节点（递归）：目录可折叠，文件只做阅读入口
import { computed } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  openPaths: { type: Object, default: () => ({}) },
  activeSlug: { type: String, default: '' },
})
const emit = defineEmits(['toggle', 'select'])

const dirs = computed(() => [...props.node.dirs.values()])
const isOpen = computed(() => !!props.openPaths[props.node.path])
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
      <Icon name="chevron-right" class="caret" :class="{ open: isOpen }" :size="10" :weight="1.9" />
      <Icon name="folder" class="ico folder" :size="12" />
      <span class="dir-name">{{ node.name }}</span>
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
        :style="{ paddingLeft: (node.name ? (depth + 1) * 16 + 21 : 9) + 'px' }"
        @click="emit('select', note.slug)"
      >
        <Icon name="file" class="ico fileico" :size="11" />
        <span class="file-name">{{ note.title }}</span>
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
    rgba(217, 87, 26, 0.18),
    rgba(217, 87, 26, 0.05) 70%,
    transparent
  );
  pointer-events: none;
}

.dir,
.file {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding: 2px 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  line-height: 1.55;
  text-align: left;
  cursor: pointer;
  transition: background 0.16s var(--ease), color 0.16s var(--ease);
}
.dir:hover,
.file:hover {
  background: rgba(86, 56, 36, 0.045);
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
  font-size: 12.5px;
  font-weight: 600;
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

/* 图标：目录小文件夹、文件小纸张，和 Obsidian 一样靠图标区分类型 */
.ico {
  flex: none;
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linejoin: round;
  stroke-linecap: round;
  opacity: 1;
  transition: opacity 0.16s var(--ease), color 0.16s var(--ease);
}
.dir:hover .ico,
.file:hover .ico {
  opacity: 1;
}
.ico.folder {
  color: #a4551f;
}
.ico.fileico {
  color: #6f5f51;
  width: 11px;
  height: 11px;
  stroke-width: 1.5;
  opacity: 0.8;
}

/* 文件比目录暗一档 */
.file {
  color: var(--muted);
}
.file:hover {
  color: var(--text-dim);
}
.file.active {
  background: rgba(217, 87, 26, 0.14);
  color: var(--accent-cream);
}

.caret {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  opacity: 1;
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
