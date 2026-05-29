import axios from "axios";
import Cookies from "js-cookie";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      Cookies.remove("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/api/v1/auth/login", { email, password }),
  register: (data: { org_name: string; admin_email: string; admin_password: string; admin_name: string }) =>
    api.post("/api/v1/auth/register", data),
};

// Dashboard
export const dashboardApi = {
  get: () => api.get("/api/v1/dashboard/"),
};

// Clients
export const clientsApi = {
  list: () => api.get("/api/v1/clients/"),
  get: (id: string) => api.get(`/api/v1/clients/${id}`),
  create: (data: unknown) => api.post("/api/v1/clients/", data),
  update: (id: string, data: unknown) => api.put(`/api/v1/clients/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/clients/${id}`),
};

// Invoices
export const invoicesApi = {
  list: (params?: Record<string, unknown>) => api.get("/api/v1/invoices/", { params }),
  get: (id: string) => api.get(`/api/v1/invoices/${id}`),
  update: (id: string, data: unknown) => api.put(`/api/v1/invoices/${id}`, data),
  approve: (id: string) => api.post(`/api/v1/invoices/${id}/approve`),
  reject: (id: string) => api.post(`/api/v1/invoices/${id}/reject`),
  bulkApprove: (ids: string[]) => api.post("/api/v1/invoices/bulk-approve", ids),
  getAuditLog: (id: string) => api.get(`/api/v1/invoices/${id}/audit`),
  getPreviewUrl: (id: string) => api.get(`/api/v1/invoices/${id}/preview-url`),
  upload: (clientId: string, files: File[], onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append("client_id", clientId);
    files.forEach((f) => formData.append("files", f));
    return api.post("/api/v1/invoices/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },
};

// Templates
export const templatesApi = {
  list: () => api.get("/api/v1/templates/"),
  get: (id: string) => api.get(`/api/v1/templates/${id}`),
  create: (data: unknown) => api.post("/api/v1/templates/", data),
  update: (id: string, data: unknown) => api.put(`/api/v1/templates/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/templates/${id}`),
  createWithSample: (formData: FormData) =>
    api.post("/api/v1/templates/with-sample", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// Users
export const usersApi = {
  me: () => api.get("/api/v1/users/me"),
  list: () => api.get("/api/v1/users/"),
  create: (data: unknown) => api.post("/api/v1/users/", data),
  update: (id: string, data: unknown) => api.put(`/api/v1/users/${id}`, data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post("/api/v1/users/change-password", data),
};

// Exports
export const exportsApi = {
  purchaseRegister: (params?: Record<string, unknown>) =>
    api.get("/api/v1/exports/purchase-register", { params, responseType: "blob" }),
  gstUpload: (params?: Record<string, unknown>) =>
    api.get("/api/v1/exports/gst-upload", { params, responseType: "blob" }),
  csv: (params?: Record<string, unknown>) =>
    api.get("/api/v1/exports/csv", { params, responseType: "blob" }),
};
