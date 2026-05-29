from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import io

from app.db.session import get_db
from app.api.deps import get_current_user, require_reviewer_or_admin
from app.models.user import User
from app.models.invoice import Invoice, InvoiceStatus
from app.services.export import ExportService

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/purchase-register")
def export_purchase_register(
    client_id: Optional[str] = None,
    month: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer_or_admin),
):
    query = db.query(Invoice).filter(
        Invoice.org_id == current_user.org_id,
        Invoice.status.in_([InvoiceStatus.completed, InvoiceStatus.approved]),
    )

    if client_id:
        query = query.filter(Invoice.client_id == client_id)

    invoices = query.order_by(Invoice.invoice_date).all()
    svc = ExportService()
    buf = svc.purchase_register(invoices)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=purchase_register.xlsx"},
    )


@router.get("/gst-upload")
def export_gst_upload(
    client_id: Optional[str] = None,
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer_or_admin),
):
    query = db.query(Invoice).filter(
        Invoice.org_id == current_user.org_id,
        Invoice.status == InvoiceStatus.approved,
    )
    if client_id:
        query = query.filter(Invoice.client_id == client_id)

    invoices = query.order_by(Invoice.invoice_date).all()
    svc = ExportService()
    buf = svc.gst_upload_format(invoices)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=gst_upload.xlsx"},
    )


@router.get("/csv")
def export_csv(
    client_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer_or_admin),
):
    query = db.query(Invoice).filter(Invoice.org_id == current_user.org_id)
    if client_id:
        query = query.filter(Invoice.client_id == client_id)

    invoices = query.order_by(Invoice.invoice_date).all()
    svc = ExportService()
    buf = svc.csv_export(invoices)

    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=invoices.csv"},
    )
