import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 纯静态托管（Cloudflare Pages / 任意静态服务器），base 用相对路径
export default defineConfig({
  plugins: [vue()],
  base: './',
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
