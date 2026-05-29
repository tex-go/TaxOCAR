"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { X, Save, SkipForward, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import api, { invoicesApi, templatesApi } from "@/lib/api";
import AnnotationCanvas, { type Coordinates, ANNOTATABLE_FIELDS } from "@/components/templates/AnnotationCanvas";
import type { Invoice } from "@/types";

interface Props {
  invoice: Invoice;          // the invoice that needs a template
  /** Called when the user creates a template and reprocessing finishes */
  onComplete: (updatedInvoice: Invoice) => void;
  /** Called when the user skips — invoice will be reprocessed without a template */
  onSkip: (updatedInvoice: Invoice) => void;
  /** Called to close without any action */
  onClose: () => void;
}

export default function TemplateAnnotationModal({ invoice, onComplete, onSkip, onClose }: Props) {
  const qc = useQueryClient();

  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [coordinates,  setCoordinates]  = useState<Coordinates>({});
  const [patterns,     setPatterns]     = useState<Record<string, string>>({});
  const [form,         setForm]         = useState({
    name:         invoice.vendor_name  || "",
    vendor_gstin: invoice.vendor_gstin || "",
    vendor_name:  invoice.vendor_name  || "",
    description:  "",
  });
  const [phase, setPhase] = useState<"annotate" | "saving" | "reprocessing" | "done">("annotate");

  // ── Load invoice preview ───────────────────────────────────────────────────
  useEffect(() => {
    let url: string | null = null;
    const mime =
      invoice.file_type === "pdf" ? "application/pdf"
      : invoice.file_type === "png" ? "image/png"
      : "image/jpeg";

    api.get(`/api/v1/invoices/${invoice.id}/preview`, { responseType: "blob" })
      .then((r) => {
        const blob = new Blob([r.data], { type: mime });
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      })
      .catch(() => toast.error("Could not load invoice preview"));

    return () => { if (url) URL.revokeObjectURL(url); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]);

  // ── Poll invoice status while reprocessing ────────────────────────────────
  const { data: polledInvoice } = useQuery<Invoice>({
    queryKey: ["invoice-reprocess-poll", invoice.id],
    queryFn: () => invoicesApi.get(invoice.id).then(r => r.data),
    refetchInterval: phase === "reprocessing" ? 2000 : false,
    enabled: phase === "reprocessing",
  });

  useEffect(() => {
    if (phase !== "reprocessing" || !polledInvoice) return;
    const terminal = ["completed", "needs_review", "approved", "rejected", "failed"];
    if (terminal.includes(polledInvoice.status)) {
      setPhase("done");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      onComplete(polledInvoice);
    }
  }, [polledInvoice, phase, onComplete, qc]);

  // ── Save template + trigger reprocess ─────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Template name is required");

      setPhase("saving");

      // Create template linked to this invoice as sample image
      const tmplRes = await api.post(`/api/v1/templates/from-invoice/${invoice.id}`, {
        name:         form.name.trim(),
        vendor_gstin: form.vendor_gstin.toUpperCase() || null,
        vendor_name:  form.vendor_name  || null,
        description:  form.description  || null,
        coordinates:  Object.keys(coordinates).length ? coordinates : null,
        patterns:     Object.keys(patterns).length    ? patterns    : null,
      });

      const templateId: string = tmplRes.data.id;

      // Reprocess this invoice with the new template
      await api.post(`/api/v1/invoices/${invoice.id}/reprocess`, {
        template_id: templateId,
        skip_template: false,
      });

      return templateId;
    },
    onSuccess: () => {
      toast.success("Template saved — re-extracting data…");
      setPhase("reprocessing");
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (err: unknown) => {
      setPhase("annotate");
      const msg = (err as { message?: string })?.message || "Failed to save template";
      toast.error(msg);
    },
  });

  // ── Skip: reprocess without template ─────────────────────────────────────
  const skipMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/invoices/${invoice.id}/reprocess`, { skip_template: true }),
    onSuccess: () => {
      toast("Processing without template — data may need manual review");
      setPhase("reprocessing");
    },
    onError: () => toast.error("Could not queue reprocessing"),
  });

  // Separate poll effect for skip flow
  useEffect(() => {
    if (phase !== "reprocessing" || !polledInvoice) return;
    const terminal = ["completed", "needs_review", "approved", "rejected", "failed"];
    if (terminal.includes(polledInvoice.status)) {
      setPhase("done");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      // Determine whether this was a skip or save by checking template_id
      if (polledInvoice.template_id) {
        onComplete(polledInvoice);
      } else {
        onSkip(polledInvoice);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polledInvoice, phase]);

  const annotationCount = Object.keys(coordinates).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900">No Matching Template Found</h2>
            <p className="text-sm text-slate-500 truncate">
              <span className="font-medium text-slate-700">{invoice.original_filename}</span>
              {invoice.vendor_name && <> · Vendor: <span className="font-medium">{invoice.vendor_name}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 flex-shrink-0">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        {phase === "reprocessing" || phase === "saving" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-12">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
            <div className="text-center">
              <p className="text-base font-semibold text-slate-800">
                {phase === "saving" ? "Saving template…" : "Re-extracting data…"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {phase === "saving"
                  ? "Creating template and queuing for reprocessing"
                  : "Applying template coordinates to extract fields — this takes a moment"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Left: invoice preview + canvas */}
            <div className="flex-1 overflow-auto p-5 border-r border-slate-100">
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  Step 1 — Annotate field positions
                </p>
                <p className="text-xs text-slate-400">
                  Select a field from the dropdown, then drag a rectangle on the invoice image where that field appears.
                  The system will use these coordinates to extract data from future invoices with the same layout.
                </p>
              </div>
              {previewUrl ? (
                <AnnotationCanvas
                  imageUrl={previewUrl}
                  annotations={coordinates}
                  onChange={setCoordinates}
                  height={460}
                />
              ) : (
                <div className="flex items-center justify-center h-48 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading invoice preview…
                </div>
              )}
            </div>

            {/* Right: form */}
            <div className="w-80 flex flex-col overflow-hidden border-l border-slate-100">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">Step 2 — Name the template</p>
                </div>

                <div>
                  <label className="label">Template Name *</label>
                  <input className="input" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Feastful Catering" />
                </div>
                <div>
                  <label className="label">Vendor GSTIN</label>
                  <input className="input font-mono" value={form.vendor_gstin}
                    onChange={(e) => setForm({ ...form, vendor_gstin: e.target.value.toUpperCase() })}
                    placeholder="22AAAAA0000A1Z5" maxLength={15} />
                  <p className="text-xs text-slate-400 mt-1">Future invoices with this GSTIN will auto-use this template</p>
                </div>
                <div>
                  <label className="label">Vendor Name</label>
                  <input className="input" value={form.vendor_name}
                    onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Notes</label>
                  <input className="input" value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional description" />
                </div>

                {/* Annotation summary */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Annotation summary</p>
                  {annotationCount === 0 ? (
                    <p className="text-xs text-slate-400">No fields annotated yet. Draw at least one box on the invoice to enable template extraction.</p>
                  ) : (
                    <div className="space-y-1">
                      {Object.keys(coordinates).map(field => {
                        const label = ANNOTATABLE_FIELDS.find(f => f.key === field)?.label ?? field;
                        return (
                          <div key={field} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            {label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-5 border-t border-slate-100 space-y-2">
                <button
                  onClick={() => { if (form.name.trim()) saveMutation.mutate(); else toast.error("Enter a template name"); }}
                  disabled={saveMutation.isPending || annotationCount === 0}
                  className="btn-primary w-full justify-center"
                >
                  <Save className="w-4 h-4" />
                  Save Template &amp; Extract
                </button>
                <button
                  onClick={() => skipMutation.mutate()}
                  disabled={skipMutation.isPending}
                  className="btn-secondary w-full justify-center text-sm"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip — Extract Without Template
                </button>
                <p className="text-xs text-center text-slate-400">
                  Skipping uses generic OCR — data may be less accurate
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
