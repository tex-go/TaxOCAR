from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.db.session import Base


class InvoiceTemplate(Base):
    __tablename__ = "invoice_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    vendor_gstin = Column(String(15), nullable=True, index=True)
    vendor_name = Column(String(255), nullable=True)
    sample_image_path = Column(String(1000), nullable=True)
    # coordinates: {"invoice_number": {"x": 0, "y": 0, "w": 200, "h": 30}, ...}
    coordinates = Column(JSON, nullable=True)
    # regex patterns per field
    patterns = Column(JSON, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", back_populates="templates")
    invoices = relationship("Invoice", back_populates="template")
