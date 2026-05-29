from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, date

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.client import Client
from app.models.invoice import Invoice, InvoiceStatus
from app.schemas.dashboard import DashboardResponse, DashboardStats, RecentUpload

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/", response_model=DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = current_user.org_id
    today_start = datetime.combine(date.today(), datetime.min.time())

    total_clients = db.query(Client).filter(Client.org_id == org_id, Client.is_active == True).count()
    total_invoices = db.query(Invoice).filter(Invoice.org_id == org_id).count()
    pending_review = db.query(Invoice).filter(
        Invoice.org_id == org_id,
        Invoice.status.in_([InvoiceStatus.needs_review, InvoiceStatus.needs_template]),
    ).count()
    processed_today = db.query(Invoice).filter(
        Invoice.org_id == org_id,
        Invoice.status.in_([InvoiceStatus.completed, InvoiceStatus.approved]),
        Invoice.updated_at >= today_start,
    ).count()
    failed_ocr = db.query(Invoice).filter(
        Invoice.org_id == org_id,
        Invoice.status == InvoiceStatus.failed,
    ).count()
    needs_template = db.query(Invoice).filter(
        Invoice.org_id == org_id,
        Invoice.status == InvoiceStatus.needs_template,
    ).count()

    recent = (
        db.query(Invoice)
        .filter(Invoice.org_id == org_id)
        .order_by(Invoice.created_at.desc())
        .limit(10)
        .all()
    )

    recent_uploads = [
        RecentUpload(
            id=str(inv.id),
            original_filename=inv.original_filename,
            client_name=inv.client.name if inv.client else "Unknown",
            status=inv.status,
            created_at=inv.created_at,
        )
        for inv in recent
    ]

    return DashboardResponse(
        stats=DashboardStats(
            total_clients=total_clients,
            total_invoices=total_invoices,
            pending_review=pending_review,
            processed_today=processed_today,
            failed_ocr=failed_ocr,
            needs_template=needs_template,
        ),
        recent_uploads=recent_uploads,
    )
