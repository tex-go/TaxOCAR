# TaxOCR

**Invoice OCR and GST processing for CA firms.**

Automates invoice collection, OCR extraction, data validation, review, and GST-ready Excel export for Chartered Accountants and accounting firms.

---

## Quick Start

### Prerequisites

- Docker & Docker Compose

### Run

```bash
docker-compose up --build
```

Services:
| Service  | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| MinIO Console | http://localhost:9001 |

### Seed demo data

```bash
docker-compose exec backend python seed.py
```

Demo credentials:
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@abcauditors.com | admin123 |
| Accountant | accountant@abcauditors.com | accountant123 |
| Reviewer | reviewer@abcauditors.com | reviewer123 |

---

## Architecture

```
Frontend (Next.js 14)  ─────►  Backend (FastAPI)  ─────►  PostgreSQL
                                      │
                                      ├──────►  Redis
                                      │           │
                                      │     Celery Worker
                                      │       (OCR tasks)
                                      │
                                      └──────►  MinIO (file storage)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, TailwindCSS, TanStack Table |
| Backend | FastAPI (Python 3.11) |
| Database | PostgreSQL 15 |
| Queue | Celery + Redis |
| OCR | Tesseract, OpenCV, pdfplumber, PyMuPDF |
| Storage | MinIO (S3-compatible) |
| Auth | JWT + RBAC |

## Features

- **Multi-tenant**: Organization → Clients → Invoices isolation
- **Roles**: Admin, Accountant, Reviewer with fine-grained permissions
- **Bulk upload**: Drag & drop, 1000+ files, PDF/JPG/PNG
- **OCR pipeline**: Auto text extraction for digital PDFs; Tesseract + OpenCV for scanned
- **Template matching**: Auto-apply vendor-specific extraction rules by GSTIN
- **Validation**: GSTIN format, tax calculation check, duplicate detection
- **Review screen**: TanStack Table with inline editing, bulk approve, confidence highlighting
- **Export**: Purchase Register (Excel), GST Upload format, CSV
- **Audit trail**: Every field change tracked with user and timestamp

## User Roles

| Action | Admin | Accountant | Reviewer |
|--------|-------|------------|----------|
| Manage users | ✓ | | |
| Manage clients | ✓ | | |
| Manage templates | ✓ | | |
| Upload invoices | ✓ | ✓ | |
| Review & edit | ✓ | ✓ | |
| Approve invoices | ✓ | | ✓ |
| Export reports | ✓ | | ✓ |

## Development

### Backend only

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
celery -A app.core.celery_app worker --loglevel=info
```

### Frontend only

```bash
cd frontend
npm install
npm run dev
```

### Environment variables

Copy `backend/.env` and adjust for production. Key variables:

```
SECRET_KEY=<strong-random-key>
DATABASE_URL=postgresql://...
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
```
