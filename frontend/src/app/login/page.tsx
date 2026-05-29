"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { authApi } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import type { AuthSession } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({
    org_name: "",
    admin_name: "",
    admin_email: "",
    admin_password: "",
  });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(loginForm.email, loginForm.password);
      saveSession(res.data as AuthSession);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.register(regForm);
      saveSession(res.data as AuthSession);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Registration failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 to-brand-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">TaxOCR</h1>
          <p className="text-brand-200 mt-1 text-sm">Invoice Processing for CA Firms</p>
        </div>

        <div className="card p-8">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-b-2 border-brand-600 text-brand-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "login" ? "Sign In" : "Create Organization"}
              </button>
            ))}
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="label">Organization Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ABC Auditors"
                  value={regForm.org_name}
                  onChange={(e) => setRegForm({ ...regForm, org_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Your Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Full Name"
                  value={regForm.admin_name}
                  onChange={(e) => setRegForm({ ...regForm, admin_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="admin@example.com"
                  value={regForm.admin_email}
                  onChange={(e) => setRegForm({ ...regForm, admin_email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Min. 8 characters"
                  value={regForm.admin_password}
                  onChange={(e) => setRegForm({ ...regForm, admin_password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? "Creating..." : "Create Organization"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
