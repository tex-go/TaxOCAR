"use client";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/clients": "Clients",
  "/upload": "Upload Invoices",
  "/review": "Review Invoices",
  "/exports": "Exports",
  "/settings": "Settings",
  "/settings/users": "User Management",
  "/settings/templates": "Invoice Templates",
};

export default function Header() {
  const pathname = usePathname();
  const title = Object.entries(pageTitles).find(([path]) => pathname === path || pathname.startsWith(path + "/"))?.[1] || "TaxOCR";

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
    </header>
  );
}
