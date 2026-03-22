import { AUTH_STORAGE_KEY } from "@/appConfig";
import { requestApi } from "./api";

export function readStoredToken() {
  return window.localStorage.getItem(AUTH_STORAGE_KEY) || "";
}

export function writeStoredToken(token) {
  if (token) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export async function fetchSession(token, signal) {
  return requestApi("/auth/session", { token, signal });
}

export async function loginRequest(payload) {
  return requestApi("/auth/login", { method: "POST", body: payload });
}

export async function registerRequest(payload) {
  return requestApi("/auth/register", { method: "POST", body: payload });
}

export async function logoutRequest(token) {
  return requestApi("/auth/logout", { method: "POST", token });
}
