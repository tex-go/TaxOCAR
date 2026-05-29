from typing import Optional
from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.invoice import Invoice, InvoiceStatus, InvoiceAuditLog
from app.models.template import InvoiceTemplate
from app.services.storage import StorageService
from app.services.validation import validate_invoice
from app.ocr.extractor import process_invoice_file
from app.ocr.template_matcher import (
    find_best_template,
    apply_template_patterns,
    apply_template_coordinates,
)
import logging

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_invoice_task(
    self,
    invoice_id: str,
    force_template_id: Optional[str] = None,
    skip_template: bool = False,
):
    """
    Process a single invoice through OCR → template matching → validation.

    force_template_id: use this specific template (user annotated it for this invoice)
    skip_template: user chose to skip annotation; process generically, don't re-flag needs_template
    """
    db = SessionLocal()
    try:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            logger.error(f"Invoice {invoice_id} not found")
            return

        invoice.status = InvoiceStatus.processing
        db.commit()

        # Download file
        storage = StorageService()
        file_data = storage.download(invoice.file_path)

        # Run OCR
        result = process_invoice_file(file_data, invoice.file_type)

        invoice.ocr_raw_text  = result["raw_text"]
        invoice.ocr_confidence = result["ocr_confidence"]
        invoice.is_scanned    = result["is_scanned"]

        fields         = result["fields"]
        field_confidence = result["field_confidence"]

        # ── Template resolution ───────────────────────────────────────────────
        template = None

        if force_template_id:
            # User explicitly chose/created a template for this invoice
            template = (
                db.query(InvoiceTemplate)
                .filter(InvoiceTemplate.id == force_template_id)
                .first()
            )
            if template:
                invoice.template_id = template.id

        elif not skip_template:
            # Auto-detect: GSTIN exact → vendor name fuzzy
            vendor_gstin = fields.get("vendor_gstin")
            vendor_name  = fields.get("vendor_name")
            template, match_type = find_best_template(
                str(invoice.org_id), vendor_gstin, vendor_name, db
            )
            if template:
                invoice.template_id = template.id
                logger.info(f"Invoice {invoice_id}: template matched by {match_type} → {template.name}")

        # ── Apply template extractions ────────────────────────────────────────
        if template:
            # Coordinate crop extraction (highest accuracy)
            if template.coordinates:
                coord_fields = apply_template_coordinates(file_data, invoice.file_type, template)
                fields.update(coord_fields)
                for f in coord_fields:
                    field_confidence[f] = 97.0

            # Regex pattern overrides (fill remaining gaps)
            pattern_fields = apply_template_patterns(result["raw_text"], template)
            fields.update(pattern_fields)
            for f in pattern_fields:
                if f not in field_confidence or field_confidence[f] < 95.0:
                    field_confidence[f] = 95.0

        # ── Write extracted fields to invoice ────────────────────────────────
        for field, value in fields.items():
            if hasattr(invoice, field):
                setattr(invoice, field, value)

        invoice.field_confidence = field_confidence

        # ── Duplicate detection ───────────────────────────────────────────────
        if invoice.vendor_gstin and invoice.invoice_number:
            duplicate = (
                db.query(Invoice)
                .filter(
                    Invoice.org_id == invoice.org_id,
                    Invoice.vendor_gstin == invoice.vendor_gstin,
                    Invoice.invoice_number == invoice.invoice_number,
                    Invoice.id != invoice.id,
                )
                .first()
            )
            if duplicate:
                invoice.is_duplicate = True
                invoice.duplicate_of = duplicate.id

        # ── Validation ────────────────────────────────────────────────────────
        errors = validate_invoice(
            invoice_number=invoice.invoice_number,
            invoice_date=invoice.invoice_date,
            vendor_gstin=invoice.vendor_gstin,
            taxable_amount=invoice.taxable_amount,
            cgst=invoice.cgst,
            sgst=invoice.sgst,
            igst=invoice.igst,
            total_amount=invoice.total_amount,
        )
        invoice.validation_errors = errors or []

        # ── Determine final status ────────────────────────────────────────────
        has_low_confidence = any(v < 70 for v in field_confidence.values())

        if not template and not skip_template and fields.get("vendor_gstin"):
            # Known vendor (GSTIN readable) but no template → ask user to create one
            invoice.status = InvoiceStatus.needs_template
        elif errors or invoice.is_duplicate or has_low_confidence:
            invoice.status = InvoiceStatus.needs_review
        else:
            invoice.status = InvoiceStatus.completed

        log = InvoiceAuditLog(
            org_id=invoice.org_id,
            invoice_id=invoice.id,
            user_id=None,
            action="ocr_completed",
            new_value=(
                f"Status: {invoice.status}, Confidence: {invoice.ocr_confidence}%, "
                f"Template: {template.name if template else 'none'}"
            ),
        )
        db.add(log)
        db.commit()
        logger.info(f"Invoice {invoice_id} processed: status={invoice.status}")

    except Exception as exc:
        logger.exception(f"Error processing invoice {invoice_id}: {exc}")
        try:
            inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
            if inv:
                inv.status = InvoiceStatus.failed
                inv.validation_errors = [str(exc)]
                db.commit()
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db.close()
