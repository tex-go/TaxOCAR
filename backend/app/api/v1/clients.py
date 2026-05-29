from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.client import Client
from app.models.invoice import Invoice, InvoiceStatus
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse

router = APIRouter(prefix="/clients", tags=["clients"])


def _enrich_client(client: Client, db: Session) -> ClientResponse:
    total = db.query(Invoice).filter(Invoice.client_id == client.id).count()
    pending = db.query(Invoice).filter(
        Invoice.client_id == client.id,
        Invoice.status.in_([InvoiceStatus.needs_review, InvoiceStatus.needs_template]),
    ).count()
    processed = db.query(Invoice).filter(
        Invoice.client_id == client.id,
        Invoice.status.in_([InvoiceStatus.completed, InvoiceStatus.approved]),
    ).count()

    resp = ClientResponse.model_validate(client)
    resp.total_invoices = total
    resp.pending_review = pending
    resp.processed = processed
    return resp


@router.get("/", response_model=List[ClientResponse])
def list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clients = db.query(Client).filter(Client.org_id == current_user.org_id).all()
    return [_enrich_client(c, db) for c in clients]


@router.post("/", response_model=ClientResponse, status_code=201)
def create_client(
    req: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    client = Client(org_id=current_user.org_id, **req.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return _enrich_client(client, db)


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == client_id, Client.org_id == current_user.org_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return _enrich_client(client, db)


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: str,
    req: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == client_id, Client.org_id == current_user.org_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    for field, value in req.model_dump(exclude_none=True).items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)
    return _enrich_client(client, db)


@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == client_id, Client.org_id == current_user.org_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(client)
    db.commit()
