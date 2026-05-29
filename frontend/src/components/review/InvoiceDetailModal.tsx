"use client";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  X, ExternalLink, AlertTriangle, Clock, Check,
  ChevronDown, ChevronUp
} from "lucide-react";
import api, { invoicesApi } from "@/lib/api";
import { formatDate, statusColor, statusLabel } from "@/lib/utils";
import { useAuth } from "@/lib/useAuth";
import type { Invoice, AuditLog } from "@/types";

const FIELDS: { key: keyof Invoice; label: string; type?: string }[] = [
  { key: "vendor_name", label: "Vendor Name" },
  { key: "vendor_gstin", label: "Vendor GSTIN" },
  { key: "customer_name", label: "Customer Name" },
  { key: "customer_gstin", label: "Customer GSTIN" },
  { key: "invoice_number", label: "Invoice Number" },
  { key: "invoice_date", label: "Invoice Date" },
  { key: "taxable_amount", label: "Taxable Amount", type: "number" },
  { key: "cgst", label: "CGST", type: "number" },
  { key: "sgst", label: "SGST", type: "number" },
  { key: "igst", label: "IGST", type: "number" },
  { key: "cess", label: "CESS", type: "number" },
  { key: "total_amount", label: "Total Amount", type: "number" },
  { key: "hsn_sac", label: "HSN/SAC" },
  { key: "place_of_supply", label: "Place of Supply" },
  { key: "state", label: "State" },
];

export default function InvoiceDetailModal({
  invoice,
  onClose,
  onUpdate,
}: {
  invoice: Invoice;
  onClose: () => void;
  onUpdate: (updated: Invoice) => void;
}) {
  const qc = useQueryClient();
  const { isReviewer: reviewer } = useAuth();
  const [form, setForm] = useState<Partial<Invoice>>({ ...invoice });
  const [showAudit, setShowAudit] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const mime =
      invoice.file_type === "pdf" ? "application/pdf"
      : invoice.file_type === "png" ? "image/png"
      : "image/jpeg";

    api.get(`/api/v1/invoices/${invoice.id}/preview`, { responseType: "blob" })
      .then((r) => {
        const blob = new Blob([r.data], { type: mime });
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {});

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]);

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["audit", invoice.id],
    queryFn: () => invoicesApi.getAuditLog(invoice.id).then((r) => r.data),
    enabled: showAudit,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Invoice>) => invoicesApi.update(invoice.id, data),
    onSuccess: (res) => {
      toast.success("Saved");
      onUpdate(res.data);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: () => toast.error("Failed to save"),
  });

  const approveMutation = useMutation({
    mutationFn: () => invoicesApi.approve(invoice.id),
    onSuccess: (res) => {
      toast.success("Approved");
      onUpdate(res.data);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => invoicesApi.reject(invoice.id),
    onSuccess: (res) => {
      toast.success("Rejected");
      onUpdate(res.data);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  function handleSave() {
    const changes: Record<string, unknown> = {};
    FIELDS.forEach(({ key }) => {
      if (form[key] !== invoice[key]) {
        changes[key] = form[key];
      }
    });
    if (Object.keys(changes).length === 0) {
      toast("No changes to save");
      return;
    }
    updateMutation.mutate(changes as Partial<Invoice>);
  }

  function getConfidenceColor(field: string): string {
    const conf = invoice.field_confidence?.[field];
    if (conf == null) return "";
    if (conf >= 80) return "border-green-300 bg-green-50";
    if (conf >= 60) return "border-yellow-300 bg-yellow-50";
    return "border-red-300 bg-red-50";
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex z-50 overflow-hidden">
      <div className="flex flex-1 m-4 rounded-xl overflow-hidden bg-white shadow-2xl max-w-6xl mx-auto">
        {/* Left: Preview */}
        <div className="w-1/2 bg-gray-900 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white">
            <div className="text-sm font-medium truncate">{invoice.original_filename}</div>
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          <div className="flex-1 overflow-auto p-2">
            {previewUrl ? (
              invoice.file_type === "pdf" ? (
                <iframe src={previewUrl} className="w-full h-full rounded" title="Invoice preview" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Invoice" className="max-w-full rounded" />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading preview...
              </div>
            )}
          </div>
        </div>

        {/* Right: Fields */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <div>
              <span className={`badge ${statusColor(invoice.status)}`}>
                {statusLabel(invoice.status)}
              </span>
              {invoice.is_duplicate && (
                <span className="badge bg-red-100 text-red-700 ml-2">Duplicate</span>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Validation errors */}
          {(invoice.validation_errors?.length ?? 0) > 0 && (
            <div className="mx-5 mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-700 text-sm font-medium mb-1">
                <AlertTriangle className="w-4 h-4" />
                Validation Issues
              </div>
              {invoice.validation_errors!.map((err, i) => (
                <p key={i} className="text-xs text-yellow-600">{err}</p>
              ))}
            </div>
          )}

          {/* Fields */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map(({ key, label, type }) => {
                const confColor = getConfidenceColor(key as string);
                const conf = invoice.field_confidence?.[key as string];
                return (
                  <div key={key as string}>
                    <label className="label flex items-center justify-between">
                      {label}
                      {conf != null && (
                        <span className={`text-xs font-normal ${conf >= 80 ? "text-green-600" : conf >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                          {conf.toFixed(0)}%
                        </span>
                      )}
                    </label>
                    <input
                      type={type || "text"}
                      step={type === "number" ? "0.01" : undefined}
                      className={`input ${confColor}`}
                      value={(form[key] as string | number) ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, [key]: type === "number" ? parseFloat(e.target.value) || null : e.target.value })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-gray-200 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="btn-primary flex-1 justify-center"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
              {reviewer && invoice.status !== "approved" && invoice.status !== "rejected" && (
                <>
                  <button
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="btn-primary justify-center bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate()}
                    disabled={rejectMutation.isPending}
                    className="btn-danger justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Audit trail toggle */}
            <button
              onClick={() => setShowAudit((v) => !v)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <Clock className="w-4 h-4" />
              Audit Trail
              {showAudit ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAudit && auditLogs && (
              <div className="max-h-32 overflow-y-auto space-y-1.5">
                {auditLogs.map((log) => (
                  <div key={log.id} className="text-xs p-2 rounded bg-gray-50">
                    <span className="font-medium text-gray-700">{log.action}</span>
                    {log.field_name && (
                      <span className="text-gray-500">
                        {" "}· {log.field_name}: {log.old_value} → {log.new_value}
                      </span>
                    )}
                    <span className="text-gray-400 block mt-0.5">
                      {log.user_name || "System"} · {formatDate(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
