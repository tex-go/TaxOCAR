from pydantic import BaseModel
from typing import List
from datetime import datetime


class DashboardStats(BaseModel):
    total_clients: int
    total_invoices: int
    pending_review: int
    processed_today: int
    failed_ocr: int
    needs_template: int


class RecentUpload(BaseModel):
    id: str
    original_filename: str
    client_name: str
    status: str
    created_at: datetime


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_uploads: List[RecentUpload]
