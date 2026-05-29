import re
from typing import Optional, Dict, Any
from decimal import Decimal, InvalidOperation


GSTIN_RE = re.compile(r"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b")

# Invoice number — labeled ("Invoice No:", "Bill No:", "Ref:", "Challan:") OR
# standalone prefixed codes like INV20240109, BILL-001, TAX/2024/001
INV_NO_RE = re.compile(
    r"(?:invoice\s*(?:no|number|#|num|\.)|bill\s*(?:no|number|#|num)?\.?|"
    r"tax\s*invoice(?:\s*no)?|ref(?:erence)?\s*(?:no|number|#)?\.?|"
    r"challan\s*(?:no|number)?|voucher\s*(?:no|number)?|"
    r"doc(?:ument)?\s*(?:no|number)|sr\.?\s*no\.?)[\s:.\-]*([A-Z0-9][A-Z0-9\-/\\_. ]{1,30})",
    re.IGNORECASE,
)
STANDALONE_INV_RE = re.compile(
    r"\b((?:INV|INVOICE|BILL|RCPT|TAX|TXN|PO|WO|DN|CN|GRN|SI)[-/]?\d{4,15})\b",
    re.IGNORECASE,
)

DATE_RE = re.compile(
    r"\b("
    r"\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}"                                           # DD/MM/YYYY or DD-MM-YYYY
    r"|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}" # 15 Jan 2030
    r"|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}" # January 15, 2030
    r"|\d{4}-\d{2}-\d{2}"                                                              # ISO 2030-01-15
    r")\b",
    re.IGNORECASE,
)

# Currency/symbol chars to strip between a label and the numeric value
_STRIP = r"[\s:inr₹rs.$€£¥@|\-]"

# Tax amounts — optional rate like "9%" before the value; one capture group
CGST_RE  = re.compile(r"c(?:entral\s+)?gst"    + _STRIP + r"*(?:[\d.]+\s*%" + _STRIP + r"*)?([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)
SGST_RE  = re.compile(r"s(?:tate\s+)?gst"       + _STRIP + r"*(?:[\d.]+\s*%" + _STRIP + r"*)?([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)
IGST_RE  = re.compile(r"i(?:ntegrated\s+)?gst"  + _STRIP + r"*(?:[\d.]+\s*%" + _STRIP + r"*)?([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)
CESS_RE  = re.compile(r"cess" + _STRIP + r"*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)

# Generic "Tax (7%) 31.85" for non-GST invoices
TAX_LINE_RE = re.compile(r"\btax\s*\([\d.]+%\)" + _STRIP + r"*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)

# Total — covers Grand Total, Total Amount, Net Payable, Invoice Total, Amount Due, etc.
TOTAL_RE = re.compile(
    r"(?:grand\s+total|total\s+(?:amount|invoice\s+value|payable|due)?|"
    r"net\s+(?:payable|amount|total|due)|amount\s+(?:payable|due)|"
    r"invoice\s+(?:total|value|amount)|balance\s+(?:due|payable))"
    + _STRIP + r"*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

# Taxable / base amount (subtotal, assessable value, amount before tax)
TAXABLE_RE = re.compile(
    r"(?:taxable\s+(?:value|amount)|sub[-\s]?total|basic\s+(?:amount|value)|"
    r"assessable\s+(?:value|amount)|(?:total\s+)?value\s+(?:of\s+(?:goods|supply))?|"
    r"net\s+(?:value|amount)(?:\s+before\s+(?:gst|tax))?|"
    r"amount\s+before\s+(?:gst|tax)|total\s+(?:value|amount)\s+before\s+(?:gst|tax))"
    + _STRIP + r"*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

HSN_RE = re.compile(r"(?:hsn|sac)[\s/]?(?:code)?[\s:]*([\d]{4,8})", re.IGNORECASE)
POS_RE = re.compile(r"place\s+of\s+supply[\s:]*([\w\s,]+?)(?:\n|$)", re.IGNORECASE)

# Vendor name — explicit labels
VENDOR_LABEL_RE = re.compile(
    r"(?:vendor|supplier|from|sold\s+by|bill\s+(?:from|by)|issued\s+by|party\s+name|party)\s*:?\s*(.+)",
    re.IGNORECASE,
)
# Company suffix words
COMPANY_SUFFIX_RE = re.compile(
    r"\b(?:pvt\.?\s*ltd\.?|ltd\.?|llp|inc\.?|corp\.?|co\.?|associates|enterprises|"
    r"trading|industries|services|solutions|consultants?|group|brothers|bros\.?|catering|"
    r"foods?|restaurant|bakery|hotel|cafe)\b",
    re.IGNORECASE,
)
# Words that are definitely NOT company names
_SKIP_NAME_RE = re.compile(
    r"^(?:invoice|tax\s*invoice|original|duplicate|triplicate|proforma|receipt|bill|"
    r"gst|gstin|pan|tan|cin|address|phone|email|fax|page|date|terms?|payment|"
    r"thank\s+you|description|qty|quantity|unit|price|amount|total|subtotal|"
    r"bill\s+to|ship\s+to|deliver\s+to|scan|for\s+more|terms\s+and)$",
    re.IGNORECASE,
)


def _parse_amount(text: str) -> Optional[Decimal]:
    # Strip everything except digits and decimal point; comma = thousand separator
    cleaned = re.sub(r"[^\d.]", "", text.replace(",", ""))
    if not cleaned:
        return None
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def _looks_reasonable(text: str) -> bool:
    """True if text looks like a real name, not OCR noise / QR code garbage."""
    if len(text) < 3:
        return False
    alpha = sum(1 for c in text if c.isalpha())
    if alpha < 3:
        return False
    # Vowel ratio: real words have >12% vowels; QR code noise often has fewer
    vowels = sum(1 for c in text.lower() if c in "aeiou")
    return vowels / alpha >= 0.12


def _extract_vendor_name(text: str) -> Optional[str]:
    """
    Priority:
    1. Explicit label ("Vendor:", "Sold by:", etc.)
    2. ALL-CAPS line (letterhead format, e.g. "FEASTFUL CATERING")
    3. Line containing a company-type suffix
    4. First title-case or reasonable multi-word line
    """
    # 1. Explicit vendor label
    m = VENDOR_LABEL_RE.search(text)
    if m:
        name = m.group(1).strip()[:255]
        if _looks_reasonable(name) and not _SKIP_NAME_RE.match(name):
            return name

    lines = [l.strip() for l in text.split("\n") if l.strip() and len(l.strip()) > 3]

    # 2. ALL-CAPS multi-word line (e.g. "FEASTFUL CATERING", "ABC ENTERPRISES")
    for line in lines:
        if (re.match(r"^[A-Z][A-Z\s&.,'\-]{4,80}$", line)
                and not _SKIP_NAME_RE.match(line)
                and _looks_reasonable(line)
                and len(line.split()) >= 1):
            return line[:255]

    # 3. Line with company-type suffix
    for line in lines:
        if (COMPANY_SUFFIX_RE.search(line)
                and len(line) > 4
                and _looks_reasonable(line)
                and not _SKIP_NAME_RE.match(line)):
            return line[:255]

    # 4. First non-noise, non-label line with at least one real word
    for line in lines:
        if re.match(r"^[\d\s₹$€£Rs.,/:\-]+$", line):
            continue
        if _SKIP_NAME_RE.match(line):
            continue
        if not _looks_reasonable(line):
            continue
        # Skip lines that look like addresses (street numbers + words)
        if re.match(r"^\d+\s+\w+", line):
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

    # Invoice number — labeled first, standalone fallback
    m = INV_NO_RE.search(text)
    if m:
        fields["invoice_number"] = m.group(1).strip().rstrip(".")
        confidence["invoice_number"] = 88.0
    else:
        m = STANDALONE_INV_RE.search(text)
        if m:
            fields["invoice_number"] = m.group(1).strip()
            confidence["invoice_number"] = 75.0

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

    # Generic tax line (e.g. "Tax (7%) $31.85") — maps to CGST when no GST fields
    if "cgst" not in fields and "sgst" not in fields and "igst" not in fields:
        m = TAX_LINE_RE.search(text)
        if m:
            val = _parse_amount(m.group(1))
            if val:
                fields["cgst"] = val
                confidence["cgst"] = 65.0

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
