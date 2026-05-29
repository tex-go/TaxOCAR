import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { InvoiceStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function statusColor(status: InvoiceStatus): string {
  const map: Record<InvoiceStatus, string> = {
    pending:        "bg-slate-100 text-slate-600",
    processing:     "bg-blue-100 text-blue-700",
    completed:      "bg-emerald-100 text-emerald-700",
    failed:         "bg-red-100 text-red-700",
    needs_review:   "bg-amber-100 text-amber-700",
    needs_template: "bg-orange-100 text-orange-700",
    approved:       "bg-green-100 text-green-700",
    rejected:       "bg-rose-100 text-rose-700",
  };
  return map[status] || "bg-slate-100 text-slate-600";
}

export function statusLabel(status: InvoiceStatus): string {
  const map: Record<InvoiceStatus, string> = {
    pending:        "Pending",
    processing:     "Processing",
    completed:      "Completed",
    failed:         "Failed",
    needs_review:   "Needs Review",
    needs_template: "No Template",
    approved:       "Approved",
    rejected:       "Rejected",
  };
  return map[status] || status;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
