<script setup>
import { onMounted, ref, computed } from 'vue'
import { initSync, getSyncStatus } from '../lib/store.js'

// 28 考研初试：2027 年 12 月下旬（占位 12-21，临近再校准）
const EXAM_DATE = new Date('2027-12-21T00:00:00+08:00')
const daysLeft = computed(() => {
  const ms = EXAM_DATE - new Date()
  return Math.max(0, Math.ceil(ms / 86400000))
})

// 数字滚动入场
const shownDays = ref(0)
onMounted(() => {
  initSync()
  const target = daysLeft.value
  const t0 = performance.now()
  const dur = 900
  const step = () => {
    const p = Math.min(1, (performance.now() - t0) / dur)
    const e = 1 - Math.pow(1 - p, 3)
    shownDays.value = Math.round(target * e)
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
})

const statusKey = computed(() => getSyncStatus())
const statusLabel = computed(
  () => ({ idle: '未同步', syncing: '同步中', online: '已同步', offline: '本地模式', error: '同步异常' }[statusKey.value] || statusKey.value)
)

const links = [
  { to: '/', label: '首页', en: 'HOME' },
  { to: '/notes', label: '笔记库', en: 'LIBRARY' },
  { to: '/custom-pages', label: '自定义页', en: 'PAGES' },
]
</script>

<template>
  <header class="topbar">
    <router-link to="/" class="brand">
      <span class="mark"><i></i></span>
      <span class="brand-text">
        <b>ZISHIKU</b>
        <em>个人知识库</em>
      </span>
    </router-link>

    <nav class="nav">
      <router-link v-for="(l, i) in links" :key="l.to" :to="l.to" class="nav-link">
        <i>0{{ i + 1 }}</i>
        <span>{{ l.label }}</span>
      </router-link>
    </nav>

    <div class="meta">
      <span class="sync" :class="statusKey">
        <i class="dot"></i>
        {{ statusLabel }}
      </span>
      <div class="countdown">
        <span class="cd-label">距 28 考研初试</span>
        <b class="mono">{{ shownDays }}</b>
        <span class="cd-unit">天</span>
      </div>
    </div>
  </header>

  <main class="content">
    <slot />
  </main>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--nav-height);
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 0 24px;
  background: rgba(11, 9, 8, 0.68);
  backdrop-filter: blur(22px) saturate(130%);
  -webkit-backdrop-filter: blur(22px) saturate(130%);
  border-bottom: 1px solid transparent;
  border-image: linear-gradient(90deg, transparent, rgba(255, 169, 110, 0.22), transparent) 1;
}

/* 品牌 */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.mark {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: conic-gradient(from 140deg, #ff5e22, #ffb067, #7a3d1d, #ff5e22);
  box-shadow: 0 0 24px -4px rgba(255, 122, 47, 0.6);
}
.mark::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: #0b0908;
}
.mark i {
  position: relative;
  z-index: 1;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-cream);
  box-shadow: 0 0 12px rgba(255, 176, 103, 0.9);
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.brand-text b {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.18em;
  font-weight: 500;
  color: var(--text);
}
.brand-text em {
  font-style: normal;
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.08em;
}

/* 导航 */
.nav {
  display: flex;
  align-items: center;
  gap: 4px;
}
.nav-link {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 999px;
  color: var(--text-dim);
  transition: color 0.3s var(--ease), background 0.3s var(--ease);
}
.nav-link i {
  font-family: 'JetBrains Mono', monospace;
  font-style: normal;
  font-size: 9px;
  color: var(--muted);
  opacity: 0.7;
}
.nav-link span {
  font-size: 13.5px;
}
.nav-link em {
  font-style: normal;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  letter-spacing: 0.14em;
  color: var(--muted);
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.3s var(--ease), transform 0.3s var(--ease);
}
.nav-link:hover {
  color: var(--text);
  background: rgba(255, 169, 110, 0.06);
}
.nav-link:hover em {
  opacity: 0.8;
  transform: translateY(0);
}
.nav-link.router-link-active {
  color: var(--accent-cream);
}
.nav-link.router-link-active::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 2px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  box-shadow: 0 0 10px rgba(255, 122, 47, 0.8);
}
.nav-link.router-link-active em {
  opacity: 0.55;
  color: var(--accent-soft);
}

/* 右侧 */
.meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}
.sync {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--muted);
  background: rgba(255, 246, 238, 0.03);
}
.sync .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--muted);
}
.sync.online {
  color: var(--status-mastered);
  border-color: rgba(255, 94, 44, 0.3);
}
.sync.online .dot {
  background: var(--status-mastered);
  box-shadow: 0 0 8px rgba(255, 94, 44, 0.9);
}
.sync.offline {
  color: var(--accent-soft);
  border-color: rgba(255, 176, 103, 0.3);
}
.sync.offline .dot {
  background: var(--accent-soft);
}
.sync.syncing .dot {
  background: var(--accent);
  animation: blink 1s infinite;
}
@keyframes blink {
  50% {
    opacity: 0.2;
  }
}

.countdown {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-left: 16px;
  border-left: 1px solid var(--line);
}
.cd-label {
  font-size: 10.5px;
  color: var(--muted);
  letter-spacing: 0.06em;
}
.countdown b {
  font-size: 20px;
  font-weight: 500;
  color: var(--accent-cream);
  letter-spacing: 0.02em;
  text-shadow: 0 0 26px rgba(255, 122, 47, 0.5);
}
.cd-unit {
  font-size: 10.5px;
  color: var(--muted);
}

.content {
  min-height: calc(100vh - var(--nav-height));
}

@media (max-width: 1180px) {
  .nav-link em {
    display: none;
  }
  .brand-text em {
    display: none;
  }
}
@media (max-width: 900px) {
  .topbar {
    gap: 16px;
    padding: 0 14px;
  }
  .nav-link {
    padding: 8px 8px;
  }
  .nav-link i {
    display: none;
  }
  .cd-label {
    display: none;
  }
  .countdown {
    padding-left: 10px;
    gap: 3px;
  }
  .countdown b {
    font-size: 16px;
  }
  .sync {
    display: none;
  }
}
@media (max-width: 620px) {
  .brand-text {
    display: none;
  }
  .nav-link span {
    font-size: 12.5px;
  }
}
</style>
