"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Pencil, ShieldCheck, User, Eye } from "lucide-react";
import { usersApi } from "@/lib/api";
import type { User, UserRole } from "@/types";

const ROLES: { value: UserRole; label: string; icon: React.ElementType; desc: string }[] = [
  { value: "admin", label: "Admin", icon: ShieldCheck, desc: "Full access" },
  { value: "reviewer", label: "Reviewer", icon: Eye, desc: "Review & approve" },
  { value: "accountant", label: "Accountant", icon: User, desc: "Upload & edit" },
];

function UserModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    email: user?.email || "",
    full_name: user?.full_name || "",
    role: (user?.role || "accountant") as UserRole,
    password: "",
    is_active: user?.is_active ?? true,
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      user
        ? usersApi.update(user.id, { full_name: data.full_name, role: data.role, is_active: data.is_active })
        : usersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(user ? "User updated" : "User created");
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed";
      toast.error(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{user ? "Edit User" : "Invite User"}</h2>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          {!user && (
            <>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              </div>
            </>
          )}
          <div>
            <label className="label">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, role: value })}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-sm transition-colors ${
                    form.role === value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{label}</span>
                  <span className="text-xs opacity-70">{desc}</span>
                </button>
              ))}
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm">Active</label>
            </div>
          )}
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

export default function UsersPage() {
  const [modal, setModal] = useState<"new" | User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const roleConfig: Record<UserRole, { color: string }> = {
    admin: { color: "bg-purple-100 text-purple-700" },
    reviewer: { color: "bg-blue-100 text-blue-700" },
    accountant: { color: "bg-green-100 text-green-700" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{users.length} members</p>
        <button onClick={() => setModal("new")} className="btn-primary">
          <Plus className="w-4 h-4" /> Invite User
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
        ) : users.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">No users found</div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium text-sm">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{user.full_name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${roleConfig[user.role].color}`}>{user.role}</span>
                {!user.is_active && (
                  <span className="badge bg-gray-100 text-gray-500">Inactive</span>
                )}
                <button onClick={() => setModal(user)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <UserModal user={modal === "new" ? undefined : modal} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
