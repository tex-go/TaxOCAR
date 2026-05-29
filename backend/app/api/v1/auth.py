from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.schemas.auth import LoginRequest, TokenResponse, RegisterOrgRequest
import re

router = APIRouter(prefix="/auth", tags=["auth"])


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


@router.post("/register", response_model=TokenResponse, status_code=201)
def register_organization(req: RegisterOrgRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.admin_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    base_slug = slugify(req.org_name)
    slug = base_slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Organization(name=req.org_name, slug=slug)
    db.add(org)
    db.flush()

    admin = User(
        org_id=org.id,
        email=req.admin_email,
        hashed_password=get_password_hash(req.admin_password),
        full_name=req.admin_name,
        role=UserRole.admin,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    token = create_access_token({"sub": str(admin.id), "org_id": str(org.id), "role": admin.role})
    return TokenResponse(
        access_token=token,
        user_id=str(admin.id),
        org_id=str(org.id),
        role=admin.role,
        full_name=admin.full_name,
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email, User.is_active == True).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "org_id": str(user.org_id), "role": user.role})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        org_id=str(user.org_id),
        role=user.role,
        full_name=user.full_name,
    )
