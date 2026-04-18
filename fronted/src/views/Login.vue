<!--user登陆注册-->
<template>
  <div class="login-page">
    <section class="login-shell">
      <section class="auth-panel">
        <div class="panel-header">
          <p class="eyebrow">欢迎回来</p>
          <h2>{{ isLogin ? '登录工作台' : '创建新账号' }}</h2>
          <p>{{ isLogin ? '可使用现有账号进行体验' : '注册后将自动进入识别工作区。' }}</p>
        </div>

        <div class="tab-row">
          <button :class="{ active: isLogin }" @click="switchMode(true)">登录</button>
          <button :class="{ active: !isLogin }" @click="switchMode(false)">注册</button>
        </div>

        <form class="auth-form" autocomplete="off" @submit.prevent="handleSubmit">
          <label>
            <span>用户名</span>
            <input v-model.trim="username" type="text" placeholder="请输入用户名" required />
          </label>

          <label>
            <span>密码</span>
            <div class="password-input-wrapper">
              <input v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="请输入密码" required />
              <button type="button" class="password-toggle" @click="showPassword = !showPassword" tabindex="-1">
                {{ showPassword ? '隐藏' : '查看' }}
              </button>
            </div>
          </label>

          <button class="submit-btn" type="submit" :disabled="loading">
            {{ loading ? '正在处理...' : isLogin ? '进入工作台' : '创建并进入' }}
          </button>

          <p v-if="error" class="message error">{{ error }}</p>
          <p v-else class="message hint"></p>
        </form>
      </section>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/api'
import { useUserStore } from '@/stores/User'

const router = useRouter()
const userStore = useUserStore()

const isLogin = ref(true)
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

const switchMode = (value) => {
  isLogin.value = value
  error.value = ''
}

const handleSubmit = async () => {
  loading.value = true
  error.value = ''

  try {
    const result = isLogin.value
      ? await authApi.login(username.value, password.value)
      : await authApi.register(username.value, password.value)

    userStore.setAuth(result)
    router.push('/recognize')
  } catch (err) {
    error.value = err.message || '提交失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  isolation: isolate;
  min-height: 100svh;
  width: 100%;
  display: grid;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 18%, rgba(var(--brand-green-rgb), 0.1), transparent 28%),
    radial-gradient(circle at 86% 76%, rgba(185, 175, 145, 0.18), transparent 30%),
    linear-gradient(135deg, rgba(255, 253, 246, 0.92), rgba(248, 244, 229, 0.82));
}

.login-page::before,
.login-page::after {
  content: '';
  position: absolute;
  z-index: -1;
  border-radius: 999px;
  background: rgba(var(--brand-green-rgb), 0.08);
  filter: blur(2px);
}

.login-page::before {
  width: 440px;
  height: 440px;
  left: -160px;
  bottom: -180px;
}

.login-page::after {
  width: 300px;
  height: 300px;
  right: -90px;
  top: -110px;
}

.login-shell {
  width: 550px;
  min-height: auto;
  display: grid;
  border-radius: 36px;
  border: 1px solid rgba(var(--brand-green-rgb), 0.14);
  overflow: hidden;
  background: rgba(255, 252, 243, 0.74);
  box-shadow: 0 28px 80px rgba(var(--brand-green-rgb), 0.12);
  backdrop-filter: blur(18px);
}

.auth-panel {
  position: relative;
  overflow: hidden;
  display: grid;
  align-content: center;
  padding: clamp(34px, 5vw, 64px);
  background: rgba(255, 252, 243, 0.92);
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 13px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.panel-header h2 {
  margin: 0 0 10px;
  font-size: clamp(34px, 4vw, 46px);
  color: var(--brand-green);
}

.panel-header p:last-child {
  margin: 0 0 24px;
  color: var(--text-muted);
  line-height: 1.7;
}

.tab-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  padding: 6px;
  border-radius: 999px;
  background: rgba(var(--brand-green-rgb), 0.1);
  margin-bottom: 26px;
  border: 1px solid rgba(var(--brand-green-rgb), 0.08);
}

.tab-row button {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  border-radius: 999px;
  padding: 12px 16px;
  transition: all 0.24s ease;
}

.tab-row button.active {
  background: rgba(255, 253, 246, 0.94);
  color: var(--brand-green);
  box-shadow: 0 14px 32px rgba(var(--brand-green-rgb), 0.1);
}

.auth-form {
  display: grid;
  gap: 16px;
}

.auth-form label span {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-muted);
}

.auth-form input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 16px 18px;
  background: rgba(255, 253, 246, 0.84);
  color: var(--text);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.auth-form input:focus {
  outline: none;
  border-color: var(--border-strong);
  box-shadow: 0 0 0 4px rgba(var(--brand-green-rgb), 0.12);
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  flex: 1;
  padding-right: 70px;
}

.password-toggle {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: rgba(var(--brand-green-rgb), 0.1);
  color: var(--text-muted);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.password-toggle:hover {
  background: rgba(var(--brand-green-rgb), 0.18);
  color: var(--text);
}

.submit-btn {
  margin-top: 8px;
  border: 0;
  border-radius: 20px;
  padding: 17px 18px;
  font-weight: 700;
  color: rgba(255, 254, 249, 0.88);
  background: rgba(var(--brand-green-rgb), 0.9);
  box-shadow: 0 16px 34px rgba(var(--brand-green-rgb), 0.16);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.submit-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 20px 40px rgba(var(--brand-green-rgb), 0.2);
}

.submit-btn:disabled {
  opacity: 0.7;
}

.message {
  margin: 0;
  min-height: 24px;
  font-size: 14px;
}

.message.error {
  color: var(--warn);
}

.message.hint {
  color: var(--text-soft);
}

@media (max-width: 860px) {
  .login-page {
    padding: 22px;
    overflow-y: auto;
  }

  .login-shell {
    min-height: auto;
  }
}

@media (max-width: 560px) {
  .login-page {
    padding: 14px;
  }

  .login-shell {
    border-radius: 28px;
  }

  .auth-panel {
    padding: 34px 22px;
  }
}
</style>
