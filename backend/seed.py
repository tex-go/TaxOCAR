"""Seed initial demo data."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal, Base, engine
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.client import Client
from app.core.security import get_password_hash
import app.models  # noqa


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if db.query(Organization).first():
            print("Database already seeded.")
            return

        org = Organization(name="ABC Auditors", slug="abc-auditors")
        db.add(org)
        db.flush()

        admin = User(
            org_id=org.id,
            email="admin@abcauditors.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin User",
            role=UserRole.admin,
        )
        accountant = User(
            org_id=org.id,
            email="accountant@abcauditors.com",
            hashed_password=get_password_hash("accountant123"),
            full_name="Priya Kumar",
            role=UserRole.accountant,
        )
        reviewer = User(
            org_id=org.id,
            email="reviewer@abcauditors.com",
            hashed_password=get_password_hash("reviewer123"),
            full_name="Rajan Mehta",
            role=UserRole.reviewer,
        )
        db.add_all([admin, accountant, reviewer])

        clients = [
            Client(org_id=org.id, name="Sharma Enterprises", gstin="29AABCS1429B1ZB",
                   contact_person="Ramesh Sharma", mobile="9876543210", email="ramesh@sharma.com"),
            Client(org_id=org.id, name="Tech Solutions Pvt Ltd", gstin="27AABCT1234B1ZB",
                   contact_person="Anita Desai", mobile="9876543211"),
            Client(org_id=org.id, name="Global Imports Ltd", gstin="07AAACG1234F1ZA",
                   contact_person="Vikram Patel", mobile="9876543212", email="vikram@globalimports.com"),
        ]
        db.add_all(clients)
        db.commit()

        print(f"""
Seed complete!

Organization: ABC Auditors

Login credentials:
  Admin:      admin@abcauditors.com / admin123
  Accountant: accountant@abcauditors.com / accountant123
  Reviewer:   reviewer@abcauditors.com / reviewer123
""")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
