"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, FileCode2 } from "lucide-react";
import { templatesApi } from "@/lib/api";
import type { Template } from "@/types";
import { formatDate } from "@/lib/utils";

const GST_FIELDS = [
  "vendor_name", "vendor_gstin", "customer_name", "customer_gstin",
  "invoice_number", "invoice_date", "taxable_amount", "cgst", "sgst",
  "igst", "cess", "total_amount", "hsn_sac", "place_of_supply",
];

function TemplateModal({ template, onClose }: { template?: Template; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: template?.name || "",
    vendor_gstin: template?.vendor_gstin || "",
    vendor_name: template?.vendor_name || "",
    description: template?.description || "",
    patterns: template?.patterns
      ? Object.entries(template.patterns).map(([field, pattern]) => ({ field, pattern }))
      : [{ field: "invoice_number", pattern: "" }],
  });

  function addPattern() {
    setForm({ ...form, patterns: [...form.patterns, { field: "taxable_amount", pattern: "" }] });
  }

  function updatePattern(index: number, key: "field" | "pattern", value: string) {
    const updated = form.patterns.map((p, i) => i === index ? { ...p, [key]: value } : p);
    setForm({ ...form, patterns: updated });
  }

  function removePattern(index: number) {
    setForm({ ...form, patterns: form.patterns.filter((_, i) => i !== index) });
  }

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        name: data.name,
        vendor_gstin: data.vendor_gstin || null,
        vendor_name: data.vendor_name || null,
        description: data.description || null,
        patterns: Object.fromEntries(
          data.patterns
            .filter((p) => p.field && p.pattern)
            .map((p) => [p.field, p.pattern])
        ),
      };
      return template
        ? templatesApi.update(template.id, payload)
        : templatesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success(template ? "Template updated" : "Template created");
      onClose();
    },
    onError: () => toast.error("Failed to save template"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{template ? "Edit Template" : "New Template"}</h2>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Template Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Vendor GSTIN (for auto-match)</label>
              <input className="input font-mono" value={form.vendor_gstin} onChange={(e) => setForm({ ...form, vendor_gstin: e.target.value.toUpperCase() })} placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </div>
          </div>
          <div>
            <label className="label">Vendor Name</label>
            <input className="input" value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Regex Patterns</label>
              <button type="button" onClick={addPattern} className="text-xs text-brand-600 hover:underline">+ Add Field</button>
            </div>
            <div className="space-y-2">
              {form.patterns.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    className="input w-44 flex-shrink-0"
                    value={p.field}
                    onChange={(e) => updatePattern(i, "field", e.target.value)}
                  >
                    {GST_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <input
                    className="input flex-1 font-mono text-xs"
                    placeholder="Regex pattern e.g. Invoice No[:\s]+(\w+)"
                    value={p.pattern}
                    onChange={(e) => updatePattern(i, "pattern", e.target.value)}
                  />
                  <button type="button" onClick={() => removePattern(i)} className="p-2 rounded hover:bg-red-50 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Patterns must include a capture group <code>()</code> for the extracted value.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 justify-center">
              {mutation.isPending ? "Saving..." : "Save Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<"new" | Template | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: () => templatesApi.list().then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Template deleted"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{templates.length} templates</p>
          <p className="text-xs text-gray-400 mt-0.5">Templates auto-match invoices by vendor GSTIN</p>
        </div>
        <button onClick={() => setModal("new")} className="btn-primary">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      <div className="card divide-y divide-gray-100">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
          ))
        ) : templates.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400 text-sm">
            No templates yet. Create one to improve extraction accuracy for specific vendors.
          </div>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <FileCode2 className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.vendor_gstin && (
                      <span className="text-xs font-mono text-gray-500">{t.vendor_gstin}</span>
                    )}
                    {t.vendor_name && (
                      <span className="text-xs text-gray-400">{t.vendor_name}</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {Object.keys(t.patterns || {}).length} patterns
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{formatDate(t.created_at)}</span>
                <button onClick={() => setModal(t)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete template "${t.name}"?`)) deleteMutation.mutate(t.id);
                  }}
                  className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <TemplateModal
          template={modal === "new" ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
