"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { dashboardApi } from "@/lib/api";
import { formatDate, statusColor, statusLabel } from "@/lib/utils";
import type { DashboardData } from "@/types";
import { Users2, FileText, Clock, CheckCircle2, AlertCircle, FileQuestion, ArrowRight } from "lucide-react";

const STAT_CONFIG = [
  { key: "total_clients",    label: "Total Clients",    icon: Users2,       cls: "stat-blue",   href: "/clients" },
  { key: "total_invoices",   label: "Total Invoices",   icon: FileText,     cls: "stat-teal",   href: "/review" },
  { key: "pending_review",   label: "Pending Review",   icon: Clock,        cls: "stat-amber",  href: "/review?status=needs_review" },
  { key: "processed_today",  label: "Processed Today",  icon: CheckCircle2, cls: "stat-green",  href: "/review?status=approved" },
  { key: "failed_ocr",       label: "Failed OCR",       icon: AlertCircle,  cls: "stat-red",    href: "/review?status=failed" },
  { key: "needs_template",   label: "Needs Template",   icon: FileQuestion, cls: "stat-orange", href: "/settings/templates" },
] as const;

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => dashboardApi.get().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {STAT_CONFIG.map(({ key, label, icon: Icon, cls, href }) => (
          <Link key={key} href={href} className="group block">
            <div className={`${cls} rounded-2xl p-5 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer`}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-70 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-200" />
              </div>
              {isLoading ? (
                <div className="h-8 w-16 bg-white/20 rounded-lg animate-pulse mb-1" />
              ) : (
                <p className="text-3xl font-bold leading-none mb-1">
                  {(stats?.[key] ?? 0).toLocaleString()}
                </p>
              )}
              <p className="text-white/80 text-sm font-medium">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent uploads */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">Recent Uploads</h2>
            <p className="text-xs text-slate-400 mt-0.5">Last 10 invoices processed</p>
          </div>
          <Link href="/review" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3.5 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3.5 bg-slate-100 rounded w-1/3 mb-1.5" />
                  <div className="h-3 bg-slate-100 rounded w-1/4" />
                </div>
                <div className="h-5 w-20 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : !data?.recent_uploads?.length ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">No invoices yet</p>
            <p className="text-slate-400 text-sm mt-1">
              <Link href="/upload" className="text-brand-600 hover:underline font-semibold">Upload your first invoice</Link>
              {" "}to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.recent_uploads.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{inv.original_filename}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{inv.client_name} · {formatDate(inv.created_at)}</p>
                </div>
                <span className={`badge ${statusColor(inv.status)} flex-shrink-0`}>
                  {statusLabel(inv.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
