"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Search, Building2, Pencil, Trash2, FileText } from "lucide-react";
import Link from "next/link";
import { clientsApi } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import type { Client } from "@/types";

function ClientModal({
  client,
  onClose,
}: {
  client?: Client;
  onClose: () => void;
}) {
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
    onError: () => toast.error("Failed to save client"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{client ? "Edit Client" : "New Client"}</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}
          className="space-y-4"
        >
          <div>
            <label className="label">Client Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">GSTIN</label>
            <input
              className="input"
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
            />
          </div>
          <div>
            <label className="label">Contact Person</label>
            <input className="input" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mobile</label>
              <input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 justify-center">
              {mutation.isPending ? "Saving..." : "Save"}
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

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => clientsApi.list().then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Client deleted"); },
    onError: () => toast.error("Failed to delete client"),
  });

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.gstin || "").toLowerCase().includes(search.toLowerCase())
  );

  const admin = isAdmin();

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {admin && (
          <button onClick={() => setModal("new")} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Client</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">GSTIN</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Contact</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Invoices</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Pending</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Processed</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  {search ? "No clients found" : "No clients yet. Create your first client."}
                </td>
              </tr>
            ) : (
              filtered.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{client.name}</div>
                        {client.email && <div className="text-xs text-gray-500">{client.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{client.gstin || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {client.contact_person || "—"}
                    {client.mobile && <div className="text-xs text-gray-400">{client.mobile}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{client.total_invoices}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={client.pending_review > 0 ? "text-yellow-600 font-medium" : "text-gray-400"}>
                      {client.pending_review}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{client.processed}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/review?client_id=${client.id}`}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                        title="View invoices"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      {admin && (
                        <>
                          <button
                            onClick={() => setModal(client)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete client "${client.name}"?`)) {
                                deleteMutation.mutate(client.id);
                              }
                            }}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <ClientModal
          client={modal === "new" ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
