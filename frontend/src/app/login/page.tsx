"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Zap } from "lucide-react";
import { authApi } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import type { AuthSession } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ org_name: "", admin_name: "", admin_email: "", admin_password: "" });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(loginForm.email, loginForm.password);
      saveSession(res.data as AuthSession);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Invalid credentials");
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.register(regForm);
      saveSession(res.data as AuthSession);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Registration failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4c1d95 100%)" }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl">TaxOCR</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Automate Invoice<br />Processing for<br />CA Firms
          </h2>
          <p className="text-indigo-200 text-lg leading-relaxed">
            Upload invoices, extract GST data automatically with OCR, review exceptions, and export GST-ready Excel files.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-8">
            {[
              ["80%", "Less manual entry"],
              ["1000+", "Invoices per batch"],
              ["3 roles", "Team collaboration"],
              ["GST ready", "Export formats"],
            ].map(([val, label]) => (
              <div key={label} className="bg-white/10 rounded-xl p-4">
                <p className="text-white text-2xl font-bold">{val}</p>
                <p className="text-indigo-200 text-sm mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-indigo-300 text-sm">© 2026 TaxOCR · For CA firms &amp; accounting practices</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <Zap className="w-7 h-7 text-white" />
            <span className="text-white font-bold text-2xl">TaxOCR</span>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-1">
              {tab === "login" ? "Welcome back" : "Create account"}
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              {tab === "login" ? "Sign in to your organization" : "Set up your CA firm on TaxOCR"}
            </p>

            {/* Tab */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t === "login" ? "Sign In" : "Register"}
                </button>
              ))}
            </div>

            {tab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input type="email" className="input" placeholder="you@firm.com"
                    value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" className="input" placeholder="••••••••"
                    value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base mt-2">
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="label">Organization Name</label>
                  <input className="input" placeholder="ABC Auditors & Co."
                    value={regForm.org_name} onChange={(e) => setRegForm({ ...regForm, org_name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Your Name</label>
                  <input className="input" placeholder="Full name"
                    value={regForm.admin_name} onChange={(e) => setRegForm({ ...regForm, admin_name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" placeholder="admin@firm.com"
                    value={regForm.admin_email} onChange={(e) => setRegForm({ ...regForm, admin_email: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" className="input" placeholder="Min. 8 characters"
                    value={regForm.admin_password} onChange={(e) => setRegForm({ ...regForm, admin_password: e.target.value })} required minLength={8} />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base mt-2">
                  {loading ? "Creating…" : "Create Organization"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
