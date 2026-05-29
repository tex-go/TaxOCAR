"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users2,
  Upload,
  ClipboardCheck,
  FileSpreadsheet,
  Settings,
  LogOut,
} from "lucide-react";
import { clearSession, getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users2 },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/exports", label: "Exports", icon: FileSpreadsheet },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = getSession();

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-brand-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-brand-800">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-600">
          <FileSpreadsheet className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-lg leading-none">TaxOCR</div>
          <div className="text-brand-300 text-xs mt-0.5">Invoice Processing</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand-600 text-white"
                  : "text-brand-200 hover:bg-brand-800 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 pb-4 border-t border-brand-800 pt-4">
        <div className="px-3 py-2 mb-2">
          <div className="text-sm font-medium truncate">{session?.full_name || "User"}</div>
          <div className="text-brand-300 text-xs capitalize">{session?.role}</div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-brand-200 hover:bg-brand-800 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
