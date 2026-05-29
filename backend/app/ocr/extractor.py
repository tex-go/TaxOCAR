import io
from typing import Dict, Any, Tuple
import pdfplumber
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from app.ocr.preprocessor import preprocess_image
from app.ocr.field_extractor import extract_fields


def extract_from_pdf(data: bytes) -> Tuple[str, float, bool]:
    """Return (text, confidence, is_scanned)."""
    text = _extract_pdf_text(data)
    if text and len(text.strip()) > 100:
        return text, 95.0, False

    # Scanned PDF — render pages as images and OCR
    text, conf = _ocr_pdf_pages(data)
    return text, conf, True


def _extract_pdf_text(data: bytes) -> str:
    text_parts = []
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_parts.append(t)
    except Exception:
        pass

    if not "".join(text_parts).strip():
        # Fallback to PyMuPDF
        try:
            doc = fitz.open(stream=data, filetype="pdf")
            for page in doc:
                text_parts.append(page.get_text())
            doc.close()
        except Exception:
            pass

    return "\n".join(text_parts)


def _ocr_pdf_pages(data: bytes) -> Tuple[str, float]:
    texts = []
    confidences = []
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        for page in doc:
            mat = fitz.Matrix(2, 2)  # 2x zoom for quality
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            processed = preprocess_image(img_bytes)
            text, conf = _run_tesseract(processed)
            texts.append(text)
            confidences.append(conf)
        doc.close()
    except Exception:
        pass

    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return "\n".join(texts), avg_conf


def extract_from_image(data: bytes) -> Tuple[str, float]:
    """Return (text, confidence)."""
    processed = preprocess_image(data)
    return _run_tesseract(processed)


def _run_tesseract(image_bytes: bytes) -> Tuple[str, float]:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        # PSM 11 (sparse text) handles varied invoice layouts — tables, columns,
        # multi-section headers — far better than PSM 6 (uniform text block).
        config = "--oem 3 --psm 11 -l eng"
        data = pytesseract.image_to_data(img, config=config, output_type=pytesseract.Output.DICT)
        confs = [int(c) for c in data["conf"] if int(c) > 0]
        text = pytesseract.image_to_string(img, config=config)
        avg_conf = sum(confs) / len(confs) if confs else 0.0

        # If PSM 11 extracted very little, retry with PSM 3 (auto page segmentation)
        if len(text.strip()) < 80:
            cfg3 = "--oem 3 --psm 3 -l eng"
            text3 = pytesseract.image_to_string(img, config=cfg3)
            if len(text3.strip()) > len(text.strip()):
                data3 = pytesseract.image_to_data(img, config=cfg3, output_type=pytesseract.Output.DICT)
                confs3 = [int(c) for c in data3["conf"] if int(c) > 0]
                text = text3
                avg_conf = sum(confs3) / len(confs3) if confs3 else avg_conf

        return text, avg_conf
    except Exception:
        return "", 0.0


def process_invoice_file(data: bytes, file_type: str) -> Dict[str, Any]:
    """Main entry point. Returns structured extraction result."""
    if file_type == "pdf":
        raw_text, ocr_confidence, is_scanned = extract_from_pdf(data)
    else:
        raw_text, ocr_confidence = extract_from_image(data)
        is_scanned = True

    result = extract_fields(raw_text)
    return {
        "raw_text": raw_text,
        "ocr_confidence": round(ocr_confidence, 2),
        "is_scanned": is_scanned,
        "fields": result["fields"],
        "field_confidence": result["confidence"],
    }
