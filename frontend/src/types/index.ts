export type UserRole = "admin" | "accountant" | "reviewer";

export interface User {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  user_id: string;
  org_id: string;
  role: UserRole;
  full_name: string;
}

export interface Client {
  id: string;
  org_id: string;
  name: string;
  gstin: string | null;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  total_invoices: number;
  pending_review: number;
  processed: number;
}

export type InvoiceStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "needs_review"
  | "needs_template"
  | "approved"
  | "rejected";

export interface Invoice {
  id: string;
  org_id: string;
  client_id: string;
  client_name?: string;
  template_id: string | null;
  original_filename: string;
  file_path: string;
  file_type: string;
  status: InvoiceStatus;
  is_scanned: boolean;
  ocr_confidence: number | null;
  vendor_name: string | null;
  vendor_gstin: string | null;
  customer_name: string | null;
  customer_gstin: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  taxable_amount: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  cess: number | null;
  total_amount: number | null;
  hsn_sac: string | null;
  place_of_supply: string | null;
  state: string | null;
  field_confidence: Record<string, number> | null;
  validation_errors: string[] | null;
  is_duplicate: boolean;
  duplicate_of: string | null;
  uploaded_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditLog {
  id: string;
  invoice_id: string;
  user_id: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user_name: string | null;
}

export interface Template {
  id: string;
  org_id: string;
  name: string;
  vendor_gstin: string | null;
  vendor_name: string | null;
  sample_image_path: string | null;
  coordinates: Record<string, unknown> | null;
  patterns: Record<string, string> | null;
  description: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_clients: number;
  total_invoices: number;
  pending_review: number;
  processed_today: number;
  failed_ocr: number;
  needs_template: number;
}

export interface RecentUpload {
  id: string;
  original_filename: string;
  client_name: string;
  status: InvoiceStatus;
  created_at: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recent_uploads: RecentUpload[];
}
