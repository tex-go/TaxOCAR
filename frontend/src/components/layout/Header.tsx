"use client";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/useAuth";

const pageMeta: Record<string, { title: string; sub: string }> = {
  "/dashboard":           { title: "Dashboard",        sub: "Overview of your invoice processing activity" },
  "/clients":             { title: "Clients",           sub: "Manage your CA firm's clients" },
  "/upload":              { title: "Upload Invoices",   sub: "Drag & drop PDFs or images for instant OCR" },
  "/review":              { title: "Review Invoices",   sub: "Validate, edit and approve extracted data" },
  "/exports":             { title: "Exports",           sub: "Download GST-ready Excel and CSV reports" },
  "/templates":           { title: "Templates",          sub: "Per-vendor extraction templates with canvas annotation" },
  "/settings":            { title: "Settings",          sub: "Configure users, templates and preferences" },
  "/settings/users":      { title: "User Management",  sub: "Manage team members and roles" },
  "/settings/templates":  { title: "Invoice Templates", sub: "Define extraction rules per vendor" },
  "/settings/profile":    { title: "Profile",           sub: "Update your account details" },
};

export default function Header() {
  const pathname = usePathname();
  const meta = Object.entries(pageMeta).find(
    ([p]) => pathname === p || pathname.startsWith(p + "/")
  )?.[1] ?? { title: "TaxOCR", sub: "" };

  const { session } = useAuth();

  return (
    <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-900 leading-tight">{meta.title}</h1>
        {meta.sub && <p className="text-sm text-slate-400 mt-0.5">{meta.sub}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white"
               style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            {(session?.full_name?.[0] || "U").toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-800 leading-none">{session?.full_name}</p>
            <p className="text-xs text-slate-400 capitalize mt-0.5">{session?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
