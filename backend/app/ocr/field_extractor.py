import re
from typing import Optional, Dict, Any
from decimal import Decimal, InvalidOperation


GSTIN_RE = re.compile(r"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b")
INV_NO_RE = re.compile(r"(?:invoice\s*(?:no|number|#|num)[\s:.-]*)([\w\-/]+)", re.IGNORECASE)
DATE_RE = re.compile(
    r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+\w{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2})\b"
)
AMOUNT_RE = re.compile(r"(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)
CGST_RE = re.compile(r"cgst[\s:@%]*(?:tax[\s:]*)?([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)
SGST_RE = re.compile(r"sgst[\s:@%]*(?:tax[\s:]*)?([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)
IGST_RE = re.compile(r"igst[\s:@%]*(?:tax[\s:]*)?([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)
CESS_RE = re.compile(r"cess[\s:]*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)
TOTAL_RE = re.compile(
    r"(?:grand\s+total|total\s+amount|total\s+invoice\s+value|net\s+payable)[\s:inr₹rs.]*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)
TAXABLE_RE = re.compile(
    r"(?:taxable\s+(?:value|amount)|sub[-\s]total|basic\s+amount)[\s:inr₹rs.]*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)
HSN_RE = re.compile(r"(?:hsn|sac)[\s/]?(?:code)?[\s:]*([\d]{4,8})", re.IGNORECASE)
POS_RE = re.compile(r"place\s+of\s+supply[\s:]*([\w\s,]+?)(?:\n|$)", re.IGNORECASE)


def _parse_amount(text: str) -> Optional[Decimal]:
    cleaned = text.replace(",", "").strip()
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def extract_fields(text: str) -> Dict[str, Any]:
    fields: Dict[str, Any] = {}
    confidence: Dict[str, float] = {}

    # GSTINs
    gstins = GSTIN_RE.findall(text)
    if len(gstins) >= 1:
        fields["vendor_gstin"] = gstins[0]
        confidence["vendor_gstin"] = 90.0
    if len(gstins) >= 2:
        fields["customer_gstin"] = gstins[1]
        confidence["customer_gstin"] = 85.0

    # Invoice number
    m = INV_NO_RE.search(text)
    if m:
        fields["invoice_number"] = m.group(1).strip()
        confidence["invoice_number"] = 88.0

    # Invoice date
    dates = DATE_RE.findall(text)
    if dates:
        fields["invoice_date"] = dates[0]
        confidence["invoice_date"] = 82.0

    # Taxable amount
    m = TAXABLE_RE.search(text)
    if m:
        val = _parse_amount(m.group(1))
        if val:
            fields["taxable_amount"] = val
            confidence["taxable_amount"] = 85.0

    # CGST
    m = CGST_RE.search(text)
    if m:
        val = _parse_amount(m.group(1))
        if val:
            fields["cgst"] = val
            confidence["cgst"] = 88.0

    # SGST
    m = SGST_RE.search(text)
    if m:
        val = _parse_amount(m.group(1))
        if val:
            fields["sgst"] = val
            confidence["sgst"] = 88.0

    # IGST
    m = IGST_RE.search(text)
    if m:
        val = _parse_amount(m.group(1))
        if val:
            fields["igst"] = val
            confidence["igst"] = 88.0

    # CESS
    m = CESS_RE.search(text)
    if m:
        val = _parse_amount(m.group(1))
        if val:
            fields["cess"] = val
            confidence["cess"] = 80.0

    # Total amount
    m = TOTAL_RE.search(text)
    if m:
        val = _parse_amount(m.group(1))
        if val:
            fields["total_amount"] = val
            confidence["total_amount"] = 90.0

    # HSN/SAC
    m = HSN_RE.search(text)
    if m:
        fields["hsn_sac"] = m.group(1).strip()
        confidence["hsn_sac"] = 80.0

    # Place of supply
    m = POS_RE.search(text)
    if m:
        fields["place_of_supply"] = m.group(1).strip()[:100]
        confidence["place_of_supply"] = 75.0

    # Vendor name heuristic: first non-empty line
    lines = [l.strip() for l in text.split("\n") if l.strip() and len(l.strip()) > 3]
    if lines:
        fields["vendor_name"] = lines[0][:255]
        confidence["vendor_name"] = 60.0

    return {"fields": fields, "confidence": confidence}
