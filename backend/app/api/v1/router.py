from fastapi import APIRouter
from app.api.v1 import auth, users, clients, invoices, templates, dashboard, exports

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(clients.router)
api_router.include_router(invoices.router)
api_router.include_router(templates.router)
api_router.include_router(dashboard.router)
api_router.include_router(exports.router)
