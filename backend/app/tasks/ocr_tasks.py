from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.invoice import Invoice, InvoiceStatus, InvoiceAuditLog
from app.services.storage import StorageService
from app.services.validation import validate_invoice
from app.ocr.extractor import process_invoice_file
from app.ocr.template_matcher import find_template, apply_template_patterns
import logging

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_invoice_task(self, invoice_id: str):
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

        # Process OCR
        result = process_invoice_file(file_data, invoice.file_type)

        invoice.ocr_raw_text = result["raw_text"]
        invoice.ocr_confidence = result["ocr_confidence"]
        invoice.is_scanned = result["is_scanned"]

        fields = result["fields"]
        field_confidence = result["field_confidence"]

        # Template matching
        vendor_gstin = fields.get("vendor_gstin")
        template = find_template(str(invoice.org_id), vendor_gstin, db)

        if template:
            invoice.template_id = template.id
            overrides = apply_template_patterns(result["raw_text"], template)
            fields.update(overrides)
            for field in overrides:
                field_confidence[field] = 95.0  # Template-matched fields get high confidence

        # Set fields on invoice
        for field, value in fields.items():
            if hasattr(invoice, field):
                setattr(invoice, field, value)

        invoice.field_confidence = field_confidence

        # Duplicate detection
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

        # Validate
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

        invoice.validation_errors = errors if errors else []

        # Determine final status
        has_low_confidence = any(
            v < 70 for v in field_confidence.values()
        )

        if not template and vendor_gstin:
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
            new_value=f"Status: {invoice.status}, Confidence: {invoice.ocr_confidence}%",
        )
        db.add(log)
        db.commit()
        logger.info(f"Invoice {invoice_id} processed: status={invoice.status}")

    except Exception as exc:
        logger.exception(f"Error processing invoice {invoice_id}: {exc}")
        try:
            invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
            if invoice:
                invoice.status = InvoiceStatus.failed
                invoice.validation_errors = [str(exc)]
                db.commit()
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db.close()
