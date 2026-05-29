"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
} from "@tanstack/react-table";
import toast from "react-hot-toast";
import {
  Search, Check, X, ChevronLeft, ChevronRight, Eye,
  AlertTriangle, CheckCircle2, Filter
} from "lucide-react";
import { invoicesApi, clientsApi } from "@/lib/api";
import { formatCurrency, formatDate, statusColor, statusLabel } from "@/lib/utils";
import { useAuth } from "@/lib/useAuth";
import type { Invoice, InvoiceListResponse, Client } from "@/types";
import InvoiceDetailModal from "@/components/review/InvoiceDetailModal";

const columnHelper = createColumnHelper<Invoice>();

const STATUSES = [
  { value: "", label: "All Status" },
  { value: "needs_review", label: "Needs Review" },
  { value: "needs_template", label: "No Template" },
  { value: "completed", label: "Completed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
  { value: "processing", label: "Processing" },
  { value: "pending", label: "Pending" },
];

export default function ReviewPage() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { isReviewer: reviewer } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState(searchParams.get("client_id") || "");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openInvoice, setOpenInvoice] = useState<Invoice | null>(null);

  const { data, isLoading } = useQuery<InvoiceListResponse>({
    queryKey: ["invoices", { page, search, client_id: clientFilter, status: statusFilter }],
    queryFn: () =>
      invoicesApi
        .list({
          page,
          page_size: 50,
          ...(search && { search }),
          ...(clientFilter && { client_id: clientFilter }),
          ...(statusFilter && { status: statusFilter }),
        })
        .then((r) => r.data),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => clientsApi.list().then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Approved"); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.reject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Rejected"); },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => invoicesApi.bulkApprove(ids),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`${res.data.approved} invoices approved`);
      setSelected(new Set());
    },
  });

  const invoices = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === invoices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(invoices.map((i) => i.id)));
    }
  }

  const columns = [
    columnHelper.display({
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={selected.size === invoices.length && invoices.length > 0}
          onChange={toggleAll}
          className="rounded"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selected.has(row.original.id)}
          onChange={() => toggleSelect(row.original.id)}
          className="rounded"
        />
      ),
    }),
    columnHelper.accessor("invoice_number", {
      header: "Invoice #",
      cell: (info) => <span className="font-mono text-xs">{info.getValue() || "—"}</span>,
    }),
    columnHelper.accessor("invoice_date", {
      header: "Date",
      cell: (info) => <span className="text-xs">{info.getValue() || "—"}</span>,
    }),
    columnHelper.accessor("vendor_name", {
      header: "Vendor",
      cell: (info) => (
        <div className="max-w-[180px]">
          <div className="truncate text-sm">{info.getValue() || "—"}</div>
          {info.row.original.vendor_gstin && (
            <div className="text-xs text-gray-400 font-mono truncate">{info.row.original.vendor_gstin}</div>
          )}
        </div>
      ),
    }),
    columnHelper.accessor("client_name", {
      header: "Client",
      cell: (info) => <span className="text-xs text-gray-600">{info.getValue() || "—"}</span>,
    }),
    columnHelper.accessor("taxable_amount", {
      header: "Taxable",
      cell: (info) => <span className="text-xs">{formatCurrency(info.getValue())}</span>,
    }),
    columnHelper.accessor("cgst", {
      header: "CGST",
      cell: (info) => <span className="text-xs">{formatCurrency(info.getValue())}</span>,
    }),
    columnHelper.accessor("sgst", {
      header: "SGST",
      cell: (info) => <span className="text-xs">{formatCurrency(info.getValue())}</span>,
    }),
    columnHelper.accessor("igst", {
      header: "IGST",
      cell: (info) => <span className="text-xs">{formatCurrency(info.getValue())}</span>,
    }),
    columnHelper.accessor("total_amount", {
      header: "Total",
      cell: (info) => <span className="text-sm font-medium">{formatCurrency(info.getValue())}</span>,
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => {
        const inv = info.row.original;
        return (
          <div className="flex flex-col gap-1">
            <span className={`badge ${statusColor(info.getValue())}`}>
              {statusLabel(info.getValue())}
            </span>
            {inv.is_duplicate && (
              <span className="badge bg-red-100 text-red-700">Duplicate</span>
            )}
            {(inv.validation_errors?.length ?? 0) > 0 && (
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor("ocr_confidence", {
      header: "Confidence",
      cell: (info) => {
        const raw = info.getValue();
        if (raw == null) return <span className="text-slate-300 text-xs">—</span>;
        const val = Number(raw);
        const color = val >= 80 ? "text-emerald-600" : val >= 60 ? "text-amber-600" : "text-red-500";
        return <span className={`text-xs font-semibold ${color}`}>{val.toFixed(0)}%</span>;
      },
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOpenInvoice(inv)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title="View & Edit"
            >
              <Eye className="w-4 h-4" />
            </button>
            {reviewer && inv.status !== "approved" && inv.status !== "rejected" && (
              <>
                <button
                  onClick={() => approveMutation.mutate(inv.id)}
                  className="p-1.5 rounded hover:bg-green-50 text-gray-500 hover:text-green-600"
                  title="Approve"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => rejectMutation.mutate(inv.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                  title="Reject"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 w-56"
            placeholder="Search vendor, invoice..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-44"
          value={clientFilter}
          onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="input w-44"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {selected.size > 0 && reviewer && (
          <button
            onClick={() => bulkApproveMutation.mutate(Array.from(selected))}
            disabled={bulkApproveMutation.isPending}
            className="btn-primary"
          >
            <CheckCircle2 className="w-4 h-4" />
            Approve {selected.size} selected
          </button>
        )}

        <div className="ml-auto text-sm text-gray-500">
          {total.toLocaleString()} invoices
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="text-left px-3 py-3 text-gray-600 font-medium whitespace-nowrap">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: columns.length }).map((_, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded" /></td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                  No invoices found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-gray-50 ${selected.has(row.original.id) ? "bg-brand-50" : ""}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {openInvoice && (
        <InvoiceDetailModal
          invoice={openInvoice}
          onClose={() => setOpenInvoice(null)}
          onUpdate={(updated) => {
            setOpenInvoice(updated);
            qc.invalidateQueries({ queryKey: ["invoices"] });
          }}
        />
      )}
    </div>
  );
}
