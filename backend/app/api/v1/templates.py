from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Dict
import json
import io
import uuid

from app.db.session import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.invoice import Invoice
from app.models.template import InvoiceTemplate
from app.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse
from app.services.storage import StorageService

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=List[TemplateResponse])
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(InvoiceTemplate).filter(InvoiceTemplate.org_id == current_user.org_id).all()


@router.post("/", response_model=TemplateResponse, status_code=201)
def create_template(
    req: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    template = InvoiceTemplate(org_id=current_user.org_id, **req.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.post("/with-sample", response_model=TemplateResponse, status_code=201)
async def create_template_with_sample(
    name: str = Form(...),
    vendor_gstin: Optional[str] = Form(None),
    vendor_name: Optional[str] = Form(None),
    coordinates: Optional[str] = Form(None),
    patterns: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    sample_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    sample_path = None
    if sample_file:
        storage = StorageService()
        data = await sample_file.read()
        import uuid
        sample_path = f"{current_user.org_id}/templates/{uuid.uuid4()}_{sample_file.filename}"
        storage.upload(sample_path, data, sample_file.content_type or "application/octet-stream")

    coords = json.loads(coordinates) if coordinates else None
    pats = json.loads(patterns) if patterns else None

    template = InvoiceTemplate(
        org_id=current_user.org_id,
        name=name,
        vendor_gstin=vendor_gstin,
        vendor_name=vendor_name,
        coordinates=coords,
        patterns=pats,
        description=description,
        sample_image_path=sample_path,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(InvoiceTemplate).filter(InvoiceTemplate.id == template_id, InvoiceTemplate.org_id == current_user.org_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: str,
    req: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    t = db.query(InvoiceTemplate).filter(InvoiceTemplate.id == template_id, InvoiceTemplate.org_id == current_user.org_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    for field, value in req.model_dump(exclude_none=True).items():
        setattr(t, field, value)

    db.commit()
    db.refresh(t)
    return t


_TMPL_MIME = {"pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}


@router.get("/{template_id}/preview")
def preview_template_sample(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream the template's sample invoice image through the backend."""
    t = db.query(InvoiceTemplate).filter(
        InvoiceTemplate.id == template_id, InvoiceTemplate.org_id == current_user.org_id
    ).first()
    if not t or not t.sample_image_path:
        raise HTTPException(status_code=404, detail="No sample image")

    storage = StorageService()
    try:
        data = storage.download(t.sample_image_path)
    except Exception:
        raise HTTPException(status_code=404, detail="Sample image not found in storage")

    ext = t.sample_image_path.rsplit(".", 1)[-1].lower() if "." in t.sample_image_path else "jpg"
    content_type = _TMPL_MIME.get(ext, "image/jpeg")
    return StreamingResponse(io.BytesIO(data), media_type=content_type)


class FromInvoiceRequest(BaseModel):
    name: str
    vendor_gstin: Optional[str] = None
    vendor_name: Optional[str] = None
    description: Optional[str] = None
    coordinates: Optional[Dict[str, Any]] = None
    patterns: Optional[Dict[str, str]] = None


@router.post("/from-invoice/{invoice_id}", response_model=TemplateResponse, status_code=201)
def create_template_from_invoice(
    invoice_id: str,
    req: FromInvoiceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a template linked to an existing invoice file as the sample image.
    Called from the annotation modal during upload or review.
    """
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.org_id == current_user.org_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    template = InvoiceTemplate(
        org_id=current_user.org_id,
        name=req.name,
        vendor_gstin=req.vendor_gstin.upper() if req.vendor_gstin else None,
        vendor_name=req.vendor_name or None,
        description=req.description or None,
        coordinates=req.coordinates or None,
        patterns=req.patterns or None,
        sample_image_path=invoice.file_path,  # reuse the invoice file as sample
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    t = db.query(InvoiceTemplate).filter(InvoiceTemplate.id == template_id, InvoiceTemplate.org_id == current_user.org_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t)
    db.commit()
