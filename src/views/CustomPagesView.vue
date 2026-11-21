<script setup>
import { ref, onMounted } from 'vue'
import Icon from '../components/Icon.vue'

// 页面清单由 build-script/parse.mjs 扫描 custom-pages/ 生成到 src/data/site-manifest.json
const pages = ref([])

onMounted(async () => {
  try {
    const mod = await import('../data/site-manifest.json')
    pages.value = mod.default.customPages || []
  } catch {
    pages.value = []
  }
})

// 卡片聚光：跟随光标的暖光斑（Uiverse spotlight card）
function spot(e) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}
</script>

<template>
  <section class="pages-view">
    <header class="head reveal">
      <p class="eyebrow">CUSTOM PAGES — HTML TOOLS</p>
      <h1>自己写的小工具，<em>都在这儿。</em></h1>
      <p class="lede">
        生词本、刷题页、临时看板……把单页 HTML 丢进
        <code>custom-pages/</code>，构建时自动收进来，不用改路由。
      </p>
    </header>

    <div v-if="pages.length" class="grid reveal reveal-d1">
      <router-link
        v-for="(p, i) in pages"
        :key="p.file"
        :to="`/custom-pages/${p.slug}`"
        class="card"
        @mousemove="spot"
      >
        <span class="idx mono">{{ String(i + 1).padStart(2, '0') }}</span>
        <h2>{{ p.title }}</h2>
        <span class="file mono">{{ p.file }}</span>
        <Icon name="arrow-up-right" class="go" :size="15" />
      </router-link>
    </div>

    <div v-else class="empty reveal reveal-d1">
      <div class="empty-glow"></div>
      <span class="plus" aria-hidden="true"><Icon name="plus" :size="24" :weight="2" /></span>
      <h2>还没有自定义页面</h2>
      <p>
        把 <code>.html</code> 放进 <code>custom-pages/</code>，再跑一次
        <code>npm run parse</code>，这里就会长出一张卡片。
      </p>
      <p class="mono hint">custom-pages/ · 0 files</p>
    </div>
  </section>
</template>

<style scoped>
.pages-view {
  max-width: 1180px;
  margin: 0 auto;
  padding: 56px 40px 120px;
}

.head {
  max-width: 680px;
  margin-bottom: 48px;
}
.head h1 {
  font-size: clamp(30px, 3.4vw, 46px);
  line-height: 1.2;
  margin: 16px 0 14px;
}
.head h1 em {
  font-style: normal;
  color: var(--accent);
  text-shadow: 0 0 42px rgba(217, 87, 26, 0.4);
}
.lede {
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--text-dim);
  margin: 0;
}
code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  padding: 1px 6px;
  border-radius: 5px;
  background: rgba(217, 87, 26, 0.09);
  color: var(--accent-cream);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 22px 22px 26px;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(252, 244, 234, 0.86));
  overflow: hidden;
  transition: transform 0.45s var(--ease), border-color 0.45s var(--ease),
    box-shadow 0.45s var(--ease);
}
.card::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  background: radial-gradient(120% 80% at 80% 0%, rgba(217, 87, 26, 0.22), transparent 60%);
  transition: opacity 0.45s var(--ease);
}
.card:hover {
  transform: translateY(-4px);
  border-color: rgba(217, 87, 26, 0.42);
  box-shadow: 0 26px 50px -26px rgba(217, 87, 26, 0.4);
}
.card:hover::before {
  opacity: 1;
}
/* 跟光：叠一层随光标移动的小亮点，卡片像有内衬反光 */
.card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(160px circle at var(--mx, 50%) var(--my, 50%), rgba(255, 200, 160, 0.14), transparent 70%);
  transition: opacity 0.4s var(--ease);
}
.card:hover::after {
  opacity: 1;
}
.card:active {
  transform: translateY(-2px) scale(0.995);
}
.idx {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--muted);
}
.card h2 {
  font-size: 20px;
  line-height: 1.35;
}
.file {
  font-size: 10.5px;
  color: var(--muted);
  word-break: break-all;
}
.go {
  position: absolute;
  right: 20px;
  bottom: 20px;
  color: var(--accent-soft);
  opacity: 0;
  transform: translate(-4px, 4px) rotate(-8deg);
  transition: all 0.4s var(--ease);
}
.card:hover .go {
  opacity: 1;
  transform: translate(0, 0) rotate(0);
}

.empty {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 76px 28px;
  border-radius: 22px;
  border: 1px dashed rgba(217, 87, 26, 0.24);
  background: rgba(217, 87, 26, 0.02);
  text-align: center;
  overflow: hidden;
}
.empty-glow {
  position: absolute;
  width: 520px;
  height: 320px;
  top: -140px;
  background: radial-gradient(closest-side, rgba(217, 87, 26, 0.08), transparent);
  pointer-events: none;
}
.plus {
  color: var(--accent-soft);
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 1px solid rgba(217, 87, 26, 0.28);
  display: grid;
  place-items: center;
  margin-bottom: 6px;
  box-shadow: 0 0 40px -12px rgba(217, 87, 26, 0.5);
}
.empty h2 {
  font-size: 20px;
}
.empty p {
  margin: 0;
  max-width: 440px;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--text-dim);
}
.hint {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--muted) !important;
  margin-top: 10px !important;
}

@media (max-width: 760px) {
  .pages-view {
    padding: 32px 18px 80px;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
