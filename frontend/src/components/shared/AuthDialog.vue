<template>
  <div
    v-if="open"
    class="auth-dialog"
    role="dialog"
    aria-modal="true"
    :aria-label="mode === 'register' ? '注册账号' : '登录账号'"
  >
    <button type="button" class="auth-dialog__backdrop" aria-label="关闭" @click="handleClose" />
    <section class="auth-dialog__panel">
      <div class="auth-dialog__hero">
        <div class="auth-dialog__hero-top">
          <BrandMark :compact="true" />
          <span class="auth-dialog__hero-badge">{{ mode === 'register' ? '田间记录|植病平台' : '田间记录|植病平台' }}</span>
        </div>
        <div class="auth-dialog__hero-copy">
          <h2>{{ mode === 'register' ? '创建你的工作台账号' : '返回工作台' }}</h2>
          <p>
            {{ mode === 'register'
              ? '注册一次即可在同一个工作台内使用识别、标注、训练和模型管理功能。'
              : '登录后可继续使用你的加密本地会话，并立即回到当前工作区。' }}
          </p>
        </div>
      </div>

      <div class="auth-dialog__form-wrap">
        <div class="auth-tabs" role="tablist" aria-label="认证模式">
          <button
            type="button"
            :class="['auth-tabs__tab', { 'is-active': mode === 'login' }]"
            @click="handleModeChange('login')"
          >
            登录
          </button>
          <button
            type="button"
            :class="['auth-tabs__tab', { 'is-active': mode === 'register' }]"
            @click="handleModeChange('register')"
          >
            注册
          </button>
        </div>

        <form class="auth-form" @submit.prevent="handleSubmit">
          <label v-if="mode === 'register'" class="field">
            <span>显示名称</span>
            <input v-model.trim="displayName" type="text" autocomplete="name" placeholder="请输入显示名称" />
          </label>

          <label class="field">
            <span>用户名</span>
            <input v-model.trim="username" type="text" autocomplete="username" placeholder="请输入用户名" />
          </label>

          <label class="field">
            <span>密码</span>
            <input v-model="password" type="password" autocomplete="current-password" placeholder="请输入密码" />
          </label>

          <p v-if="error" class="auth-form__error">{{ error }}</p>
          <p class="auth-form__privacy">
            账号凭证只会保留在你自己的后端，浏览器仅在加密的本地存储中保存会话令牌。
          </p>

          <div class="auth-form__actions">
            <button type="submit" class="primary" :disabled="loading || !canSubmit">
              {{ loading ? '处理中...' : mode === 'register' ? '创建账号' : '登录' }}
            </button>
            <button type="button" class="secondary" :disabled="loading" @click="handleClose">
              取消
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import BrandMark from '@/components/shared/BrandMark.vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'login',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  onClose: {
    type: Function,
    default: null,
  },
  onModeChange: {
    type: Function,
    default: null,
  },
  onLogin: {
    type: Function,
    default: null,
  },
  onRegister: {
    type: Function,
    default: null,
  },
})

const username = ref('')
const password = ref('')
const displayName = ref('')

const canSubmit = computed(() => {
  if (!username.value || !password.value) {
    return false
  }
  if (props.mode === 'register' && !displayName.value) {
    return false
  }
  return true
})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      password.value = ''
    }
  },
)

watch(
  () => props.mode,
  () => {
    password.value = ''
  },
)

function handleClose() {
  props.onClose?.()
}

function handleModeChange(nextMode) {
  props.onModeChange?.(nextMode)
}

async function handleSubmit() {
  if (!canSubmit.value) {
    return
  }

  const payload = {
    username: username.value,
    password: password.value,
    displayName: displayName.value,
  }

  if (props.mode === 'register') {
    await props.onRegister?.(payload)
    return
  }

  await props.onLogin?.(payload)
}
</script>
