import Cookies from "js-cookie";
import type { AuthSession } from "@/types";

const SESSION_KEY = "taxocr_session";

export function saveSession(session: AuthSession): void {
  Cookies.set("token", session.access_token, { expires: 1, sameSite: "strict" });
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  Cookies.remove("token");
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function isAdmin(): boolean {
  return getSession()?.role === "admin";
}

export function isReviewer(): boolean {
  const role = getSession()?.role;
  return role === "admin" || role === "reviewer";
}
