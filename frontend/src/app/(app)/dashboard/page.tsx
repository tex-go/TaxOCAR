"use client";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { formatDate, statusColor, statusLabel } from "@/lib/utils";
import type { DashboardData } from "@/types";
import {
  Users2,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileQuestion,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold mt-1">{value.toLocaleString()}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgColor}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => dashboardApi.get().then((r) => r.data),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Clients" value={stats?.total_clients ?? 0} icon={Users2} bgColor="bg-blue-50" color="text-blue-600" />
        <StatCard label="Total Invoices" value={stats?.total_invoices ?? 0} icon={FileText} bgColor="bg-purple-50" color="text-purple-600" />
        <StatCard label="Pending Review" value={stats?.pending_review ?? 0} icon={Clock} bgColor="bg-yellow-50" color="text-yellow-600" />
        <StatCard label="Processed Today" value={stats?.processed_today ?? 0} icon={CheckCircle2} bgColor="bg-green-50" color="text-green-600" />
        <StatCard label="Failed OCR" value={stats?.failed_ocr ?? 0} icon={AlertCircle} bgColor="bg-red-50" color="text-red-600" />
        <StatCard label="Needs Template" value={stats?.needs_template ?? 0} icon={FileQuestion} bgColor="bg-orange-50" color="text-orange-600" />
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Uploads</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {!data?.recent_uploads?.length ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              No invoices yet.{" "}
              <a href="/upload" className="text-brand-600 hover:underline">
                Upload your first invoice
              </a>
            </div>
          ) : (
            data.recent_uploads.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{inv.original_filename}</p>
                    <p className="text-xs text-gray-500">
                      {inv.client_name} · {formatDate(inv.created_at)}
                    </p>
                  </div>
                </div>
                <span className={`badge ${statusColor(inv.status)} ml-4 flex-shrink-0`}>
                  {statusLabel(inv.status)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
