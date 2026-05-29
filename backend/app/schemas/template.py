from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class TemplateCreate(BaseModel):
    name: str
    vendor_gstin: Optional[str] = None
    vendor_name: Optional[str] = None
    coordinates: Optional[Dict[str, Any]] = None
    patterns: Optional[Dict[str, str]] = None
    description: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    vendor_name: Optional[str] = None
    coordinates: Optional[Dict[str, Any]] = None
    patterns: Optional[Dict[str, str]] = None
    description: Optional[str] = None


class TemplateResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    vendor_gstin: Optional[str]
    vendor_name: Optional[str]
    sample_image_path: Optional[str]
    coordinates: Optional[Dict[str, Any]]
    patterns: Optional[Dict[str, str]]
    description: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
