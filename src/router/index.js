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

// 浏览器标签固定显示 XXJ（不随页面变，保持标签短而稳）
router.afterEach(() => {
  document.title = 'XXJ'
})

// 页面转场：用 View Transitions 让旧页淡出、新页上浮，替掉原来 out-in 的空白间隔
// 浏览器不支持时不做转场，直接切换
const canViewTransition = typeof document.startViewTransition === 'function'

if (canViewTransition) {
  let running = false
  for (const method of ['push', 'replace']) {
    const original = router[method].bind(router)
    router[method] = (to, ...rest) => {
      // 只有换页面才转场，同一个页面里换笔记直接切
      const path = router.resolve(to).path
      if (running || path === router.currentRoute.value.path) return original(to, ...rest)
      running = true
      let nav
      const vt = document.startViewTransition(() => {
        nav = original(to, ...rest)
        return nav
      })
      return vt.finished
        .finally(() => {
          running = false
        })
        .then(() => nav)
    }
  }
}

export default router
