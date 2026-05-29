"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Search, Building2, Pencil, Trash2, FileText, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { clientsApi } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import type { Client } from "@/types";

function ClientModal({ client, onClose }: { client?: Client; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: client?.name || "",
    gstin: client?.gstin || "",
    contact_person: client?.contact_person || "",
    mobile: client?.mobile || "",
    email: client?.email || "",
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      client ? clientsApi.update(client.id, data) : clientsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(client ? "Client updated" : "Client created");
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to save";
      toast.error(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-5">
          {client ? "Edit Client" : "New Client"}
        </h2>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">Client Name *</label>
            <input className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">GSTIN</label>
            <input className="input font-mono" value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
              placeholder="22AAAAA0000A1Z5" maxLength={15} />
          </div>
          <div>
            <label className="label">Contact Person</label>
            <input className="input" value={form.contact_person}
              onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mobile</label>
              <input className="input" value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 justify-center">
              {mutation.isPending ? "Saving…" : "Save Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"new" | Client | null>(null);
  const { isAdmin: admin } = useAuth();

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => clientsApi.list().then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Client deleted"); },
    onError: () => toast.error("Failed to delete"),
  });

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.gstin || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-10" placeholder="Search by name or GSTIN…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-slate-400">{filtered.length} clients</span>
          {admin && (
            <button onClick={() => setModal("new")} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Client
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="table-th">Client</th>
              <th className="table-th">GSTIN</th>
              <th className="table-th">Contact</th>
              <th className="table-th text-center">Total</th>
              <th className="table-th text-center">Pending</th>
              <th className="table-th text-center">Processed</th>
              <th className="table-th w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="table-td"><div className="h-4 bg-slate-100 rounded-lg" /></td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="table-td py-16 text-center">
                    <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">{search ? "No clients match your search" : "No clients yet"}</p>
                    {!search && admin && (
                      <button onClick={() => setModal("new")} className="mt-3 text-sm text-brand-600 font-semibold hover:underline">
                        + Add your first client
                      </button>
                    )}
                  </td>
                </tr>
              )
              : filtered.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-brand-600 bg-brand-50 flex-shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{client.name}</p>
                        {client.email && <p className="text-xs text-slate-400">{client.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="table-td">
                    <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                      {client.gstin || "—"}
                    </span>
                  </td>
                  <td className="table-td text-slate-600">
                    <p className="font-medium text-slate-700">{client.contact_person || "—"}</p>
                    {client.mobile && <p className="text-xs text-slate-400">{client.mobile}</p>}
                  </td>
                  <td className="table-td text-center">
                    <span className="font-semibold text-slate-900">{client.total_invoices}</span>
                  </td>
                  <td className="table-td text-center">
                    {client.pending_review > 0
                      ? <span className="inline-flex items-center gap-1 text-amber-600 font-semibold"><Clock className="w-3.5 h-3.5" />{client.pending_review}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="table-td text-center">
                    {client.processed > 0
                      ? <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />{client.processed}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="table-td">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/review?client_id=${client.id}`}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600" title="View invoices">
                        <FileText className="w-4 h-4" />
                      </Link>
                      {admin && <>
                        <button onClick={() => setModal(client)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (confirm(`Delete "${client.name}"?`)) deleteMutation.mutate(client.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modal && <ClientModal client={modal === "new" ? undefined : modal} onClose={() => setModal(null)} />}
    </div>
  );
}
