"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Upload, X, FileText, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, Sparkles, Clock, RefreshCw,
} from "lucide-react";
import { clientsApi, invoicesApi } from "@/lib/api";
import Link from "next/link";
import TemplateAnnotationModal from "@/components/upload/TemplateAnnotationModal";
import { statusColor, statusLabel } from "@/lib/utils";
import type { Client, Invoice } from "@/types";

type FileState = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  invoiceId?: string;
};

const TERMINAL = new Set(["completed", "needs_review", "needs_template", "approved", "rejected", "failed"]);

// ── upload page ───────────────────────────────────────────────────────────────
export default function UploadPage() {
  const qc = useQueryClient();
  const [clientId, setClientId]   = useState("");
  const [files, setFiles]         = useState<FileState[]>([]);
  const [uploading, setUploading] = useState(false);

  // After upload: list of invoice IDs to poll
  const [batchIds, setBatchIds]   = useState<string[]>([]);

  // Annotation modal state
  const [annotateInvoice, setAnnotateInvoice] = useState<Invoice | null>(null);

  // ── clients query ────────────────────────────────────────────────────────
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => clientsApi.list().then(r => r.data),
  });

  // ── polling query (active after upload) ──────────────────────────────────
  const { data: batchInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["upload-batch", batchIds],
    queryFn: () =>
      Promise.all(batchIds.map(id => invoicesApi.get(id).then(r => r.data as Invoice))),
    refetchInterval: (data) => {
      if (!data || !batchIds.length) return false;
      const allDone = (data as Invoice[]).every(inv => TERMINAL.has(inv.status));
      return allDone ? false : 2500;
    },
    enabled: batchIds.length > 0,
  });

  const allDone     = batchIds.length > 0 && batchInvoices.every(inv => TERMINAL.has(inv.status));
  const needsAnnotation = batchInvoices.filter(inv => inv.status === "needs_template");

  // ── dropzone ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => [
      ...prev,
      ...accepted.map(f => ({ file: f, status: "pending" as const, progress: 0 })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    multiple: true,
  });

  // ── upload handler ────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!clientId) { toast.error("Please select a client first"); return; }
    if (files.length === 0) { toast.error("Please add files"); return; }

    setUploading(true);
    const BATCH = 20;
    const allIds: string[] = [];

    try {
      for (let i = 0; i < files.length; i += BATCH) {
        const slice = files.slice(i, i + BATCH);
        setFiles(prev =>
          prev.map((f, idx) => idx >= i && idx < i + BATCH ? { ...f, status: "uploading" } : f)
        );
        const res = await invoicesApi.upload(clientId, slice.map(s => s.file), (pct) => {
          setFiles(prev =>
            prev.map((f, idx) => idx >= i && idx < i + BATCH ? { ...f, progress: pct } : f)
          );
        });
        const ids: string[] = res.data.invoice_ids || [];
        allIds.push(...ids);
        setFiles(prev =>
          prev.map((f, idx) =>
            idx >= i && idx < i + BATCH ? { ...f, status: "done", progress: 100 } : f
          )
        );
      }

      toast.success(`${allIds.length} invoice(s) queued for processing`);
      setBatchIds(allIds);
      setFiles([]);
    } catch {
      toast.error("Upload failed. Please try again.");
      setFiles(prev => prev.map(f => f.status === "uploading" ? { ...f, status: "error" } : f));
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setBatchIds([]);
    setFiles([]);
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["upload-batch"] });
  }

  // ── processing view ───────────────────────────────────────────────────────
  if (batchIds.length > 0) {
    const counts = {
      processing: batchInvoices.filter(i => !TERMINAL.has(i.status)).length,
      completed:  batchInvoices.filter(i => i.status === "completed").length,
      review:     batchInvoices.filter(i => i.status === "needs_review").length,
      template:   needsAnnotation.length,
      failed:     batchInvoices.filter(i => i.status === "failed").length,
    };

    return (
      <>
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Processing {batchIds.length} Invoice(s)</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {allDone ? "All done — see results below" : "OCR is running in the background…"}
              </p>
            </div>
            {allDone && (
              <div className="flex gap-2">
                <button onClick={reset} className="btn-secondary text-sm">Upload More</button>
                <Link href="/review" className="btn-primary text-sm">
                  Go to Review <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-3">
            {counts.processing > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {counts.processing} processing
              </span>
            )}
            {counts.completed > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> {counts.completed} completed
              </span>
            )}
            {counts.review > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                <Clock className="w-3.5 h-3.5" /> {counts.review} needs review
              </span>
            )}
            {counts.template > 0 && (
              <button
                onClick={() => setAnnotateInvoice(needsAnnotation[0])}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 font-medium border border-violet-200 hover:bg-violet-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {counts.template} need{counts.template > 1 ? "" : "s"} annotation
                <span className="ml-1 text-xs underline">Annotate now →</span>
              </button>
            )}
            {counts.failed > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-red-50 text-red-700 font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> {counts.failed} failed
              </span>
            )}
          </div>

          {/* Invoice list */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="table-th">File</th>
                  <th className="table-th">Vendor</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {batchInvoices.length === 0
                  ? Array.from({ length: Math.min(batchIds.length, 5) }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {[1,2,3,4].map(j => (
                          <td key={j} className="table-td"><div className="h-4 bg-slate-100 rounded-lg" /></td>
                        ))}
                      </tr>
                    ))
                  : batchInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="table-td">
                          <p className="font-medium text-slate-800 truncate max-w-[200px]">{inv.original_filename}</p>
                        </td>
                        <td className="table-td text-slate-600 truncate max-w-[160px]">
                          {inv.vendor_name || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="table-td">
                          <span className={`badge ${statusColor(inv.status)}`}>
                            {!TERMINAL.has(inv.status) && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />}
                            {statusLabel(inv.status)}
                          </span>
                        </td>
                        <td className="table-td text-right">
                          {inv.status === "needs_template" && (
                            <button
                              onClick={() => setAnnotateInvoice(inv)}
                              className="text-xs font-semibold text-violet-600 hover:text-violet-800 inline-flex items-center gap-1"
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Annotate
                            </button>
                          )}
                          {inv.status === "failed" && (
                            <button
                              onClick={async () => {
                                await invoicesApi.get(inv.id); // refresh
                                toast("Retrying…");
                              }}
                              className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" /> Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Annotation modal */}
        {annotateInvoice && (
          <TemplateAnnotationModal
            invoice={annotateInvoice}
            onComplete={(updated) => {
              setAnnotateInvoice(null);
              qc.invalidateQueries({ queryKey: ["upload-batch", batchIds] });
              // If more need annotation, open next one
              const remaining = needsAnnotation.filter(i => i.id !== updated.id);
              if (remaining.length > 0) setTimeout(() => setAnnotateInvoice(remaining[0]), 500);
            }}
            onSkip={(updated) => {
              setAnnotateInvoice(null);
              qc.invalidateQueries({ queryKey: ["upload-batch", batchIds] });
              const remaining = needsAnnotation.filter(i => i.id !== updated.id);
              if (remaining.length > 0) setTimeout(() => setAnnotateInvoice(remaining[0]), 500);
            }}
            onClose={() => setAnnotateInvoice(null)}
          />
        )}
      </>
    );
  }

  // ── upload form ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Client selection */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4">Step 1: Select Client</h2>
        <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">-- Select a client --</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {clients.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">
            No clients yet.{" "}
            <Link href="/clients" className="text-brand-600 hover:underline">Create a client first</Link>
          </p>
        )}
      </div>

      {/* Drop zone */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4">Step 2: Add Invoices</h2>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-brand-500 bg-brand-50" : "border-gray-300 hover:border-brand-400 hover:bg-gray-50"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">
            {isDragActive ? "Drop files here" : "Drag & drop invoices here"}
          </p>
          <p className="text-gray-400 text-sm mt-1">or click to browse — PDF, JPG, PNG supported</p>
          <p className="text-gray-400 text-xs mt-1">Supports bulk upload (1000+ files)</p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {files.map((fs, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fs.file.name}</p>
                  <p className="text-xs text-gray-400">{(fs.file.size / 1024).toFixed(0)} KB</p>
                  {fs.status === "uploading" && (
                    <div className="mt-1 h-1 rounded-full bg-gray-200">
                      <div className="h-1 rounded-full bg-brand-500 transition-all" style={{ width: `${fs.progress}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {fs.status === "pending" && (
                    <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                      className="p-1 rounded hover:bg-gray-200 text-gray-400"><X className="w-4 h-4" /></button>
                  )}
                  {fs.status === "uploading" && <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />}
                  {fs.status === "done"      && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {fs.status === "error"     && <AlertCircle  className="w-4 h-4 text-red-500" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{files.length} file(s) selected</p>
        <button onClick={handleUpload} disabled={uploading || files.length === 0 || !clientId}
          className="btn-primary">
          {uploading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
            : <><Upload className="w-4 h-4" /> Upload &amp; Process</>}
        </button>
      </div>
    </div>
  );
}
