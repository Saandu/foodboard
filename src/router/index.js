import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'
import { supabase } from '../supabase.js'
import { useStore } from '../stores/store.js'

const routes = [
  {
    path: '/',
    name: 'HomePage',
    component: () => import('../views/HomePage.vue')
  },
  {
    path: '/login',
    name: 'LoginPage',
    component: () => import('../views/LoginPage.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/register',
    name: 'RegisterPage',
    component: () => import('../views/LoginPage.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPasswordPage',
    component: () => import('../views/LoginPage.vue')
  },
  {
    path: '/reset-password',
    name: 'ResetPasswordPage',
    component: () => import('../views/ResetPasswordPage.vue')
  },
  {
    path: '/structures',
    name: 'StructuresPage',
    component: () => import('../views/StructuresPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/lists',
    name: 'ListsPage',
    component: () => import('../views/ListsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/categories',
    name: 'CategoriesProductsPage',
    component: () => import('../views/CategoriesProductsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/menu/:slug',
    name: 'CustomerMenu',
    component: () => import('../views/CustomerMenu.vue')
  },
  {
    path: '/404',
    name: 'ErrorPage',
    component: () => import('../views/ErrorPage.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession()
  const isAuthenticated = Boolean(session)

  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (to.meta.requiresGuest && isAuthenticated) {
    return next('/structures')
  }

  // Arriving at the marketing page with a live session goes straight to the
  // workspace. Only on entry: navigating home later is still allowed, so the
  // landing page stays reachable without signing out.
  if (to.path === '/' && isAuthenticated && from === START_LOCATION) {
    return next('/structures')
  }

  // Load the workspace before the shell renders. Without this a client-side
  // navigation into the dashboard — which is what the redirects above perform —
  // arrives with an empty store and no header.
  if (to.meta.requiresAuth && isAuthenticated) {
    await useStore().ensureSession()
  }

  next()
})

export default router
