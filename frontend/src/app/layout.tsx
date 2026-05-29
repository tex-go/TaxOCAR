import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import QueryProvider from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "TaxOCR — Invoice Processing for CA Firms",
  description: "Automated invoice OCR and GST data extraction for Chartered Accountants",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          {children}
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </QueryProvider>
      </body>
    </html>
  );
}
