"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Plus, Pencil, Trash2, FileImage, ChevronDown, ChevronUp,
  X, Save, Upload, Layers,
} from "lucide-react";
import api, { templatesApi } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import AnnotationCanvas, { type Coordinates, ANNOTATABLE_FIELDS } from "@/components/templates/AnnotationCanvas";
import type { Template } from "@/types";

type Patterns = Record<string, string>;

// ─── template editor modal ─────────────────────────────────────────────────────
function TemplateModal({ template, onClose }: { template?: Template; onClose: () => void }) {
  const qc = useQueryClient();

  const [form, setForm]         = useState({
    name:         template?.name         ?? "",
    vendor_gstin: template?.vendor_gstin ?? "",
    vendor_name:  template?.vendor_name  ?? "",
    description:  template?.description  ?? "",
  });
  const [coordinates, setCoordinates] = useState<Coordinates>(
    (template?.coordinates as Coordinates) ?? {}
  );
  const [patterns, setPatterns] = useState<Patterns>(
    (template?.patterns as Patterns) ?? {}
  );
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPatterns, setShowPatterns] = useState(false);
  const [patternField, setPatternField] = useState("vendor_name");
  const [patternValue, setPatternValue] = useState("");

  // Load existing sample image (edit mode)
  useEffect(() => {
    if (!template?.sample_image_path) return;
    let url: string | null = null;
    api.get(`/api/v1/templates/${template.id}/preview`, { responseType: "blob" })
      .then((r) => { url = URL.createObjectURL(r.data); setPreviewUrl(url); })
      .catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

  // Local file preview
  useEffect(() => {
    if (!sampleFile) return;
    const url = URL.createObjectURL(sampleFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sampleFile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (template) {
        // Update existing template
        await api.put(`/api/v1/templates/${template.id}`, {
          name: form.name,
          vendor_gstin: form.vendor_gstin.toUpperCase() || null,
          vendor_name:  form.vendor_name  || null,
          description:  form.description  || null,
          coordinates:  Object.keys(coordinates).length ? coordinates : null,
          patterns:     Object.keys(patterns).length    ? patterns    : null,
        });
      } else {
        // Create with optional sample image
        const fd = new FormData();
        fd.append("name", form.name);
        if (form.vendor_gstin) fd.append("vendor_gstin", form.vendor_gstin.toUpperCase());
        if (form.vendor_name)  fd.append("vendor_name",  form.vendor_name);
        if (form.description)  fd.append("description",  form.description);
        if (Object.keys(coordinates).length) fd.append("coordinates", JSON.stringify(coordinates));
        if (Object.keys(patterns).length)    fd.append("patterns",    JSON.stringify(patterns));
        if (sampleFile) fd.append("sample_file", sampleFile);
        await api.post("/api/v1/templates/with-sample", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success(template ? "Template updated" : "Template created");
      onClose();
    },
    onError: () => toast.error("Failed to save template"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{template ? "Edit Template" : "New Template"}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Upload a sample invoice and annotate field positions</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: canvas */}
          <div className="flex-1 overflow-auto p-5 border-r border-slate-100">
            {previewUrl ? (
              <>
                <AnnotationCanvas imageUrl={previewUrl} annotations={coordinates} onChange={setCoordinates} />
                <label className="mt-3 inline-flex items-center gap-2 text-xs text-brand-600 cursor-pointer hover:underline">
                  <Upload className="w-3.5 h-3.5" /> Change image
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) { setSampleFile(e.target.files[0]); setCoordinates({}); } }} />
                </label>
              </>
            ) : (
              <label className="flex flex-col items-center justify-center h-full min-h-64 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
                <FileImage className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">Upload sample invoice</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG or PDF</p>
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) setSampleFile(e.target.files[0]); }} />
              </label>
            )}
          </div>

          {/* Right: form */}
          <div className="w-80 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="label">Template Name *</label>
                <input className="input" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Reliance Industries" required />
              </div>
              <div>
                <label className="label">Vendor GSTIN</label>
                <input className="input font-mono" value={form.vendor_gstin}
                  onChange={(e) => setForm({ ...form, vendor_gstin: e.target.value.toUpperCase() })}
                  placeholder="22AAAAA0000A1Z5" maxLength={15} />
                <p className="text-xs text-slate-400 mt-1">Invoices from this GSTIN auto-use this template</p>
              </div>
              <div>
                <label className="label">Vendor Name</label>
                <input className="input" value={form.vendor_name}
                  onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
              </div>

              {/* Regex patterns */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setShowPatterns(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Regex Patterns (advanced)
                  {showPatterns ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showPatterns && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400 pt-3">
                      Override extraction for specific fields using regex. Use <code className="bg-slate-100 px-1 rounded">()</code> capture group for the value.
                    </p>
                    {Object.entries(patterns).map(([field, pat]) => (
                      <div key={field} className="flex items-start gap-2 text-xs bg-slate-50 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-600">{field}</p>
                          <p className="font-mono text-slate-500 truncate">{pat}</p>
                        </div>
                        <button onClick={() => { const n = { ...patterns }; delete n[field]; setPatterns(n); }}
                          className="text-red-400 hover:text-red-600 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <select className="input text-xs" value={patternField} onChange={(e) => setPatternField(e.target.value)}>
                      {ANNOTATABLE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                    <input className="input text-xs font-mono" value={patternValue}
                      onChange={(e) => setPatternValue(e.target.value)}
                      placeholder="e.g. Invoice\s*No[:\s]*([\w/\-]+)" />
                    <button onClick={() => { if (patternValue.trim()) { setPatterns({ ...patterns, [patternField]: patternValue.trim() }); setPatternValue(""); } }}
                      className="btn-secondary text-xs w-full justify-center">Add Pattern</button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100">
              <button onClick={() => { if (form.name.trim()) saveMutation.mutate(); else toast.error("Template name is required"); }}
                disabled={saveMutation.isPending} className="btn-primary w-full justify-center">
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving…" : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── template card ─────────────────────────────────────────────────────────────
function TemplateCard({ template, admin, onEdit, onDelete }: {
  template: Template; admin: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const coordCount   = template.coordinates ? Object.keys(template.coordinates).length : 0;
  const patternCount = template.patterns    ? Object.keys(template.patterns).length    : 0;
  return (
    <div className="card group hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {template.name.charAt(0).toUpperCase()}
        </div>
        {admin && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600"><Pencil className="w-4 h-4" /></button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
      </div>
      <h3 className="font-bold text-slate-900 text-sm mb-1 truncate">{template.name}</h3>
      {template.vendor_gstin && (
        <span className="inline-block font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg mb-2">{template.vendor_gstin}</span>
      )}
      {template.description && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{template.description}</p>}
      <div className="flex items-center gap-3 mt-auto pt-3 border-t border-slate-100">
        {coordCount > 0 && (
          <span className="text-xs text-emerald-600">✦ {coordCount} annotated</span>
        )}
        {patternCount > 0 && (
          <span className="text-xs text-brand-600">∷ {patternCount} patterns</span>
        )}
        {coordCount === 0 && patternCount === 0 && (
          <span className="text-xs text-slate-400">No annotations yet</span>
        )}
      </div>
    </div>
  );
}

// ─── templates list page ───────────────────────────────────────────────────────
export default function TemplatesPage() {
  const qc = useQueryClient();
  const { isAdmin: admin } = useAuth();
  const [modal, setModal] = useState<"new" | Template | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: () => templatesApi.list().then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Template deleted"); },
    onError: () => toast.error("Failed to delete"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Extraction Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create per-vendor templates to boost OCR accuracy — annotate field positions or add custom regex patterns
          </p>
        </div>
        {admin && (
          <button onClick={() => setModal("new")} className="btn-primary">
            <Plus className="w-4 h-4" /> New Template
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card animate-pulse h-40" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-brand-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">No templates yet</h3>
          <p className="text-slate-400 text-sm max-w-sm">
            Create a template by uploading a sample invoice from a vendor and drawing bounding boxes on each field.
          </p>
          {admin && (
            <button onClick={() => setModal("new")} className="btn-primary mt-5">
              <Plus className="w-4 h-4" /> Create first template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <TemplateCard key={t.id} template={t} admin={admin}
              onEdit={() => setModal(t)}
              onDelete={() => { if (confirm(`Delete "${t.name}"?`)) deleteMutation.mutate(t.id); }}
            />
          ))}
        </div>
      )}

      {modal && <TemplateModal template={modal === "new" ? undefined : modal} onClose={() => setModal(null)} />}
    </div>
  );
}
