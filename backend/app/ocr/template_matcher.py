import re
import io
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from typing import Optional, Dict, Any, Tuple

from sqlalchemy.orm import Session
from app.models.template import InvoiceTemplate


# ── finding templates ──────────────────────────────────────────────────────────

def find_template(org_id: str, vendor_gstin: Optional[str], db: Session) -> Optional[InvoiceTemplate]:
    """Exact GSTIN match."""
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


def find_best_template(
    org_id: str,
    vendor_gstin: Optional[str],
    vendor_name: Optional[str],
    db: Session,
) -> Tuple[Optional[InvoiceTemplate], str]:
    """
    Priority chain:
    1. Exact GSTIN match  (confidence: gstin)
    2. Fuzzy vendor name match >= 0.72  (confidence: name)
    Returns (template, match_type).  match_type is '' when not found.
    """
    # 1. GSTIN exact match
    if vendor_gstin:
        t = find_template(org_id, vendor_gstin, db)
        if t:
            return t, "gstin"

    # 2. Vendor name fuzzy match
    if vendor_name:
        candidates = (
            db.query(InvoiceTemplate)
            .filter(
                InvoiceTemplate.org_id == org_id,
                InvoiceTemplate.vendor_name.isnot(None),
            )
            .all()
        )
        best_t, best_score = None, 0.0
        norm_name = vendor_name.lower().strip()
        for t in candidates:
            score = SequenceMatcher(None, norm_name, (t.vendor_name or "").lower().strip()).ratio()
            if score > best_score:
                best_score = score
                best_t = t
        if best_t and best_score >= 0.72:
            return best_t, "name"

    return None, ""


# ── applying templates ─────────────────────────────────────────────────────────

def apply_template_patterns(text: str, template: InvoiceTemplate) -> Dict[str, Any]:
    """Override field extraction using template-defined regex patterns."""
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


def apply_template_coordinates(data: bytes, file_type: str, template: InvoiceTemplate) -> Dict[str, Any]:
    """
    Extract fields by cropping the image to annotated bounding boxes and running
    single-line OCR on each region.
    coordinates format: {"invoice_number": {"x": 100, "y": 200, "w": 150, "h": 30}, ...}
    """
    if not template.coordinates:
        return {}

    try:
        from PIL import Image
        import pytesseract

        if file_type == "pdf":
            import fitz
            doc = fitz.open(stream=data, filetype="pdf")
            mat = fitz.Matrix(2, 2)
            pix = doc[0].get_pixmap(matrix=mat)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            doc.close()
        else:
            img = Image.open(io.BytesIO(data)).convert("RGB")

        AMOUNT_FIELDS = {"taxable_amount", "cgst", "sgst", "igst", "cess", "total_amount"}
        overrides: Dict[str, Any] = {}

        for field, coords in template.coordinates.items():
            try:
                x, y, w, h = int(coords["x"]), int(coords["y"]), int(coords["w"]), int(coords["h"])
                if w < 4 or h < 4:
                    continue
                region = img.crop((x, y, x + w, y + h))
                text = pytesseract.image_to_string(region, config="--oem 3 --psm 7 -l eng").strip()
                if not text:
                    continue

                if field in AMOUNT_FIELDS:
                    cleaned = re.sub(r"[^\d.]", "", text.replace(",", ""))
                    try:
                        overrides[field] = Decimal(cleaned)
                    except InvalidOperation:
                        pass
                else:
                    overrides[field] = text[:255]
            except Exception:
                continue

        return overrides
    except Exception:
        return {}
