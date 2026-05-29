from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import io
from datetime import datetime

from app.db.session import get_db
from app.api.deps import get_current_user, require_reviewer_or_admin
from app.models.user import User
from app.models.invoice import Invoice, InvoiceStatus, InvoiceAuditLog
from app.models.client import Client
from app.schemas.invoice import InvoiceResponse, InvoiceFieldUpdate, AuditLogResponse, InvoiceListResponse
from app.services.storage import StorageService
from app.tasks.ocr_tasks import process_invoice_task

router = APIRouter(prefix="/invoices", tags=["invoices"])

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/jpg": "jpg",
}


def _to_response(invoice: Invoice, db: Session) -> InvoiceResponse:
    resp = InvoiceResponse.model_validate(invoice)
    if invoice.client:
        resp.client_name = invoice.client.name
    return resp


@router.post("/upload", status_code=202)
async def upload_invoices(
    client_id: str = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == client_id, Client.org_id == current_user.org_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    storage = StorageService()
    created_ids = []

    for file in files:
        content_type = file.content_type or ""
        file_ext = ALLOWED_TYPES.get(content_type)
        if not file_ext:
            filename_lower = (file.filename or "").lower()
            if filename_lower.endswith(".pdf"):
                file_ext = "pdf"
            elif filename_lower.endswith((".jpg", ".jpeg")):
                file_ext = "jpg"
            elif filename_lower.endswith(".png"):
                file_ext = "png"
            else:
                continue

        file_data = await file.read()
        invoice_id = uuid.uuid4()
        year = datetime.now().year
        month = datetime.now().strftime("%m")
        object_name = f"{current_user.org_id}/{client_id}/{year}/{month}/{invoice_id}.{file_ext}"

        storage.upload(object_name, file_data, content_type or f"application/{file_ext}")

        invoice = Invoice(
            id=invoice_id,
            org_id=current_user.org_id,
            client_id=client_id,
            uploaded_by=current_user.id,
            original_filename=file.filename or f"{invoice_id}.{file_ext}",
            file_path=object_name,
            file_type=file_ext,
            file_size=len(file_data),
            status=InvoiceStatus.pending,
        )
        db.add(invoice)
        db.flush()

        log = InvoiceAuditLog(
            org_id=current_user.org_id,
            invoice_id=invoice.id,
            user_id=current_user.id,
            action="uploaded",
        )
        db.add(log)
        created_ids.append(str(invoice_id))

    db.commit()

    for invoice_id in created_ids:
        process_invoice_task.delay(invoice_id)

    return {"queued": len(created_ids), "invoice_ids": created_ids}


@router.get("/", response_model=InvoiceListResponse)
def list_invoices(
    client_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Invoice).filter(Invoice.org_id == current_user.org_id)

    if client_id:
        query = query.filter(Invoice.client_id == client_id)
    if status:
        query = query.filter(Invoice.status == status)
    if search:
        query = query.filter(
            (Invoice.vendor_name.ilike(f"%{search}%")) |
            (Invoice.invoice_number.ilike(f"%{search}%")) |
            (Invoice.vendor_gstin.ilike(f"%{search}%"))
        )

    total = query.count()
    invoices = query.order_by(Invoice.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return InvoiceListResponse(
        items=[_to_response(inv, db) for inv in invoices],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.org_id == current_user.org_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return _to_response(invoice, db)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: str,
    req: InvoiceFieldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.org_id == current_user.org_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    changes = req.model_dump(exclude_none=True)
    for field, new_val in changes.items():
        old_val = getattr(invoice, field, None)
        if str(old_val) != str(new_val):
            log = InvoiceAuditLog(
                org_id=current_user.org_id,
                invoice_id=invoice.id,
                user_id=current_user.id,
                action="field_updated",
                field_name=field,
                old_value=str(old_val) if old_val is not None else None,
                new_value=str(new_val),
            )
            db.add(log)
        setattr(invoice, field, new_val)

    db.commit()
    db.refresh(invoice)
    return _to_response(invoice, db)


@router.post("/{invoice_id}/approve", response_model=InvoiceResponse)
def approve_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer_or_admin),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.org_id == current_user.org_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = InvoiceStatus.approved
    invoice.approved_by = current_user.id
    invoice.approved_at = datetime.utcnow()

    log = InvoiceAuditLog(
        org_id=current_user.org_id,
        invoice_id=invoice.id,
        user_id=current_user.id,
        action="approved",
    )
    db.add(log)
    db.commit()
    db.refresh(invoice)
    return _to_response(invoice, db)


@router.post("/{invoice_id}/reject", response_model=InvoiceResponse)
def reject_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer_or_admin),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.org_id == current_user.org_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = InvoiceStatus.rejected
    log = InvoiceAuditLog(
        org_id=current_user.org_id,
        invoice_id=invoice.id,
        user_id=current_user.id,
        action="rejected",
    )
    db.add(log)
    db.commit()
    db.refresh(invoice)
    return _to_response(invoice, db)


@router.post("/bulk-approve")
def bulk_approve(
    invoice_ids: List[str],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer_or_admin),
):
    count = 0
    for iid in invoice_ids:
        invoice = db.query(Invoice).filter(Invoice.id == iid, Invoice.org_id == current_user.org_id).first()
        if invoice and invoice.status in [InvoiceStatus.completed, InvoiceStatus.needs_review]:
            invoice.status = InvoiceStatus.approved
            invoice.approved_by = current_user.id
            invoice.approved_at = datetime.utcnow()
            db.add(InvoiceAuditLog(
                org_id=current_user.org_id,
                invoice_id=invoice.id,
                user_id=current_user.id,
                action="bulk_approved",
            ))
            count += 1
    db.commit()
    return {"approved": count}


@router.get("/{invoice_id}/audit", response_model=List[AuditLogResponse])
def get_audit_log(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.org_id == current_user.org_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    logs = db.query(InvoiceAuditLog).filter(InvoiceAuditLog.invoice_id == invoice_id).order_by(InvoiceAuditLog.created_at.desc()).all()
    result = []
    for log in logs:
        r = AuditLogResponse.model_validate(log)
        if log.user:
            r.user_name = log.user.full_name
        result.append(r)
    return result


class ReprocessRequest(BaseModel):
    template_id: Optional[str] = None
    skip_template: bool = False


@router.post("/{invoice_id}/reprocess")
def reprocess_invoice(
    invoice_id: str,
    req: ReprocessRequest = Body(default=ReprocessRequest()),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Queue an invoice for reprocessing — optionally with a specific template or skipping template matching."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.org_id == current_user.org_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = InvoiceStatus.pending
    invoice.validation_errors = []
    invoice.template_id = None

    log = InvoiceAuditLog(
        org_id=current_user.org_id,
        invoice_id=invoice.id,
        user_id=current_user.id,
        action="reprocess_queued",
        new_value=f"template_id={req.template_id}, skip={req.skip_template}",
    )
    db.add(log)
    db.commit()

    process_invoice_task.delay(
        str(invoice.id),
        force_template_id=req.template_id,
        skip_template=req.skip_template,
    )
    return {"queued": True, "invoice_id": invoice_id}


@router.get("/{invoice_id}/preview-url")
def get_preview_url(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.org_id == current_user.org_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    storage = StorageService()
    url = storage.get_presigned_url(invoice.file_path)
    return {"url": url}


_MIME = {"pdf": "application/pdf", "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}


@router.get("/{invoice_id}/preview")
def preview_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream the invoice file through the backend — avoids presigned-URL host issues."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.org_id == current_user.org_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    storage = StorageService()
    try:
        data = storage.download(invoice.file_path)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found in storage")

    content_type = _MIME.get(invoice.file_type, "application/octet-stream")
    safe_name = invoice.original_filename.replace('"', "")
    return StreamingResponse(
        io.BytesIO(data),
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{safe_name}"'},
    )
