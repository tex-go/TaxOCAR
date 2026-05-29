"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Download, FileSpreadsheet, FileText, File } from "lucide-react";
import { clientsApi, exportsApi } from "@/lib/api";
import { downloadBlob } from "@/lib/utils";
import type { Client } from "@/types";

const EXPORT_TYPES = [
  {
    id: "purchase",
    label: "Purchase Register",
    description: "All purchase invoices with vendor GSTIN, HSN, tax breakup",
    icon: FileSpreadsheet,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    id: "gst",
    label: "GST Upload Format",
    description: "GSTR-2A compatible format for direct GST portal upload",
    icon: FileSpreadsheet,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    id: "csv",
    label: "CSV Export",
    description: "Raw data export for all invoices in CSV format",
    icon: FileText,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
];

export default function ExportsPage() {
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => clientsApi.list().then((r) => r.data),
  });

  async function handleExport(type: string) {
    setLoading(type);
    try {
      const params = clientId ? { client_id: clientId } : {};

      let res;
      let filename: string;

      if (type === "purchase") {
        res = await exportsApi.purchaseRegister(params);
        filename = "purchase_register.xlsx";
      } else if (type === "gst") {
        res = await exportsApi.gstUpload(params);
        filename = "gst_upload.xlsx";
      } else {
        res = await exportsApi.csv(params);
        filename = "invoices.csv";
      }

      downloadBlob(res.data, filename);
      toast.success(`${filename} downloaded`);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Filters */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Export Filters</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Client (optional)</label>
            <select
              className="input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Export options */}
      <div className="space-y-3">
        {EXPORT_TYPES.map(({ id, label, description, icon: Icon, color, bg }) => (
          <div key={id} className="card p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{label}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{description}</p>
            </div>
            <button
              onClick={() => handleExport(id)}
              disabled={loading === id}
              className="btn-primary flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              {loading === id ? "Generating..." : "Download"}
            </button>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700">
        <strong>Note:</strong> Exports include only approved and completed invoices by default.
        The Purchase Register is formatted for manual GST reconciliation.
        The GST Upload format follows GSTN's standard template.
      </div>
    </div>
  );
}
