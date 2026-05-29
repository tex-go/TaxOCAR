from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Numeric, Text, JSON, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from app.db.session import Base


class InvoiceStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    needs_review = "needs_review"
    needs_template = "needs_template"
    approved = "approved"
    rejected = "rejected"


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("invoice_templates.id", ondelete="SET NULL"), nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # File info
    original_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(20), nullable=False)
    file_size = Column(Numeric, nullable=True)

    # Status
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.pending, nullable=False, index=True)

    # OCR
    ocr_raw_text = Column(Text, nullable=True)
    ocr_confidence = Column(Numeric(5, 2), nullable=True)
    is_scanned = Column(Boolean, default=False)

    # Extracted fields
    vendor_name = Column(String(500), nullable=True)
    vendor_gstin = Column(String(15), nullable=True, index=True)
    customer_name = Column(String(500), nullable=True)
    customer_gstin = Column(String(15), nullable=True)
    invoice_number = Column(String(100), nullable=True, index=True)
    invoice_date = Column(String(50), nullable=True)
    taxable_amount = Column(Numeric(15, 2), nullable=True)
    cgst = Column(Numeric(15, 2), nullable=True)
    sgst = Column(Numeric(15, 2), nullable=True)
    igst = Column(Numeric(15, 2), nullable=True)
    cess = Column(Numeric(15, 2), nullable=True)
    total_amount = Column(Numeric(15, 2), nullable=True)
    hsn_sac = Column(String(100), nullable=True)
    place_of_supply = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)

    # Confidence scores per field
    field_confidence = Column(JSON, nullable=True)

    # Validation
    validation_errors = Column(JSON, nullable=True)
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(UUID(as_uuid=True), nullable=True)

    # Timestamps
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    organization = relationship("Organization")
    client = relationship("Client", back_populates="invoices")
    template = relationship("InvoiceTemplate", back_populates="invoices")
    uploaded_by_user = relationship("User", back_populates="invoices_uploaded", foreign_keys=[uploaded_by])
    audit_logs = relationship("InvoiceAuditLog", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceAuditLog(Base):
    __tablename__ = "invoice_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    field_name = Column(String(100), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")
