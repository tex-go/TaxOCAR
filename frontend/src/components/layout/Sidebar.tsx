"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users2, Upload, ClipboardCheck,
  FileSpreadsheet, Settings, LogOut, Zap, Layers,
} from "lucide-react";
import { clearSession } from "@/lib/auth";
import { useAuth } from "@/lib/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/clients",    label: "Clients",    icon: Users2 },
  { href: "/upload",     label: "Upload",     icon: Upload },
  { href: "/review",     label: "Review",     icon: ClipboardCheck },
  { href: "/templates",  label: "Templates",  icon: Layers },
  { href: "/exports",    label: "Exports",    icon: FileSpreadsheet },
  { href: "/settings",   label: "Settings",   icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { session } = useAuth();

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <aside
      className="flex flex-col w-64 min-h-screen flex-shrink-0"
      style={{ background: "linear-gradient(180deg,#1e1b4b 0%,#312e81 45%,#1e1b4b 100%)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl"
             style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-xl text-white leading-none tracking-tight">TaxOCR</div>
          <div className="text-indigo-300 text-xs mt-0.5 font-medium">Invoice Processing</div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/10 mb-2" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
                active
                  ? "bg-white/15 text-white shadow-glow"
                  : "text-indigo-200 hover:bg-white/10 hover:text-white"
              )}
            >
              <span className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                active
                  ? "bg-gradient-to-br from-indigo-400 to-violet-500 shadow-md"
                  : "bg-white/5 group-hover:bg-white/10"
              )}>
                <Icon className="w-4 h-4" />
              </span>
              {label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-300" />}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/10 mt-2" />

      {/* User */}
      <div className="px-3 py-4 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
               style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            {(session?.full_name?.[0] || "U").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{session?.full_name || "User"}</p>
            <p className="text-indigo-300 text-xs capitalize">{session?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium
                     text-indigo-300 hover:bg-white/10 hover:text-white transition-all duration-150"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5">
            <LogOut className="w-4 h-4" />
          </span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
