import re
from typing import Optional, Dict, Any
from decimal import Decimal, InvalidOperation


GSTIN_RE = re.compile(r"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b")

# Invoice number — covers Bill No, Tax Invoice, Ref, Challan, Voucher, SR No
INV_NO_RE = re.compile(
    r"(?:invoice\s*(?:no|number|#|num|\.)|bill\s*(?:no|number|#|num)?\.?|"
    r"tax\s*invoice(?:\s*no)?|ref(?:erence)?\s*(?:no|number|#)?\.?|"
    r"challan\s*(?:no|number)?|voucher\s*(?:no|number)?|"
    r"doc(?:ument)?\s*(?:no|number)|sr\.?\s*no\.?)[\s:.\-]*([A-Z0-9][A-Z0-9\-/\\_. ]{1,30})",
    re.IGNORECASE,
)

DATE_RE = re.compile(
    r"\b(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}"
    r"|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}"
    r"|\d{4}-\d{2}-\d{2})\b",
    re.IGNORECASE,
)

# Tax amounts — skip any leading percentage/rate that looks like "9%" before the value
_TAX_AMOUNT = r"(?:[\d.]+\s*%\s*)?[\s:x*\-]*([\d,]+(?:\.\d{1,2})?)"

CGST_RE  = re.compile(r"c(?:entral\s+)?gst" + _TAX_AMOUNT, re.IGNORECASE)
SGST_RE  = re.compile(r"s(?:tate\s+)?gst"   + _TAX_AMOUNT, re.IGNORECASE)
IGST_RE  = re.compile(r"i(?:ntegrated\s+)?gst" + _TAX_AMOUNT, re.IGNORECASE)
CESS_RE  = re.compile(r"cess[\s:]*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)

# Total — covers Grand Total, Total Amount, Net Payable, Invoice Total, Amount Due, etc.
TOTAL_RE = re.compile(
    r"(?:grand\s+total|total\s+(?:amount|invoice\s+value|payable|due|tax(?:able)?)?|"
    r"net\s+(?:payable|amount|total|due)|amount\s+(?:payable|due)|"
    r"invoice\s+(?:total|value|amount)|balance\s+(?:due|payable)|"
    r"total\s+(?:rs\.?|inr|₹))[\s:inr₹rs.\-]*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

# Taxable / base amount
TAXABLE_RE = re.compile(
    r"(?:taxable\s+(?:value|amount)|sub[-\s]?total|basic\s+(?:amount|value)|"
    r"assessable\s+(?:value|amount)|(?:total\s+)?value\s+(?:of\s+(?:goods|supply))?|"
    r"net\s+(?:value|amount)(?:\s+before\s+(?:gst|tax))?|"
    r"amount\s+before\s+(?:gst|tax)|total\s+(?:value|amount)\s+before\s+(?:gst|tax))"
    r"[\s:inr₹rs.\-]*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

HSN_RE = re.compile(r"(?:hsn|sac)[\s/]?(?:code)?[\s:]*([\d]{4,8})", re.IGNORECASE)
POS_RE = re.compile(r"place\s+of\s+supply[\s:]*([\w\s,]+?)(?:\n|$)", re.IGNORECASE)

# Vendor name — look for explicit labels first
VENDOR_LABEL_RE = re.compile(
    r"(?:vendor|supplier|from|sold\s+by|bill\s+(?:from|by)|issued\s+by|party\s+name|party)\s*:?\s*(.+)",
    re.IGNORECASE,
)
# Company suffix words that signal a vendor name line
COMPANY_SUFFIX_RE = re.compile(
    r"\b(?:pvt\.?\s*ltd\.?|ltd\.?|llp|inc\.?|corp\.?|co\.?|associates|enterprises|"
    r"trading|industries|services|solutions|consultants?|group|brothers|bros\.?)\b",
    re.IGNORECASE,
)


def _parse_amount(text: str) -> Optional[Decimal]:
    cleaned = text.replace(",", "").replace("₹", "").replace("Rs.", "").strip()
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def _extract_vendor_name(text: str) -> Optional[str]:
    # 1. Explicit vendor label
    m = VENDOR_LABEL_RE.search(text)
    if m:
        name = m.group(1).strip()[:255]
        if len(name) > 3:
            return name

    # 2. First line that contains a company suffix
    for line in text.split("\n"):
        line = line.strip()
        if COMPANY_SUFFIX_RE.search(line) and len(line) > 4:
            return line[:255]

    # 3. First non-empty, non-numeric line (fallback)
    lines = [l.strip() for l in text.split("\n") if l.strip() and len(l.strip()) > 4]
    for line in lines:
        # Skip lines that are mostly numbers or obvious labels
        if re.match(r"^[\d\s₹Rs.,/:\-]+$", line):
            continue
        if re.match(r"(?:tax\s+invoice|original|duplicate|triplicate|proforma|gst|gstin)", line, re.IGNORECASE):
            continue
        return line[:255]

    return lines[0][:255] if lines else None


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
        fields["invoice_number"] = m.group(1).strip().rstrip(".")
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

    # Vendor name
    vendor = _extract_vendor_name(text)
    if vendor:
        fields["vendor_name"] = vendor
        confidence["vendor_name"] = 65.0

    return {"fields": fields, "confidence": confidence}
