<script setup>
import { onMounted, ref, computed } from 'vue'
import { initSync, getSyncStatus } from '../lib/store.js'

// 28 考研初试：2027 年 12 月下旬（占位 12-21，临近再校准）
const EXAM_DATE = new Date('2027-12-21T00:00:00+08:00')
const today = new Date()
const daysLeft = computed(() => {
  const ms = EXAM_DATE - today
  return Math.max(0, Math.ceil(ms / 86400000))
})

const statusLabel = computed(() => {
  const s = getSyncStatus()
  return { idle: '未同步', syncing: '同步中', online: '已同步', offline: '本地模式', error: '同步异常' }[s] || s
})

onMounted(() => {
  initSync()
})
</script>

<template>
  <header class="nav">
    <div class="nav-left">
      <button class="nav-btn" title="搜索（Ctrl+K，待接入）">🔍</button>
      <router-link to="/" class="nav-link">主页</router-link>
      <router-link to="/notes" class="nav-link">Obsidian 笔记</router-link>
      <router-link to="/custom-pages" class="nav-link">自定义页面</router-link>
      <a class="nav-link" href="https://github.com" target="_blank" rel="noopener">GitHub</a>
    </div>
    <div class="nav-right">
      <span class="sync" :class="getSyncStatus()">{{ statusLabel }}</span>
      <span class="countdown">距 28 考研初试 {{ daysLeft }} 天</span>
    </div>
  </header>
  <main class="content">
    <slot />
  </main>
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  height: var(--nav-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--glass);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  z-index: 100;
}
.nav-left,
.nav-right {
  display: flex;
  align-items: center;
  gap: 18px;
}
.nav-link {
  color: var(--text);
  font-size: 15px;
}
.nav-link.router-link-active {
  color: var(--accent);
}
.nav-btn {
  background: none;
  border: none;
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
}
.countdown {
  font-size: 13px;
  color: var(--text-muted);
}
.sync {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-muted);
}
.sync.online {
  color: var(--status-mastered);
}
.sync.offline {
  color: var(--status-learning);
}
.content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 20px;
}
</style>
