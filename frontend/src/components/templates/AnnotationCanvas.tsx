"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { Crosshair, X } from "lucide-react";

export interface Box { x: number; y: number; w: number; h: number }
export type Coordinates = Record<string, Box>;

export const ANNOTATABLE_FIELDS = [
  { key: "vendor_name",     label: "Vendor Name" },
  { key: "vendor_gstin",    label: "Vendor GSTIN" },
  { key: "customer_name",   label: "Customer Name" },
  { key: "customer_gstin",  label: "Customer GSTIN" },
  { key: "invoice_number",  label: "Invoice Number" },
  { key: "invoice_date",    label: "Invoice Date" },
  { key: "taxable_amount",  label: "Taxable Amount" },
  { key: "cgst",            label: "CGST" },
  { key: "sgst",            label: "SGST" },
  { key: "igst",            label: "IGST" },
  { key: "cess",            label: "CESS" },
  { key: "total_amount",    label: "Total Amount" },
  { key: "hsn_sac",         label: "HSN / SAC" },
  { key: "place_of_supply", label: "Place of Supply" },
  { key: "state",           label: "State" },
];

export const BOX_COLORS: Record<string, string> = {
  vendor_name: "#6366f1", vendor_gstin: "#8b5cf6", customer_name: "#06b6d4",
  customer_gstin: "#0ea5e9", invoice_number: "#10b981", invoice_date: "#14b8a6",
  taxable_amount: "#f59e0b", cgst: "#ef4444", sgst: "#f97316", igst: "#ec4899",
  cess: "#84cc16", total_amount: "#22c55e", hsn_sac: "#a78bfa", place_of_supply: "#fb923c",
  state: "#64748b",
};

export default function AnnotationCanvas({
  imageUrl,
  annotations,
  onChange,
  height = 520,
}: {
  imageUrl: string;
  annotations: Coordinates;
  onChange: (a: Coordinates) => void;
  height?: number;
}) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const [imgEl, setImgEl]       = useState<HTMLImageElement | null>(null);
  const [drawing, setDrawing]   = useState<{ sx: number; sy: number } | null>(null);
  const [live, setLive]         = useState<Box | null>(null);
  const [selectedField, setSelectedField] = useState("vendor_name");
  const [scale, setScale]       = useState(1);

  useEffect(() => {
    const img = new Image();
    img.onload  = () => setImgEl(img);
    img.onerror = () => {};
    img.src = imageUrl;
  }, [imageUrl]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;

    const maxW = (canvas.parentElement?.clientWidth ?? 800) - 4;
    const s = Math.min(1, maxW / imgEl.naturalWidth);
    setScale(s);
    canvas.width  = Math.round(imgEl.naturalWidth  * s);
    canvas.height = Math.round(imgEl.naturalHeight * s);

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

    Object.entries(annotations).forEach(([field, box]) => {
      const c = BOX_COLORS[field] || "#6366f1";
      ctx.strokeStyle = c; ctx.fillStyle = c + "28"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(box.x * s, box.y * s, box.w * s, box.h * s);
      ctx.stroke(); ctx.fill();
      const label = ANNOTATABLE_FIELDS.find(f => f.key === field)?.label ?? field;
      ctx.font = "bold 11px sans-serif";
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = c;
      ctx.fillRect(box.x * s, box.y * s - 17, tw, 17);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, box.x * s + 5, box.y * s - 4);
    });

    if (live) {
      const c = BOX_COLORS[selectedField] || "#6366f1";
      ctx.strokeStyle = c; ctx.fillStyle = c + "20"; ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.rect(live.x * s, live.y * s, live.w * s, live.h * s);
      ctx.stroke(); ctx.fill(); ctx.setLineDash([]);
    }
  }, [imgEl, annotations, live, selectedField, scale]);

  useEffect(() => { render(); }, [render]);

  function canvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
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
      x: Math.round(Math.min(drawing.sx, x)), y: Math.round(Math.min(drawing.sy, y)),
      w: Math.round(Math.abs(x - drawing.sx)), h: Math.round(Math.abs(y - drawing.sy)),
    });
  }
  function onMouseUp() {
    if (drawing && live && live.w > 6 && live.h > 6)
      onChange({ ...annotations, [selectedField]: live });
    setDrawing(null); setLive(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-brand-500" />
          <span className="text-sm font-semibold text-slate-700">Field to annotate:</span>
        </div>
        <select className="input w-52 text-sm" value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}>
          {ANNOTATABLE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <p className="text-xs text-slate-400 ml-auto">Drag on the invoice to mark each field</p>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-auto bg-slate-100"
           style={{ maxHeight: height }}>
        {imgEl ? (
          <canvas ref={canvasRef} className="cursor-crosshair block"
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
            onMouseLeave={() => { setDrawing(null); setLive(null); }} />
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Loading invoice preview…
          </div>
        )}
      </div>

      {Object.keys(annotations).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Annotated fields</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(annotations).map(([field, box]) => {
              const label = ANNOTATABLE_FIELDS.find(f => f.key === field)?.label ?? field;
              const color = BOX_COLORS[field] || "#6366f1";
              return (
                <div key={field} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border text-xs"
                     style={{ borderColor: color + "60" }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="font-semibold text-slate-700 flex-1 truncate">{label}</span>
                  <span className="text-slate-400 font-mono hidden sm:block">{box.w}×{box.h}</span>
                  <button onClick={() => { const n = { ...annotations }; delete n[field]; onChange(n); }}
                    className="text-slate-300 hover:text-red-500 ml-1">
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
