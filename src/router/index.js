import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import NotesView from '../views/NotesView.vue'
import CustomPagesView from '../views/CustomPagesView.vue'
import NotFoundView from '../views/NotFoundView.vue'

// 干净路径路由（无 #）：本地 dev/preview 与带 SPA 回退的静态托管均可直接访问
const routes = [
  { path: '/', name: 'home', component: HomeView, meta: { title: '主页' } },
  { path: '/notes', name: 'notes', component: NotesView, meta: { title: 'Obsidian 笔记' } },
  { path: '/custom-pages/:page?', name: 'custom-pages', component: CustomPagesView, meta: { title: '自定义页面' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView, meta: { title: '页面不存在' } },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// 兼容旧分享链接：/#/notes?note=x → /notes?note=x
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1))
}

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 个人站点` : '个人站点'
})

export default router
