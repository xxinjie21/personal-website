import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import NotesView from '../views/NotesView.vue'
import CustomPagesView from '../views/CustomPagesView.vue'

// 静态站点用 hash 路由，避免 Pages/本地文件刷新 404
const routes = [
  { path: '/', name: 'home', component: HomeView, meta: { title: '主页' } },
  { path: '/notes', name: 'notes', component: NotesView, meta: { title: 'Obsidian 笔记' } },
  { path: '/custom-pages/:page?', name: 'custom-pages', component: CustomPagesView, meta: { title: '自定义页面' } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 个人站点` : '个人站点'
})

export default router
