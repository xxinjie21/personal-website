import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 自定义页源码放在仓库根的 custom-pages/，Vite dev 会把 /custom-pages/xxx 按 .html 回落直接吐出源文件，
// 于是前端路由 /custom-pages/<slug> 被抢占。这里在 dev 里把这类请求改写回 SPA 入口。
const spaFallbackForRoutes = {
  name: 'spa-route-guard',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url || ''
      if (url.startsWith('/custom-pages/') && !url.endsWith('.html')) {
        req.url = '/'
      }
      next()
    })
  },
}

// 纯静态托管；Pages 子路径部署时用 VITE_BASE=/personal-website/ 覆盖
export default defineConfig({
  plugins: [vue(), spaFallbackForRoutes],
  base: process.env.VITE_BASE || '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          vendor: ['vue', 'vue-router'],
        },
      },
    },
  },
})
