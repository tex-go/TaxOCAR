"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Plus, Pencil, Trash2, FileImage, ChevronDown, ChevronUp,
  Crosshair, X, Save, Upload, Layers,
} from "lucide-react";
import api, { templatesApi } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import type { Template } from "@/types";

// ─── types ────────────────────────────────────────────────────────────────────
interface Box { x: number; y: number; w: number; h: number }
type Coordinates = Record<string, Box>;
type Patterns = Record<string, string>;

const ANNOTATABLE_FIELDS = [
  { key: "vendor_name",    label: "Vendor Name" },
  { key: "vendor_gstin",   label: "Vendor GSTIN" },
  { key: "customer_name",  label: "Customer Name" },
  { key: "customer_gstin", label: "Customer GSTIN" },
  { key: "invoice_number", label: "Invoice Number" },
  { key: "invoice_date",   label: "Invoice Date" },
  { key: "taxable_amount", label: "Taxable Amount" },
  { key: "cgst",           label: "CGST" },
  { key: "sgst",           label: "SGST" },
  { key: "igst",           label: "IGST" },
  { key: "cess",           label: "CESS" },
  { key: "total_amount",   label: "Total Amount" },
  { key: "hsn_sac",        label: "HSN / SAC" },
  { key: "place_of_supply",label: "Place of Supply" },
];

const BOX_COLORS: Record<string, string> = {
  vendor_name: "#6366f1", vendor_gstin: "#8b5cf6", customer_name: "#06b6d4",
  customer_gstin: "#0ea5e9", invoice_number: "#10b981", invoice_date: "#14b8a6",
  taxable_amount: "#f59e0b", cgst: "#ef4444", sgst: "#f97316", igst: "#ec4899",
  cess: "#84cc16", total_amount: "#22c55e", hsn_sac: "#a78bfa", place_of_supply: "#fb923c",
};

// ─── canvas annotation component ──────────────────────────────────────────────
function AnnotationCanvas({
  imageUrl,
  annotations,
  onChange,
}: {
  imageUrl: string;
  annotations: Coordinates;
  onChange: (a: Coordinates) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState<{ sx: number; sy: number } | null>(null);
  const [live, setLive] = useState<Box | null>(null);
  const [selectedField, setSelectedField] = useState("vendor_name");
  const [scale, setScale] = useState(1);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgEl(img);
    img.src = imageUrl;
  }, [imageUrl]);

  // Render canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;

    const maxW = canvas.parentElement?.clientWidth ?? 800;
    const s = Math.min(1, (maxW - 4) / imgEl.naturalWidth);
    setScale(s);
    canvas.width  = Math.round(imgEl.naturalWidth  * s);
    canvas.height = Math.round(imgEl.naturalHeight * s);

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

    // Draw saved annotations
    Object.entries(annotations).forEach(([field, box]) => {
      const c = BOX_COLORS[field] || "#6366f1";
      ctx.strokeStyle = c;
      ctx.fillStyle   = c + "28";
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.rect(box.x * s, box.y * s, box.w * s, box.h * s);
      ctx.stroke();
      ctx.fill();
      // label chip
      const label = ANNOTATABLE_FIELDS.find(f => f.key === field)?.label ?? field;
      ctx.font = "bold 11px sans-serif";
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = c;
      ctx.fillRect(box.x * s, box.y * s - 17, tw, 17);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, box.x * s + 5, box.y * s - 4);
    });

    // Draw active rectangle
    if (live) {
      const c = BOX_COLORS[selectedField] || "#6366f1";
      ctx.strokeStyle = c;
      ctx.fillStyle   = c + "20";
      ctx.lineWidth   = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.rect(live.x * s, live.y * s, live.w * s, live.h * s);
      ctx.stroke();
      ctx.fill();
      ctx.setLineDash([]);
    }
  }, [imgEl, annotations, live, selectedField, scale]);

  useEffect(() => { render(); }, [render]);

  function canvasCoords(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = canvasCoords(e);
    setDrawing({ sx: x, sy: y });
    setLive({ x, y, w: 0, h: 0 });
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const { x, y } = canvasCoords(e);
    setLive({
      x: Math.round(Math.min(drawing.sx, x)),
      y: Math.round(Math.min(drawing.sy, y)),
      w: Math.round(Math.abs(x - drawing.sx)),
      h: Math.round(Math.abs(y - drawing.sy)),
    });
  }

  function onMouseUp() {
    if (drawing && live && live.w > 6 && live.h > 6) {
      onChange({ ...annotations, [selectedField]: live });
    }
    setDrawing(null);
    setLive(null);
  }

  function removeAnnotation(field: string) {
    const next = { ...annotations };
    delete next[field];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {/* Field selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-brand-500" />
          <span className="text-sm font-semibold text-slate-700">Drawing field:</span>
        </div>
        <select
          className="input w-52 text-sm"
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
        >
          {ANNOTATABLE_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <p className="text-xs text-slate-400 ml-auto">Click and drag on the invoice to mark each field</p>
      </div>

      {/* Canvas */}
      <div className="border border-slate-200 rounded-xl overflow-auto bg-slate-100" style={{ maxHeight: 520 }}>
        <canvas
          ref={canvasRef}
          className="cursor-crosshair block"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { setDrawing(null); setLive(null); }}
        />
      </div>

      {/* Annotation list */}
      {Object.keys(annotations).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Annotated fields</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(annotations).map(([field, box]) => {
              const label = ANNOTATABLE_FIELDS.find(f => f.key === field)?.label ?? field;
              const color = BOX_COLORS[field] || "#6366f1";
              return (
                <div
                  key={field}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border text-xs"
                  style={{ borderColor: color + "60" }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="font-semibold text-slate-700 flex-1 truncate">{label}</span>
                  <span className="text-slate-400 font-mono hidden sm:block">
                    {box.w}×{box.h}
                  </span>
                  <button
                    onClick={() => removeAnnotation(field)}
                    className="text-slate-300 hover:text-red-500 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── template editor modal ─────────────────────────────────────────────────────
function TemplateModal({
  template,
  onClose,
}: {
  template?: Template;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const admin = isAdmin();

  const [form, setForm] = useState({
    name: template?.name ?? "",
    vendor_gstin: template?.vendor_gstin ?? "",
    vendor_name: template?.vendor_name ?? "",
    description: template?.description ?? "",
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

  // Load existing sample image
  useEffect(() => {
    if (!template?.sample_image_path) return;
    let url: string | null = null;
    api.get(`/api/v1/templates/${template.id}/preview`, { responseType: "blob" })
      .then((r) => {
        url = URL.createObjectURL(r.data);
        setPreviewUrl(url);
      })
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
      const fd = new FormData();
      fd.append("name", form.name);
      if (form.vendor_gstin) fd.append("vendor_gstin", form.vendor_gstin.toUpperCase());
      if (form.vendor_name) fd.append("vendor_name", form.vendor_name);
      if (form.description) fd.append("description", form.description);
      if (Object.keys(coordinates).length) fd.append("coordinates", JSON.stringify(coordinates));
      if (Object.keys(patterns).length) fd.append("patterns", JSON.stringify(patterns));
      if (sampleFile) fd.append("sample_file", sampleFile);

      if (template) {
        // For update, use the JSON endpoint for metadata + coordinates/patterns
        // and separately upload sample if new file chosen
        const updateBody: Record<string, unknown> = {
          name: form.name,
          vendor_gstin: form.vendor_gstin.toUpperCase() || null,
          vendor_name: form.vendor_name || null,
          description: form.description || null,
          coordinates: Object.keys(coordinates).length ? coordinates : null,
          patterns: Object.keys(patterns).length ? patterns : null,
        };
        const r = await api.put(`/api/v1/templates/${template.id}`, updateBody);
        // If a new sample was chosen, upload via with-sample (creates new, so we just patch)
        if (sampleFile) {
          const fd2 = new FormData();
          fd2.append("name", form.name);
          if (form.vendor_gstin) fd2.append("vendor_gstin", form.vendor_gstin.toUpperCase());
          fd2.append("sample_file", sampleFile);
          await api.post("/api/v1/templates/with-sample", fd2, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
        return r;
      } else {
        return api.post("/api/v1/templates/with-sample", fd, {
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

  function addPattern() {
    if (!patternValue.trim()) return;
    setPatterns({ ...patterns, [patternField]: patternValue.trim() });
    setPatternValue("");
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {template ? "Edit Template" : "New Extraction Template"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload a sample invoice and annotate fields to improve OCR accuracy for this vendor
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: canvas */}
          <div className="flex-1 overflow-auto p-5 border-r border-slate-100">
            {previewUrl ? (
              <AnnotationCanvas
                imageUrl={previewUrl}
                annotations={coordinates}
                onChange={setCoordinates}
              />
            ) : (
              <label className="flex flex-col items-center justify-center h-full min-h-64 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
                <FileImage className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">Upload sample invoice</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG or PDF — used for annotation only</p>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) setSampleFile(e.target.files[0]); }}
                />
              </label>
            )}

            {previewUrl && (
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-brand-600 cursor-pointer hover:underline">
                <Upload className="w-3.5 h-3.5" /> Change image
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) { setSampleFile(e.target.files[0]); setCoordinates({}); } }}
                />
              </label>
            )}
          </div>

          {/* Right: form */}
          <div className="w-80 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Basic fields */}
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
                <p className="text-xs text-slate-400 mt-1">
                  Invoices from this GSTIN will auto-use this template
                </p>
              </div>
              <div>
                <label className="label">Vendor Name</label>
                <input className="input" value={form.vendor_name}
                  onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional notes" />
              </div>

              {/* Regex patterns (advanced) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPatterns((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Regex Patterns (advanced)
                  {showPatterns ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showPatterns && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400 pt-3">
                      Custom regex patterns override generic extraction. Use a capture group <code className="bg-slate-100 px-1 rounded">()</code> for the value.
                    </p>

                    {Object.entries(patterns).map(([field, pat]) => (
                      <div key={field} className="flex items-start gap-2 text-xs bg-slate-50 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-600">{field}</p>
                          <p className="font-mono text-slate-500 truncate">{pat}</p>
                        </div>
                        <button onClick={() => { const n = { ...patterns }; delete n[field]; setPatterns(n); }}
                          className="text-red-400 hover:text-red-600 flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <div className="space-y-2">
                      <select className="input text-xs" value={patternField}
                        onChange={(e) => setPatternField(e.target.value)}>
                        {ANNOTATABLE_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                      <input className="input text-xs font-mono" value={patternValue}
                        onChange={(e) => setPatternValue(e.target.value)}
                        placeholder="e.g. Invoice\s*No[:\s]*([\w/\-]+)" />
                      <button onClick={addPattern}
                        className="btn-secondary text-xs w-full justify-center">
                        Add Pattern
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Save */}
            <div className="p-5 border-t border-slate-100">
              <button
                onClick={() => { if (form.name.trim()) saveMutation.mutate(); else toast.error("Template name is required"); }}
                disabled={saveMutation.isPending}
                className="btn-primary w-full justify-center"
              >
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

// ─── templates list page ───────────────────────────────────────────────────────
export default function TemplatesPage() {
  const qc = useQueryClient();
  const admin = isAdmin();
  const [modal, setModal] = useState<"new" | Template | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: () => templatesApi.list().then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Template deleted"); },
    onError: () => toast.error("Failed to delete"),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-40" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-brand-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">No templates yet</h3>
          <p className="text-slate-400 text-sm max-w-sm">
            Create a template by uploading a sample invoice from a vendor and annotating which region contains each field.
          </p>
          {admin && (
            <button onClick={() => setModal("new")} className="btn-primary mt-5">
              <Plus className="w-4 h-4" /> Create first template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              admin={admin}
              onEdit={() => setModal(t)}
              onDelete={() => {
                if (confirm(`Delete template "${t.name}"?`)) deleteMutation.mutate(t.id);
              }}
            />
          ))}
        </div>
      )}

      {modal && (
        <TemplateModal
          template={modal === "new" ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── template card ─────────────────────────────────────────────────────────────
function TemplateCard({
  template,
  admin,
  onEdit,
  onDelete,
}: {
  template: Template;
  admin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const coordCount = template.coordinates ? Object.keys(template.coordinates).length : 0;
  const patternCount = template.patterns ? Object.keys(template.patterns).length : 0;

  return (
    <div className="card group hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {template.name.charAt(0).toUpperCase()}
        </div>
        {admin && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <h3 className="font-bold text-slate-900 text-sm mb-1 truncate">{template.name}</h3>

      {template.vendor_gstin && (
        <span className="inline-block font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg mb-2">
          {template.vendor_gstin}
        </span>
      )}

      {template.description && (
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{template.description}</p>
      )}

      <div className="flex items-center gap-3 mt-auto pt-3 border-t border-slate-100">
        {coordCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-emerald-600">
            <Crosshair className="w-3.5 h-3.5" />
            <span>{coordCount} fields annotated</span>
          </div>
        )}
        {patternCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-brand-600">
            <span className="font-mono text-xs">.*</span>
            <span>{patternCount} patterns</span>
          </div>
        )}
        {coordCount === 0 && patternCount === 0 && (
          <span className="text-xs text-slate-400">No annotations yet</span>
        )}
      </div>
    </div>
  );
}
