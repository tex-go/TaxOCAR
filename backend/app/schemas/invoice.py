from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from uuid import UUID
from app.models.invoice import InvoiceStatus


class InvoiceFieldUpdate(BaseModel):
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    customer_name: Optional[str] = None
    customer_gstin: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    taxable_amount: Optional[Decimal] = None
    cgst: Optional[Decimal] = None
    sgst: Optional[Decimal] = None
    igst: Optional[Decimal] = None
    cess: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    hsn_sac: Optional[str] = None
    place_of_supply: Optional[str] = None
    state: Optional[str] = None
    status: Optional[InvoiceStatus] = None


class InvoiceResponse(BaseModel):
    id: UUID
    org_id: UUID
    client_id: UUID
    template_id: Optional[UUID]
    original_filename: str
    file_path: str
    file_type: str
    status: InvoiceStatus
    is_scanned: bool
    ocr_confidence: Optional[Decimal]
    vendor_name: Optional[str]
    vendor_gstin: Optional[str]
    customer_name: Optional[str]
    customer_gstin: Optional[str]
    invoice_number: Optional[str]
    invoice_date: Optional[str]
    taxable_amount: Optional[Decimal]
    cgst: Optional[Decimal]
    sgst: Optional[Decimal]
    igst: Optional[Decimal]
    cess: Optional[Decimal]
    total_amount: Optional[Decimal]
    hsn_sac: Optional[str]
    place_of_supply: Optional[str]
    state: Optional[str]
    field_confidence: Optional[Dict[str, Any]]
    validation_errors: Optional[List[str]]
    is_duplicate: bool
    duplicate_of: Optional[UUID]
    uploaded_by: Optional[UUID]
    approved_by: Optional[UUID]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    client_name: Optional[str] = None

    model_config = {"from_attributes": True}


class AuditLogResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    user_id: Optional[UUID]
    action: str
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    created_at: datetime
    user_name: Optional[str] = None

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    items: List[InvoiceResponse]
    total: int
    page: int
    page_size: int
