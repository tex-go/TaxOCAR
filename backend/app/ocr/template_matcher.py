import re
import io
from decimal import Decimal, InvalidOperation
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
    single-line OCR on each region.  coordinates format:
      {"invoice_number": {"x": 100, "y": 200, "w": 150, "h": 30}, ...}
    """
    if not template.coordinates:
        return {}

    try:
        from PIL import Image
        import pytesseract

        # Render first page to RGB image
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
                # PSM 7 = single text line, best for cropped field regions
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
