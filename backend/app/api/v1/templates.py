from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from app.db.session import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
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
