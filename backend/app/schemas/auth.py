from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    org_id: str
    role: str
    full_name: str


class RegisterOrgRequest(BaseModel):
    org_name: str
    admin_email: EmailStr
    admin_password: str
    admin_name: str
