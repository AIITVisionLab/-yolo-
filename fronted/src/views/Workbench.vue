<!--工作台布局框架-->
<template>
  <div class="layout-shell" :class="{ 'user-layout': !isAdmin }">
    <aside class="sidebar">
      <div class="brand-block">
        <p class="brand-kicker">Plant Desk</p>
        <h1>植物病害识别</h1>
      </div>

      <nav class="nav-list">
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item">
          <span class="nav-copy">
            <span class="nav-title">{{ item.label }}</span>
            <small>{{ item.desc }}</small>
          </span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="user-card">
          <p>{{ username }}</p>
          <span>{{ isAdmin ? '管理员身份已启用' : '普通用户工作区' }}</span>
        </div>
        <button class="logout-btn" type="button" @click="handleLogout">退出登录</button>
      </div>
    </aside>

    <section class="main-area">
      <main class="view-area">
        <router-view />
      </main>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/User'
import { authApi } from '@/api'

const route = useRoute()
const router = useRouter()
const store = useUserStore()

const navItems = computed(() => {
  const base = [
    { to: '/recognize', label: '病害识别', short: '识别', desc: '上传、摄像头、录屏' },
    { to: '/annotation', label: '标注与训练', short: '标注', desc: '数据集、框标注、增强与训练' },
    { to: '/models', label: '模型资产', short: '模型', desc: '模型上传、切换、下载与删除' }
  ]

  if (store.isAdmin) {
    base.push({ to: '/admin', label: '平台管理', short: '管理', desc: '用户、资源与增强脚本治理' })
  }

  return base
})

const username = computed(() => store.userInfo?.username || '未登录用户')
const isAdmin = computed(() => store.isAdmin)
const currentMeta = computed(() => route.meta)
const currentHeading = computed(() => {
  const map = {
    '/recognize': '病害识别',
    '/annotation': '数据准备、标注与训练',
    '/models': '模型资产',
    '/admin': '管理员统一治理控制台'
  }

  return map[route.path] || '植物病害全流程工作台'
})

const handleLogout = async () => {
  try {
    await authApi.logout()
  } finally {
    store.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.layout-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  width: 100%;
  overflow-x: hidden;
  align-items: stretch;
}

.sidebar {
  position: sticky;
  top: 28px;
  left: 10px;
  height: calc(150vh - 56px);
  max-height: 720px;
  display: flex;
  flex-direction: column;
  padding: 22px 18px;
  background: #FFFCF3F5;
  color: var(--brand-green);
  border: 1px solid rgba(var(--brand-green-rgb), 0.08);
  min-width: 222px;
  max-width: 260px;
  width: 238px;
  align-self: stretch;
  border-radius: 28px;
  box-shadow: 12px 0 36px rgba(var(--brand-green-rgb), 0.08);
}

.brand-block {
  padding: 8px 8px 18px;
  border-bottom: 1px solid rgba(var(--brand-green-rgb), 0.08);
}

.brand-kicker {
  margin: 0 0 10px;
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(var(--brand-green-rgb), 0.58);
}

.brand-block h1 {
  margin: 0 0 18px;
  font-size: 30px;
  line-height: 1.12;
  font-family: var(--font-serif);
  color: var(--brand-green);
}

.logout-btn {
  width: 100%;
  border-radius: 999px;
  border: 1px solid rgba(var(--brand-green-rgb), 0.08);
  padding: 11px 14px;
  background: rgba(255, 252, 240, 0.88);
  color: var(--brand-green);
  font-weight: 500;
}

.nav-list {
  flex: 0 0 auto;
  display: grid;
margin: auto 0;
  gap: 12px;
  padding: auto 0;
  align-content: start;
}

.nav-item {
  display: grid;
  align-items: center;
  min-height: 82px;
  height: 82px;
  padding: 2px;
  border-radius: 14px;
  text-decoration: none;
  color: var(--brand-green);
  background: rgba(255, 252, 240, 0.74);
  box-shadow: 0 10px 26px rgba(var(--brand-green-rgb), 0.05);
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.user-layout .nav-item {
  min-height: 94px;
  height: 94px;
}

.nav-item:hover,
.nav-item.router-link-active {
  background: var(--text);
  color: rgba(255, 254, 249, 0.74);
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(var(--brand-green-rgb), 0.18);
}

.nav-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.nav-title {
  display: block;
  font-size: 18px;
  font-weight: 700;
  padding-left: 15px;
}

.nav-item small {
  display: block;
  line-height: 1.6;
  color: rgba(var(--brand-green-rgb), 0.58);
  font-size: 13px;
  margin-left: 15px;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
}

.nav-item.router-link-active small,
.nav-item:hover small {
  color: rgba(255, 252, 240, 0.72);
}

.sidebar-footer {
  margin-top: auto;
  display: grid;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid rgba(var(--brand-green-rgb), 0.08);
}

.user-card {
  padding: 0 2px 8px;
  border-radius: 0;
  background: transparent;
}

.user-card p,
.user-card span {
  margin: 0;
}

.user-card p {
  font-weight: 700;
  margin-bottom: 6px;
}

.user-card span {
  font-size: 13px;
  color: rgba(var(--brand-green-rgb), 0.62);
}

.main-area {
  padding: 28px 25px 34px;
  min-width: 0;
}

.topbar {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-end;
  padding-bottom: 20px;
}

.topbar-kicker {
  margin: 0 0 8px;
  color: var(--text-soft);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 12px;
}

.topbar h2 {
  margin: 0;
  font-size: clamp(30px, 4vw, 45px);
  line-height: 1.06;
  font-family: var(--font-serif);
}

.view-area {
  padding-top: 8px;
  min-width: 0;
}

@media (max-width: 1080px) {
  .layout-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    min-height: auto;
    height: auto;
    max-height: none;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
