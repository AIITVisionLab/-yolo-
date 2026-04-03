<template>
  <div class="app-shell">
    <header v-if="!isAuthenticated" class="topbar">
      <BrandMark :compact="true" />
      <div class="topbar__actions">
        <button type="button" class="secondary" @click="openAuth('login')">
          登录
        </button>
        <button type="button" class="primary" @click="openAuth('register')">
          注册
        </button>
      </div>
    </header>

    <div v-if="isAuthenticated" class="console-shell console-shell--sidebar">
      <aside class="console-rail">
        <div class="console-rail__brand">
          <BrandMark :compact="true" />
        </div>

        <div class="console-rail__workspace">
          <span>{{ workspaceMeta.groupLabel || '工作区' }} / {{ workspaceMeta.step || '--' }}</span>
          <strong>{{ workspaceMeta.label }}</strong>
          <p>{{ workspaceMeta.hint || workspaceMeta.focusTitle || workspaceMeta.summary }}</p>
          <div class="console-rail__badges" aria-label="会话摘要">
            <span class="console-rail__badge">{{ healthSummary }}</span>
            <span class="console-rail__badge">{{ securitySummary }}</span>
          </div>
        </div>

        <WorkspaceNav
          :items="visibleWorkspaces"
          :active-workspace="activeWorkspace"
          :on-change-workspace="handleWorkspaceChange"
          :can-show-admin="canShowAdmin"
          layout="rail"
        />

        <div class="console-rail__session">
          <div class="topbar__user">
            <strong>{{ currentUser?.display_name || currentUser?.username || '已登录' }}</strong>
            <span>{{ currentUser?.role === 'admin' ? '管理员' : '普通用户' }}</span>
          </div>
          <button type="button" class="secondary" @click="handleLogout">
            退出登录
          </button>
        </div>
      </aside>

      <main class="workspace__main workspace__main--full console-stage">
        <section class="workspace__canvas-shell workspace__canvas-shell--full">
          <component :is="currentWorkspaceComponent" :key="activeWorkspace" v-bind="workspaceProps" />
        </section>
      </main>
    </div>

    <main v-else class="landing">
      <section class="landing__hero">
        <div class="landing__copy landing__copy--compact">
          <div class="landing__badge-row">
            <p class="eyebrow">植物病害工作台</p>
            <span class="landing__stamp">加密会话</span>
          </div>
          <h1>登录后进入工作台</h1>
          <p class="landing__lead">
            识别、标注、训练和模型管理都集中在同一个工作台中，本地会话令牌仅保存在浏览器的加密存储里。
          </p>

          <div class="landing__actions">
            <button type="button" class="primary" @click="openAuth('login')">
              立即登录
            </button>
            <button type="button" class="secondary" @click="openAuth('register')">
              创建账号
            </button>
          </div>

          <div class="landing__trust" aria-label="登录状态">
            <span>{{ healthSummary }}</span>
            <span>{{ securitySummary }}</span>
          </div>
        </div>
      </section>
    </main>

    <AuthDialog
      :open="authOpen"
      :mode="authMode"
      :loading="authLoading"
      :error="authError"
      :on-close="closeAuth"
      :on-mode-change="setAuthMode"
      :on-login="handleLogin"
      :on-register="handleRegister"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AuthDialog from '@/components/shared/AuthDialog.vue'
import BrandMark from '@/components/shared/BrandMark.vue'
import WorkspaceNav from '@/components/shared/WorkspaceNav.vue'
import { DEFAULT_WORKSPACE, WORKSPACES, getWorkspaceMeta } from '@/appConfig'
import { requestApi } from '@/lib/api'
import { useSession } from '@/composables/useSession'
import { getWorkspaceComponent } from '@/workspaces/registry'

const session = useSession()

const authOpen = ref(false)
const authMode = ref('login')
const hasPromptedAuth = ref(false)
const health = ref({
  state: 'checking',
  message: '正在检查后端状态',
  data: null,
})
const recognitionPayload = ref(null)
const workspace = ref(DEFAULT_WORKSPACE)

const currentUser = computed(() => session.user.value)
const currentToken = computed(() => session.token.value)
const authError = computed(() => session.error.value)
const authLoading = computed(() => session.status.value === 'authenticating')
const isAuthenticated = computed(() => session.isAuthenticated.value)
const canShowAdmin = computed(() => currentUser.value?.role === 'admin')
const activeWorkspace = computed(() => {
  if (currentUser.value?.role === 'admin' || workspace.value !== 'admin') {
    return workspace.value
  }
  return DEFAULT_WORKSPACE
})
const workspaceMeta = computed(() => getWorkspaceMeta(activeWorkspace.value))
const visibleWorkspaces = computed(() => {
  return WORKSPACES.filter((item) => canShowAdmin.value || item.id !== 'admin')
})
const healthSummary = computed(() => {
  if (health.value.state === 'online') return '系统就绪'
  if (health.value.state === 'offline') return '后端离线'
  return '连接中'
})
const securitySummary = computed(() => {
  return isAuthenticated.value ? '加密会话' : '加密存储'
})

const currentWorkspaceComponent = computed(() => {
  return getWorkspaceComponent(activeWorkspace.value)
})

const workspaceProps = computed(() => {
  const baseProps = {
    token: currentToken.value,
    isAuthenticated: isAuthenticated.value,
  }

  if (activeWorkspace.value === 'recognition') {
    return {
      ...baseProps,
      initialPayload: recognitionPayload.value,
      onPredictionReady: setRecognitionPayload,
      onOpenAnnotation: () => {
        workspace.value = 'annotation'
      },
    }
  }

  if (activeWorkspace.value === 'annotation') {
    return {
      ...baseProps,
      recognitionPayload: recognitionPayload.value,
    }
  }

  if (activeWorkspace.value === 'details') {
    return {
      ...baseProps,
      user: currentUser.value,
      health: health.value,
    }
  }

  if (activeWorkspace.value === 'admin') {
    return {
      ...baseProps,
      user: currentUser.value,
    }
  }

  return baseProps
})

function openAuth(mode = 'login') {
  authMode.value = mode
  authOpen.value = true
}

function closeAuth() {
  authOpen.value = false
}

function setAuthMode(mode) {
  authMode.value = mode
}

function setRecognitionPayload(payload) {
  recognitionPayload.value = payload
}

function handleWorkspaceChange(nextWorkspace) {
  const nextMeta = getWorkspaceMeta(nextWorkspace)

  if (!isAuthenticated.value) {
    workspace.value = nextMeta.id
    openAuth('login')
    return
  }

  if (!canShowAdmin.value && nextMeta.id === 'admin') {
    return
  }

  workspace.value = nextMeta.id
}

async function handleLogin({ username, password }) {
  await session.login({ username, password })
  closeAuth()
}

async function handleRegister({ username, password, displayName }) {
  await session.register({
    username,
    password,
    display_name: displayName,
  })
  closeAuth()
}

async function handleLogout() {
  await session.logout()
  workspace.value = DEFAULT_WORKSPACE
}

watch([session.isAuthenticated, session.isReady], ([isAuth, isReady]) => {
  if (isAuth) {
    hasPromptedAuth.value = false
    return
  }

  if (!isReady || hasPromptedAuth.value) {
    return
  }

  authMode.value = 'login'
  authOpen.value = true
  hasPromptedAuth.value = true
})

watch(workspace, (nextWorkspace) => {
  const params = new URLSearchParams(window.location.search)
  params.set('workspace', nextWorkspace)
  const nextSearch = params.toString()
  window.history.replaceState({}, '', `${window.location.pathname}?${nextSearch}`)
})

watch([session.isAuthenticated, session.user], ([isAuth, user]) => {
  if (!isAuth) return
  if (user?.role !== 'admin' && workspace.value === 'admin') {
    workspace.value = DEFAULT_WORKSPACE
  }
})

let healthInterval = null
let healthController = null

async function loadHealth() {
  if (healthController) {
    healthController.abort()
  }

  healthController = new AbortController()

  try {
    const payload = await requestApi('/health', {
      token: currentToken.value,
      signal: healthController.signal,
    })

    health.value = {
      state: 'online',
      message: payload?.message || '后端服务可用',
      data: payload?.data || null,
    }
  } catch (error) {
    if (healthController.signal.aborted) return

    health.value = {
      state: 'offline',
      message: error.message || '后端服务不可用',
      data: null,
    }
  }
}

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const workspaceParam = params.get('workspace')
  if (workspaceParam) {
    workspace.value = getWorkspaceMeta(workspaceParam).id
  }

  loadHealth()
  healthInterval = window.setInterval(loadHealth, 15000)
})

onUnmounted(() => {
  if (healthInterval) {
    window.clearInterval(healthInterval)
  }
  if (healthController) {
    healthController.abort()
  }
})
</script>
