<script setup>
import { ref, onMounted } from 'vue'

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
</script>

<template>
  <section class="custom">
    <h1>自定义页面</h1>
    <p v-if="!pages.length" class="hint">暂无自定义页面。把 .html 放入 custom-pages/ 后重新构建即可自动识别。</p>
    <ul v-else class="list">
      <li v-for="p in pages" :key="p.file">
        <router-link :to="`/custom-pages/${p.slug}`">{{ p.title }}</router-link>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.hint {
  color: var(--text-muted);
}
.list {
  list-style: none;
  padding: 0;
}
.list li {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
</style>
