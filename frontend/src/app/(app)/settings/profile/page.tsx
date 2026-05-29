"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { usersApi } from "@/lib/api";
import { getSession } from "@/lib/auth";

export default function ProfilePage() {
  const session = getSession();
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const mutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      usersApi.changePassword(data),
    onSuccess: () => {
      toast.success("Password changed successfully");
      setForm({ current_password: "", new_password: "", confirm_password: "" });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to change password";
      toast.error(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error("New passwords do not match");
      return;
    }
    if (form.new_password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    mutation.mutate({
      current_password: form.current_password,
      new_password: form.new_password,
    });
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="card p-6">
        <h2 className="font-semibold mb-4">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <p className="text-sm text-gray-900">{session?.full_name}</p>
          </div>
          <div>
            <label className="label">Role</label>
            <p className="text-sm text-gray-900 capitalize">{session?.role}</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-4">Change Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input
              type="password"
              className="input"
              value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              className="input"
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              className="input"
              value={form.confirm_password}
              onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
              required
            />
          </div>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
