from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.template import InvoiceTemplate


def find_template(org_id: str, vendor_gstin: Optional[str], db: Session) -> Optional[InvoiceTemplate]:
    if not vendor_gstin:
        return None
    return (
        db.query(InvoiceTemplate)
        .filter(
            InvoiceTemplate.org_id == org_id,
            InvoiceTemplate.vendor_gstin == vendor_gstin.upper(),
        )
        .first()
    )


def apply_template_patterns(text: str, template: InvoiceTemplate) -> Dict[str, Any]:
    """Override field extraction using template-defined regex patterns."""
    import re
    from decimal import Decimal, InvalidOperation

    if not template.patterns:
        return {}

    overrides = {}
    for field, pattern in template.patterns.items():
        try:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                value = m.group(1).strip() if m.lastindex else m.group(0).strip()
                if field in ("taxable_amount", "cgst", "sgst", "igst", "cess", "total_amount"):
                    try:
                        value = Decimal(value.replace(",", ""))
                    except InvalidOperation:
                        continue
                overrides[field] = value
        except re.error:
            continue

    return overrides
