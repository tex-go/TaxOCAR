"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2, ChevronRight } from "lucide-react";
import { clientsApi, invoicesApi } from "@/lib/api";
import type { Client } from "@/types";
import Link from "next/link";

type FileState = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
};

export default function UploadPage() {
  const [clientId, setClientId] = useState("");
  const [files, setFiles] = useState<FileState[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => clientsApi.list().then((r) => r.data),
  });

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles = accepted.map((f) => ({
      file: f,
      status: "pending" as const,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
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

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (!clientId) {
      toast.error("Please select a client first");
      return;
    }
    if (files.length === 0) {
      toast.error("Please add files to upload");
      return;
    }

    setUploading(true);
    const BATCH_SIZE = 20;
    const allFiles = files.map((f) => f.file);
    const ids: string[] = [];

    try {
      for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
        const batch = allFiles.slice(i, i + BATCH_SIZE);
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx >= i && idx < i + BATCH_SIZE ? { ...f, status: "uploading" } : f
          )
        );

        const res = await invoicesApi.upload(clientId, batch, (pct) => {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx >= i && idx < i + BATCH_SIZE ? { ...f, progress: pct } : f
            )
          );
        });

        const batchIds: string[] = res.data.invoice_ids || [];
        ids.push(...batchIds);

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx >= i && idx < i + BATCH_SIZE ? { ...f, status: "done", progress: 100 } : f
          )
        );
      }

      setUploaded(ids);
      toast.success(`${ids.length} invoice(s) queued for processing`);
    } catch {
      toast.error("Upload failed. Please try again.");
      setFiles((prev) =>
        prev.map((f) => f.status === "uploading" ? { ...f, status: "error" } : f)
      );
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setFiles([]);
    setUploaded([]);
  }

  if (uploaded.length > 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Upload Successful</h2>
        <p className="text-gray-500 mb-6">
          {uploaded.length} invoice(s) are being processed in the background. This may take a few minutes.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-secondary">Upload More</button>
          <Link href="/review" className="btn-primary">
            Go to Review <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Client selection */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4">Step 1: Select Client</h2>
        <select
          className="input"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">-- Select a client --</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
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
            isDragActive
              ? "border-brand-500 bg-brand-50"
              : "border-gray-300 hover:border-brand-400 hover:bg-gray-50"
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
                      <div
                        className="h-1 rounded-full bg-brand-500 transition-all"
                        style={{ width: `${fs.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {fs.status === "pending" && (
                    <button onClick={() => removeFile(i)} className="p-1 rounded hover:bg-gray-200 text-gray-400">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {fs.status === "uploading" && <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />}
                  {fs.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {fs.status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {files.length} file(s) selected
        </p>
        <button
          onClick={handleUpload}
          disabled={uploading || files.length === 0 || !clientId}
          className="btn-primary"
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
          ) : (
            <><Upload className="w-4 h-4" /> Upload & Process</>
          )}
        </button>
      </div>
    </div>
  );
}
