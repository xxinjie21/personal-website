import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 纯静态托管；Pages 子路径部署时用 VITE_BASE=/personal-website/ 覆盖
export default defineConfig({
  plugins: [vue()],
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
