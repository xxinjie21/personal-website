<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GraphCanvas from '../components/GraphCanvas.vue'
import { buildGraph } from '../lib/graph.js'
import { updateProgress } from '../lib/store.js'

const route = useRoute()
const router = useRouter()

const manifest = ref({ notes: [], edges: [], tags: [], customPages: [] })
const version = ref(0)
const activeTags = ref([])
const selectedId = ref(null)
const hovered = ref(null)
const layoutMode = ref('ring')

const STATUS_OPTIONS = [
  { value: 'not-started', label: '未开始' },
  { value: 'learning', label: '学习中' },
  { value: 'mastered', label: '已掌握' },
]

const graph = computed(() => {
  version.value // 依赖触发重算
  return buildGraph(manifest.value)
})
const nodes = computed(() => graph.value.nodes)
const edges = computed(() => graph.value.edges)
const counts = computed(() => graph.value.counts)
const tags = computed(() => graph.value.tags)
const selected = computed(() => (selectedId.value ? graph.value.nodeById.get(selectedId.value) : null))

function toggleTag(name) {
  const i = activeTags.value.indexOf(name)
  if (i >= 0) activeTags.value.splice(i, 1)
  else activeTags.value.push(name)
}

function onSelect(node) {
  selectedId.value = node ? node.id : null
  if (node) router.replace({ query: { note: node.id } })
  else router.replace({ query: {} })
}

function onHover(node) {
  hovered.value = node
}

function onStatusChange(ev) {
  if (!selectedId.value) return
  updateProgress({ noteStatus: { [selectedId.value]: ev.target.value } })
  version.value++
}

function statusLabel(s) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label || s
}

onMounted(async () => {
  try {
    const mod = await import('../data/site-manifest.json')
    manifest.value = mod.default
  } catch {
    manifest.value = { notes: [], edges: [], tags: [], customPages: [] }
  }
  if (route.query.note) selectedId.value = route.query.note
})
</script>

<template>
  <section class="home">
    <aside class="side left">
      <div class="panel">
        <h3>统计</h3>
        <div class="stats">
          <div class="stat"><span class="dot s-not-started"></span>未开始 <strong>{{ counts['not-started'] }}</strong></div>
          <div class="stat"><span class="dot s-learning"></span>学习中 <strong>{{ counts.learning }}</strong></div>
          <div class="stat"><span class="dot s-mastered"></span>已掌握 <strong>{{ counts.mastered }}</strong></div>
        </div>
      </div>
      <div class="panel">
        <h3>标签</h3>
        <p v-if="!tags.length" class="muted">暂无标签</p>
        <ul v-else class="tag-list">
          <li
            v-for="t in tags"
            :key="t.name"
            :class="{ active: activeTags.includes(t.name) }"
            @click="toggleTag(t.name)"
          >
            # {{ t.name }} <span class="muted">{{ t.count }}</span>
          </li>
        </ul>
      </div>
    </aside>

    <div class="canvas-wrap">
      <div class="toolbar">
        <button :class="{ on: layoutMode === 'ring' }" @click="layoutMode = 'ring'">环形布局</button>
        <button :class="{ on: layoutMode === 'force' }" @click="layoutMode = 'force'">力导向</button>
      </div>
      <GraphCanvas
        :nodes="nodes"
        :edges="edges"
        :active-tags="activeTags"
        :selected-id="selectedId"
        :layout-mode="layoutMode"
        @select="onSelect"
        @hover="onHover"
      />
      <div v-if="!nodes.length" class="empty">
        笔记库为空。把 Gitee Vault 挂到 <code>notes/</code> 后运行 <code>npm run parse</code> 生成图谱。
      </div>
      <div class="signature">昵称 · 一句话简介</div>
    </div>

    <aside class="side right">
      <div v-if="selected" class="panel preview">
        <h3>{{ selected.title }}</h3>
        <div class="muted path">{{ selected.rel }}</div>
        <div class="tags">
          <span v-for="t in selected.tags" :key="t" class="chip"># {{ t }}</span>
        </div>
        <label class="status">
          学习状态
          <select :value="selected.status" @change="onStatusChange">
            <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
        <button class="jump" @click="router.push({ path: '/notes', query: { note: selected.id } })">
          跳转 Obsidian 阅读页
        </button>
      </div>
      <div v-else class="panel muted">
        {{ hovered ? hovered.title : '点击节点查看详情' }}
      </div>
    </aside>
  </section>
</template>

<style scoped>
.home {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  gap: 16px;
  height: calc(100vh - var(--nav-height) - 48px);
}
.side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}
.panel {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
}
.panel h3 {
  margin: 0 0 10px;
  font-size: 15px;
}
.stats .stat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.stat strong {
  margin-left: auto;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.s-not-started { background: var(--status-not-started); }
.s-learning { background: var(--status-learning); }
.s-mastered { background: var(--status-mastered); }
.tag-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.tag-list li {
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
}
.tag-list li.active {
  background: var(--bg-elevated);
  color: var(--accent);
}
.canvas-wrap {
  position: relative;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  gap: 8px;
}
.toolbar button {
  background: var(--glass);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
}
.toolbar button.on {
  color: var(--accent);
  border-color: var(--accent);
}
.empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-muted);
  padding: 24px;
}
.signature {
  position: absolute;
  bottom: 12px;
  left: 16px;
  font-size: 13px;
  color: var(--text-muted);
}
.preview .path {
  font-size: 12px;
  margin-bottom: 8px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.chip {
  font-size: 12px;
  background: var(--bg-elevated);
  border-radius: 999px;
  padding: 2px 8px;
}
.status {
  display: block;
  font-size: 13px;
  margin-bottom: 12px;
}
.status select {
  display: block;
  margin-top: 4px;
  width: 100%;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 8px;
}
.jump {
  width: 100%;
  background: var(--accent);
  border: none;
  color: #fff;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
}
.muted {
  color: var(--text-muted);
}
</style>
