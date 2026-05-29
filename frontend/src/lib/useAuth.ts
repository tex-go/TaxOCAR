"use client";
import { useState, useEffect } from "react";
import { getSession } from "./auth";
import type { AuthSession } from "@/types";

/**
 * Safe session hook for use inside "use client" components.
 *
 * getSession() reads localStorage which is undefined on the server, causing
 * a React hydration mismatch (server renders null, client renders session).
 * This hook initialises to null on both server and client first-render, then
 * sets the real session in useEffect (client-only, after hydration).
 */
export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  return {
    session,
    isAdmin:    session?.role === "admin",
    isReviewer: session?.role === "admin" || session?.role === "reviewer",
  };
}
