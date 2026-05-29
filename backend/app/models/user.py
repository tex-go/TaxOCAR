from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from app.db.session import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    accountant = "accountant"
    reviewer = "reviewer"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.accountant, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", back_populates="users")
    invoices_uploaded = relationship("Invoice", back_populates="uploaded_by_user", foreign_keys="Invoice.uploaded_by")
    audit_logs = relationship("InvoiceAuditLog", back_populates="user")
