from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


class ClientCreate(BaseModel):
    name: str
    gstin: Optional[str] = None
    contact_person: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None
    contact_person: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


class ClientResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    gstin: Optional[str]
    contact_person: Optional[str]
    mobile: Optional[str]
    email: Optional[str]
    is_active: bool
    created_at: datetime
    total_invoices: int = 0
    pending_review: int = 0
    processed: int = 0

    model_config = {"from_attributes": True}
