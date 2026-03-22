import { useEffect, useState } from "react";
import { AUTH_STORAGE_KEY } from "@/appConfig";
import { fetchSession, loginRequest, logoutRequest, readStoredToken, registerRequest, writeStoredToken } from "@/lib/session";

const initialState = {
  status: "booting",
  user: null,
  token: "",
  error: "",
};

export function useSession() {
  const [state, setState] = useState(() => ({
    ...initialState,
    token: typeof window !== "undefined" ? readStoredToken() : "",
  }));

  useEffect(() => {
    const controller = new AbortController();
    const token = state.token;

    async function hydrate() {
      if (!token) {
        setState((current) => ({ ...current, status: "anonymous", error: "" }));
        return;
      }

      setState((current) => ({ ...current, status: "booting", error: "" }));
      try {
        const payload = await fetchSession(token, controller.signal);
        setState({
          status: "authenticated",
          user: payload?.data?.user || null,
          token,
          error: "",
        });
      } catch (error) {
        if (controller.signal.aborted || error?.name === "AbortError") {
          return;
        }
        writeStoredToken("");
        setState({
          status: "anonymous",
          user: null,
          token: "",
          error: error.message || "会话已失效，请重新登录。",
        });
      }
    }

    hydrate();
    return () => controller.abort();
  }, [state.token]);

  useEffect(() => {
    async function syncTokenFromStorage(nextToken) {
      if (!nextToken) {
        setState({
          status: "anonymous",
          user: null,
          token: "",
          error: "",
        });
        return;
      }

      setState((current) => ({ ...current, status: "booting", token: nextToken, error: "" }));
    }

    function handleStorage(event) {
      if (event.key !== AUTH_STORAGE_KEY) {
        return;
      }
      const nextToken = event.newValue || "";
      if (nextToken === state.token) {
        return;
      }
      syncTokenFromStorage(nextToken);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [state.token]);

  async function completeAuth(payload) {
    const nextToken = payload?.data?.token || "";
    const nextUser = payload?.data?.user || null;
    writeStoredToken(nextToken);
    setState({
      status: "authenticated",
      user: nextUser,
      token: nextToken,
      error: "",
    });
    return payload;
  }

  async function login(credentials) {
    setState((current) => ({ ...current, status: "authenticating", error: "" }));
    try {
      const payload = await loginRequest(credentials);
      return await completeAuth(payload);
    } catch (error) {
      setState((current) => ({ ...current, status: "anonymous", error: error.message || "登录失败" }));
      throw error;
    }
  }

  async function register(credentials) {
    setState((current) => ({ ...current, status: "authenticating", error: "" }));
    try {
      const payload = await registerRequest(credentials);
      return await completeAuth(payload);
    } catch (error) {
      setState((current) => ({ ...current, status: "anonymous", error: error.message || "注册失败" }));
      throw error;
    }
  }

  async function logout() {
    const activeToken = state.token;
    try {
      if (activeToken) {
        await logoutRequest(activeToken);
      }
    } catch {
      // 退出登录时优先清理本地会话。
    } finally {
      writeStoredToken("");
      setState({
        status: "anonymous",
        user: null,
        token: "",
        error: "",
      });
    }
  }

  return {
    ...state,
    isReady: state.status !== "booting",
    isAuthenticated: state.status === "authenticated",
    login,
    register,
    logout,
  };
}
