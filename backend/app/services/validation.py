import re
from typing import List, Optional
from decimal import Decimal


GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


def validate_gstin(gstin: Optional[str]) -> bool:
    if not gstin:
        return False
    return bool(GSTIN_REGEX.match(gstin.strip().upper()))


def validate_invoice(
    invoice_number: Optional[str],
    invoice_date: Optional[str],
    vendor_gstin: Optional[str],
    taxable_amount: Optional[Decimal],
    cgst: Optional[Decimal],
    sgst: Optional[Decimal],
    igst: Optional[Decimal],
    total_amount: Optional[Decimal],
) -> List[str]:
    errors = []

    if not invoice_number or not invoice_number.strip():
        errors.append("Invoice number is missing")

    if not invoice_date or not invoice_date.strip():
        errors.append("Invoice date is missing")

    if vendor_gstin and not validate_gstin(vendor_gstin):
        errors.append(f"Invalid vendor GSTIN format: {vendor_gstin}")

    if taxable_amount is None:
        errors.append("Taxable amount is missing")

    if total_amount is None:
        errors.append("Total amount is missing")

    # Tax calculation check
    if all(v is not None for v in [taxable_amount, total_amount]):
        calculated_tax = Decimal(0)
        if cgst:
            calculated_tax += cgst
        if sgst:
            calculated_tax += sgst
        if igst:
            calculated_tax += igst
        calculated_total = taxable_amount + calculated_tax
        if abs(calculated_total - total_amount) > Decimal("1.00"):
            errors.append(
                f"Tax calculation mismatch: taxable {taxable_amount} + tax {calculated_tax} = {calculated_total}, but total is {total_amount}"
            )

    return errors
