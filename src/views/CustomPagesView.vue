<script setup>
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'

// 页面清单由 build-script/parse.mjs 扫描 custom-pages/ 生成到 src/data/site-manifest.json
const pages = ref([])
const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.page || '')
// 记住最后打开的那个自定义页：列表页给一条「继续上次」，卡片上挂个角标
const LAST_KEY = 'custom:last'
const lastSlug = ref('')
const lastPage = computed(() => pages.value.find((p) => p.slug === lastSlug.value) || null)

// 点卡片时记下缩略窗的位置，交给页面框架做共享元素转场的起点
const shellEl = ref(null)
const enterFrom = ref(null)
const frameStyle = ref({})

onMounted(async () => {
  try {
    const mod = await import('../data/site-manifest.json')
    pages.value = mod.default.customPages || []
  } catch {
    pages.value = []
  }
  if (!slug.value) {
    try {
      lastSlug.value = localStorage.getItem(LAST_KEY) || ''
    } catch {
      lastSlug.value = ''
    }
  }
})

// 不管从卡片、导航还是直接敲地址进来，都算「最后打开的一页」
watch(
  slug,
  async (v) => {
    if (!v) {
      enterFrom.value = null
      frameStyle.value = {}
      return
    }
    lastSlug.value = v
    try {
      localStorage.setItem(LAST_KEY, v)
    } catch {
      /* 隐私模式下写不进就算了 */
    }
    if (!enterFrom.value) return
    // 共享元素转场：页面框架先从卡片缩略窗的位置长到整页，再归位
    await nextTick()
    const frame = shellEl.value?.querySelector('.page-frame')
    const from = enterFrom.value
    enterFrom.value = null
    if (!frame) return
    const to = frame.getBoundingClientRect()
    if (!to.width || !to.height) return
    frameStyle.value = {
      opacity: 1,
      transformOrigin: '0 0',
      transform: `translate(${from.x - to.left}px, ${from.y - to.top}px) scale(${from.w / to.width}, ${from.h / to.height})`,
      borderRadius: '12px',
      transition: 'none',
    }
    // 先让起始姿态真正落到 DOM 上，再切到终态，否则两帧并成一帧就没有过渡
    await nextTick()
    void frame.offsetWidth
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    frameStyle.value = {
      opacity: 1,
      transformOrigin: '0 0',
      transform: 'none',
      borderRadius: '0 0 12px 12px',
      transition: 'transform 0.52s cubic-bezier(.22,.9,.28,1), border-radius 0.52s ease',
    }
  },
  { immediate: true }
)

// 点卡片时记下缩略窗的位置，交给页面框架做转场起点
function openPage(p, e) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
  const thumb = e.currentTarget.querySelector('.thumb')
  if (!thumb) return
  e.preventDefault()
  const r = thumb.getBoundingClientRect()
  enterFrom.value = { x: r.left, y: r.top, w: r.width, h: r.height }
  remember(p)
  router.push(`/custom-pages/${p.slug}`)
}

function remember(p) {
  lastSlug.value = p.slug
  try {
    localStorage.setItem(LAST_KEY, p.slug)
  } catch {
    /* 隐私模式下写不进就算了，不影响打开 */
  }
}

const current = computed(() => pages.value.find((p) => p.slug === slug.value) || null)
// 副本文件名与路由同名会被 dev server 的 .html 回落抢占（/custom-pages/x 直接返回 x.html），
// 所以静态副本放在 pagedocs/ 目录，路由保持 /custom-pages/<slug>
const frameSrc = computed(() => `${import.meta.env.BASE_URL}pagedocs/${slug.value}.html`)
// iframe 首帧出来后淡入，避免白屏硬切
const frameReady = ref(false)
watch(slug, () => (frameReady.value = false))
// 卡片聚光 + 轻微倾斜：光标位置决定暖光斑和高光角度（Uiverse spotlight card）
function spot(e) {
  const r = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - r.left
  const y = e.clientY - r.top
  e.currentTarget.style.setProperty('--mx', `${x}px`)
  e.currentTarget.style.setProperty('--my', `${y}px`)
  e.currentTarget.style.setProperty('--rx', `${((y / r.height) - 0.5) * -9}deg`)
  e.currentTarget.style.setProperty('--ry', `${((x / r.width) - 0.5) * 9}deg`)
}
function untilt(e) {
  e.currentTarget.style.setProperty('--rx', '0deg')
  e.currentTarget.style.setProperty('--ry', '0deg')
}

// 悬停实时预览：第一次指向卡片才加载该页的 iframe，之后复用
const thumbOn = ref({})
const thumbReady = ref({})
const thumbSrc = (s) => `${import.meta.env.BASE_URL}pagedocs/${s}.html`
function warmThumb(p) {
  // 触屏没有悬停，别为了一次轻触去拉整页 iframe
  if (!window.matchMedia('(hover: hover)').matches) return
  if (!thumbOn.value[p.slug]) thumbOn.value = { ...thumbOn.value, [p.slug]: true }
}
function thumbLoaded(p) {
  if (!thumbReady.value[p.slug]) thumbReady.value = { ...thumbReady.value, [p.slug]: true }
}
</script>

<template>
  <section v-if="slug" ref="shellEl" class="page-shell">
    <iframe
      :src="frameSrc"
      :title="current?.title || slug"
      class="page-frame"
      :class="{ ready: frameReady }"
      :style="frameStyle"
      @load="frameReady = true"
    />
  </section>

  <section v-else class="pages-view">
    <header class="head reveal">
      <p class="eyebrow">CUSTOM PAGES — SINGLE-FILE TOOLS</p>
      <h1>一页一件小事，<em>都放在这里。</em></h1>
      <p class="lede">
        背单词、刷题、临时对照……每件小事写成一个独立 HTML，丢进
        <code>custom-pages/</code> 就会自动收进来，不用配路由；鼠标停上去先看一眼，点开就是原页。
      </p>
      <router-link v-if="lastPage" class="resume" :to="`/custom-pages/${lastPage.slug}`">
        <span class="dot" aria-hidden="true"></span>
        <span>继续上次 · <b>{{ lastPage.title }}</b></span>
        <Icon name="arrow-right" :size="13" />
      </router-link>
    </header>

    <div v-if="pages.length" class="grid reveal reveal-d1">
      <router-link
        v-for="(p, i) in pages"
        :key="p.file"
        :to="`/custom-pages/${p.slug}`"
        class="card"
        @mousemove="spot"
        @pointerleave="untilt"
        @click="openPage(p, $event)"
        @pointerenter="warmThumb(p)"
        @focusin="warmThumb(p)"
      >
        <span class="thumb">
          <span class="ph" aria-hidden="true">
            <span class="pnum mono">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="phint mono phint-m">HOVER TO PREVIEW</span>
            <span class="phint mono phint-t">TAP TO OPEN</span>
          </span>
          <iframe
            v-if="thumbOn[p.slug]"
            :src="thumbSrc(p.slug)"
            class="tf"
            :class="{ on: thumbReady[p.slug] }"
            :title="`${p.title} 实时预览`"
            tabindex="-1"
            aria-hidden="true"
            loading="lazy"
            @load="thumbLoaded(p)"
          />
          <span class="tov">
            <span class="topen">打开<Icon name="arrow-up-right" :size="12" /></span>
          </span>
          <span v-if="p.slug === lastSlug" class="last mono">上次打开</span>
        </span>
        <span class="meta">
          <h2>{{ p.title }}</h2>
          <span class="file mono">{{ p.file }}</span>
        </span>
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
.page-shell {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--nav-height));
  box-sizing: border-box;
  padding: 0 10px 8px;
}
.page-frame {
  flex: 1;
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 0 0 12px 12px;
  background: var(--panel-solid);
  box-shadow: var(--shadow);
  opacity: 0.001;
  transform: translateY(6px) scale(0.997);
  transition: opacity 0.2s ease, transform 0.24s var(--ease);
}
.page-frame.ready {
  opacity: 1;
  transform: none;
}
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
/* 继续上次：从列表直接回到最后打开的那一页 */
.resume {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 7px 11px 7px 10px;
  border-radius: 10px;
  border: 1px solid rgba(217, 87, 26, 0.24);
  background: rgba(255, 253, 249, 0.78);
  font-size: 12px;
  color: var(--text-dim);
  transition: transform 0.3s var(--ease), border-color 0.3s var(--ease),
    background 0.3s var(--ease), box-shadow 0.3s var(--ease), color 0.3s;
}
.resume b {
  font-weight: 600;
  color: var(--ink);
}
.resume .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 0 rgba(217, 87, 26, 0.4);
  animation: liveDot 2.4s ease-out infinite;
}
@keyframes liveDot {
  0% {
    box-shadow: 0 0 0 0 rgba(217, 87, 26, 0.35);
  }
  60% {
    box-shadow: 0 0 0 7px rgba(217, 87, 26, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(217, 87, 26, 0);
  }
}
.resume:hover {
  transform: translateY(-1px);
  border-color: rgba(217, 87, 26, 0.44);
  background: #fffefb;
  box-shadow: 0 14px 28px -22px rgba(217, 87, 26, 0.6);
}
.resume:hover .dot {
  background: var(--accent-cream);
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
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  max-width: 800px;
}
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 9px 9px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(252, 244, 234, 0.86));
  overflow: hidden;
  transform-style: preserve-3d;
  will-change: transform;
  --mx: 78%;
  --my: 16%;
  transition: transform 0.45s var(--ease), border-color 0.45s var(--ease),
    box-shadow 0.45s var(--ease);
}
/* 大团暖光跟着光标走（用 transform 平移，不重绘渐变） */
.card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  width: 320px;
  height: 320px;
  margin: -160px 0 0 -160px;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(closest-side, rgba(217, 87, 26, 0.15), rgba(217, 87, 26, 0.06) 48%, transparent 72%);
  transform: translate3d(var(--mx), var(--my), 0);
  transition: opacity 0.45s var(--ease);
  will-change: transform;
}
.card:hover {
  transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateY(-4px);
  border-color: rgba(217, 87, 26, 0.42);
  box-shadow: 0 26px 50px -26px rgba(217, 87, 26, 0.4);
  transition: transform 0.16s ease-out, border-color 0.3s var(--ease),
    box-shadow 0.3s var(--ease);
}
.card:hover::before {
  opacity: 1;
}
/* 跟光：叠一层随光标移动的小亮点，卡片像有内衬反光 */
.card::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(170px circle at var(--mx, 50%) var(--my, 50%), rgba(255, 205, 165, 0.2), transparent 70%);
  transition: opacity 0.4s var(--ease);
}
.card:hover::after {
  opacity: 1;
}
.card:active {
  transform: translateY(-2px) scale(0.995);
}

/* 缩略窗口：悬停时才把该页 iframe 装进来，等比缩小成预览 */
.thumb {
  position: relative;
  z-index: 1;
  display: block;
  aspect-ratio: 16 / 10;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  isolation: isolate;
  border: 1px solid rgba(120, 84, 54, 0.1);
}
.ph {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: radial-gradient(120% 90% at 72% 8%, rgba(217, 87, 26, 0.13), transparent 62%),
    linear-gradient(160deg, #f7eee1, #fffdf9);
}
.pnum {
  font-size: 30px;
  letter-spacing: 0.1em;
  color: rgba(120, 84, 54, 0.26);
}
.phint {
  position: absolute;
  left: 12px;
  bottom: 11px;
  font-size: 8.5px;
  letter-spacing: 0.2em;
  color: rgba(120, 84, 54, 0.42);
  transition: opacity 0.3s;
}
.phint-t {
  display: none;
}
.card:hover .phint {
  opacity: 0;
}
.tf {
  position: absolute;
  top: 0;
  left: 0;
  width: 312.5%;
  height: 312.5%;
  border: 0;
  transform: scale(0.32);
  transform-origin: 0 0;
  pointer-events: none;
  background: #fff;
  opacity: 0;
  transition: opacity 0.36s ease;
}
.tf.on {
  opacity: 1;
}
.card:hover .tf.on {
  transform: scale(0.325);
  transition: opacity 0.36s ease, transform 0.5s var(--ease);
}
.tov {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 9px;
  background: linear-gradient(180deg, rgba(28, 25, 23, 0) 52%, rgba(28, 25, 23, 0.26));
  opacity: 0;
  transition: opacity 0.3s ease;
}
.card:hover .tov {
  opacity: 1;
}
.topen {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 20px;
  background: rgba(255, 253, 249, 0.94);
  color: var(--ink);
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 12px 26px -16px rgba(0, 0, 0, 0.55);
  transform: translateY(6px);
  transition: transform 0.34s var(--ease);
}
.card:hover .topen {
  transform: none;
}
.meta {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 10px 2px;
}
.idx {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--muted);
}
.last {
  position: absolute;
  z-index: 4;
  top: 10px;
  right: 10px;
  padding: 2px 7px;
  border-radius: 20px;
  border: 1px solid rgba(217, 87, 26, 0.26);
  background: rgba(255, 251, 244, 0.9);
  backdrop-filter: blur(6px);
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--accent);
  animation: lastIn 0.5s var(--ease) both;
}
@keyframes lastIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.card h2 {
  font-size: 20px;
  line-height: 1.35;
}
.file {
  font-size: 10.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  /* 触屏没有悬停：不做实时预览，卡片收短一些 */
  .thumb {
    aspect-ratio: 2 / 1;
  }
  .tf,
  .tov {
    display: none;
  }
  .phint-m {
    display: none;
  }
  .phint-t {
    display: inline;
  }
  .last {
    top: 8px;
    right: 8px;
  }
}
</style>
