<script setup>
// 404：深链失效、手改错路径时落在这里，给一个同色系的“回家”出口
import { useRouter } from 'vue-router'

const router = useRouter()
const go = (path) => router.push(path)
</script>

<template>
  <section class="nf">
    <p class="nf-code mono">404</p>
    <h1 class="nf-title">这条路径没有笔记</h1>
    <p class="nf-hint">链接可能改了名字，或者笔记还在 Gitee 里、站点下次构建才同步过来。</p>
    <div class="nf-actions">
      <button type="button" class="btn-primary" @click="go('/notes')">去笔记库</button>
      <button type="button" class="nf-ghost" @click="go('/')">回首页</button>
    </div>
  </section>
</template>

<style scoped>
.nf {
  min-height: calc(100vh - var(--nav-height));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 24px 80px;
  text-align: center;
}
.nf-code {
  margin: 0;
  font-size: 52px;
  letter-spacing: 0.12em;
  color: var(--accent);
  opacity: 0.85;
  animation: nf-in 0.5s var(--ease) both;
}
.nf-title {
  margin: 0;
  font-family: 'Noto Serif SC', 'Playfair Display', serif;
  font-size: 24px;
  color: var(--text);
  animation: nf-in 0.5s var(--ease) 0.06s both;
}
.nf-hint {
  margin: 0 0 14px;
  max-width: 420px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-muted);
  animation: nf-in 0.5s var(--ease) 0.12s both;
}
.nf-actions {
  display: flex;
  gap: 10px;
  animation: nf-in 0.5s var(--ease) 0.18s both;
}
.nf-ghost {
  padding: 0 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  font-size: 12.5px;
  color: var(--text-dim);
  transition: border-color 0.25s var(--ease), color 0.25s var(--ease), background 0.25s var(--ease);
}
.nf-ghost:hover {
  border-color: rgba(217, 87, 26, 0.35);
  color: var(--text);
  background: #fffdfa;
}
@keyframes nf-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
