import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/User'

// Popout layout component (no sidebar)
const PopoutLayout = {
  template: '<router-view />'
}

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/recognize-popout',
    component: PopoutLayout,
    meta: { title: '识别画面' },
    children: [
      { path: '', name: 'recognize-popout', component: () => import('@/views/Recognize.vue'), meta: { title: '识别画面' } }
    ]
  },
  {
    path: '/',
    component: () => import('@/views/Workbench.vue'),
    meta: { requiresAuth: true },
    redirect: '/recognize',
    children: [
      { path: 'recognize', name: 'recognize', component: () => import('@/views/Recognize.vue'), meta: { requiresAuth: true, title: '病害识别' } },
      { path: 'annotation', name: 'annotation', component: () => import('@/views/Annotation.vue'), meta: { requiresAuth: true, title: '标注与训练' } },
      { path: 'models', name: 'models', component: () => import('@/views/Models.vue'), meta: { requiresAuth: true, title: '模型资产' } },
      { path: 'admin', name: 'admin', component: () => import('@/views/Admin.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '平台管理' } }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/recognize'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const store = useUserStore()

  // Skip auth check for popout route
  if (to.path === '/recognize-popout') {
    document.title = '识别画面'
    next()
    return
  }

  if (to.meta.requiresAuth && !store.isLoggedIn) {
    next('/login')
    return
  }

  if (to.path === '/login' && store.isLoggedIn) {
    next('/recognize')
    return
  }

  if (to.meta.requiresAdmin && !store.isAdmin) {
    next('/recognize')
    return
  }

  document.title = `植物病害识别平台 - ${to.meta.title || '首页'}`
  next()
})

export default router
