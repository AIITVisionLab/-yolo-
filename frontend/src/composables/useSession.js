import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { AUTH_STORAGE_KEY } from "@/appConfig"
import { 
  fetchSession, 
  loginRequest, 
  logoutRequest, 
  readStoredToken, 
  registerRequest, 
  writeStoredToken 
} from "@/lib/session"

export function useSession() {
  const status = ref("booting")  // booting, authenticating, authenticated, anonymous
  const user = ref(null)
  const token = ref("")
  const error = ref("")
  
  const storageReady = ref(false)
  let abortController = null

  const isReady = computed(() => status.value !== "booting")
  const isAuthenticated = computed(() => status.value === "authenticated")

  // 更新状态辅助函数
  const updateState = (newState) => {
    if (newState.status !== undefined) status.value = newState.status
    if (newState.user !== undefined) user.value = newState.user
    if (newState.token !== undefined) token.value = newState.token
    if (newState.error !== undefined) error.value = newState.error
  }

  // 恢复存储的token
  onMounted(async () => {
    const storedToken = typeof window !== "undefined" ? await readStoredToken() : ""
    storageReady.value = true
    status.value = storedToken ? "booting" : "anonymous"
    token.value = storedToken
  })

  // 清理函数
  onUnmounted(() => {
    if (abortController) {
      abortController.abort()
    }
  })

  // 监听token验证
  watch(
    [storageReady, status, token],
    async ([ready, currentStatus, currentToken]) => {
      if (!ready || currentStatus !== "booting") return

      if (abortController) {
        abortController.abort()
      }
      abortController = new AbortController()

      if (!currentToken) {
        status.value = "anonymous"
        error.value = ""
        return
      }

      try {
        const payload = await fetchSession(currentToken, abortController.signal)
        await writeStoredToken(currentToken)
        
        if (abortController.signal.aborted) return
        
        status.value = "authenticated"
        user.value = payload?.data?.user || null
        error.value = ""
      } catch (err) {
        if (abortController.signal.aborted || err?.name === "AbortError") return
        
        await writeStoredToken("")
        status.value = "anonymous"
        user.value = null
        token.value = ""
        error.value = err.message || "会话已失效，请重新登录。"
      }
    },
    { immediate: true }
  )

  // 监听storage事件
  onMounted(() => {
    const syncTokenFromStorage = async () => {
      const nextToken = await readStoredToken()
      if (!nextToken) {
        status.value = "anonymous"
        user.value = null
        token.value = ""
        error.value = ""
      } else {
        status.value = "booting"
        token.value = nextToken
        error.value = ""
      }
    }

    const handleStorage = (event) => {
      if (event.key !== AUTH_STORAGE_KEY) return
      syncTokenFromStorage()
    }

    window.addEventListener("storage", handleStorage)
    onUnmounted(() => {
      window.removeEventListener("storage", handleStorage)
    })
  })

  const completeAuth = async (payload) => {
    const nextToken = payload?.data?.token || ""
    const nextUser = payload?.data?.user || null
    await writeStoredToken(nextToken)
    status.value = "authenticated"
    user.value = nextUser
    token.value = nextToken
    error.value = ""
    return payload
  }

  const login = async (credentials) => {
    status.value = "authenticating"
    error.value = ""
    try {
      const payload = await loginRequest(credentials)
      return await completeAuth(payload)
    } catch (err) {
      status.value = "anonymous"
      error.value = err.message || "登录失败"
      throw err
    }
  }

  const register = async (credentials) => {
    status.value = "authenticating"
    error.value = ""
    try {
      const payload = await registerRequest(credentials)
      return await completeAuth(payload)
    } catch (err) {
      status.value = "anonymous"
      error.value = err.message || "注册失败"
      throw err
    }
  }

  const logout = async () => {
    const activeToken = token.value
    try {
      if (activeToken) {
        await logoutRequest(activeToken)
      }
    } catch {
      // 退出登录时优先清理本地会话。
    } finally {
      await writeStoredToken("")
      status.value = "anonymous"
      user.value = null
      token.value = ""
      error.value = ""
    }
  }

  return {
    // 响应式状态
    status,
    user,
    token,
    error,
    isReady,
    isAuthenticated,
    // 方法
    login,
    register,
    logout,
  }
}