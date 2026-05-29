"use client";
import Link from "next/link";
import { Users, FileCode2, Key } from "lucide-react";
import { isAdmin } from "@/lib/auth";

const sections = [
  {
    href: "/settings/users",
    label: "User Management",
    description: "Add and manage accountants and reviewers in your organization",
    icon: Users,
    adminOnly: true,
  },
  {
    href: "/settings/templates",
    label: "Invoice Templates",
    description: "Create extraction templates for different vendor invoice formats",
    icon: FileCode2,
    adminOnly: true,
  },
  {
    href: "/settings/profile",
    label: "Profile & Password",
    description: "Update your profile and change your password",
    icon: Key,
    adminOnly: false,
  },
];

export default function SettingsPage() {
  const admin = isAdmin();

  return (
    <div className="max-w-2xl space-y-3">
      {sections.map(({ href, label, description, icon: Icon, adminOnly }) => {
        if (adminOnly && !admin) return null;
        return (
          <Link key={href} href={href} className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow block">
            <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <h3 className="font-medium">{label}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{description}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
