"""How many billable units a document holds, read from the file before any parse.

The beta budget reserves a parse from the quantity measured upstream (task-549,
rule 1 of the task-547 decision, table « Mesure en amont, par type »): pages for
everything LlamaParse prices per page, sheets for a workbook, which it prices per
sheet. Every count here reads the file locally, without any provider:

- **PDF**: the page tree, through ``pypdf``;
- **TIFF**: its frames, through Pillow;
- **PPTX**: the ``ppt/slides/slideN.xml`` entries of the archive;
- **XLSX**: the ``<sheet>`` entries of ``xl/workbook.xml``;
- **JPG, PNG, BMP, HEIF**: one page;
- **DOCX**: pages never counted. LlamaParse bills the pages of its own render
  and ignores the ``Pages`` field of ``docProps/app.xml`` (measured 2026-10-29: a
  file declaring 80 pages billed 5), which no renderer available to the arm64
  worker can reproduce: the per-item ceiling is always reserved and the parse is
  settled on the pages LlamaParse bills. Its **text** is read instead, so that the
  preview and the translation reserved with the import (rule 10) are sized on the
  text itself rather than on 100 pages of it.

A count that cannot be read is ``None``, never a guess: the caller reserves the
per-item ceiling (rule 3). The text formats cost no provider call and are not
measured.
"""

from __future__ import annotations

import logging
import re
import zipfile
from dataclasses import dataclass
from typing import Optional, Tuple
from xml.etree import ElementTree

from media_summarizer.core.ports.document_parser import DocumentFormat
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

_SINGLE_PAGE_IMAGES = frozenset(
    {
        DocumentFormat.IMAGE_JPG,
        DocumentFormat.IMAGE_JPEG,
        DocumentFormat.IMAGE_PNG,
        DocumentFormat.IMAGE_BMP,
        DocumentFormat.IMAGE_HEIF,
    }
)
_SLIDE_ENTRY = re.compile(r"^ppt/slides/slide\d+\.xml$")
_SHEET_ELEMENT = re.compile(rb"<(?:\w+:)?sheet\b")
# The parts of a DOCX whose text reaches the parse output, and the pictures it may OCR.
_DOCX_TEXT_PART = re.compile(r"^word/(?:document|footnotes|endnotes|header\d*|footer\d*)\.xml$")
_DOCX_MEDIA_ENTRY = re.compile(r"^word/media/[^/]+$")
_DOCX_TEXT_ELEMENT = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"


@dataclass(frozen=True)
class DocumentUnits:
    """The unit a document is billed in, and how many of them it holds."""

    #: ``page`` or ``sheet``: the unit of ``beta_budget.document_line``.
    unit: str
    #: None when the file does not tell (always for a DOCX).
    count: Optional[int]
    #: UTF-8 size of the text a DOCX holds. None for every other format, and for
    #: a DOCX whose text cannot be read.
    text_bytes: Optional[int] = None
    #: Pictures embedded in a DOCX, whose text the parse may add by OCR.
    embedded_images: int = 0


def measure(file_path: str, document_format: DocumentFormat) -> DocumentUnits:
    """Count the billable units of one file. Never raises."""
    if document_format == DocumentFormat.XLSX:
        return DocumentUnits("sheet", _guarded(_count_sheets, file_path, document_format))
    if document_format in _SINGLE_PAGE_IMAGES:
        return DocumentUnits("page", 1)
    if document_format == DocumentFormat.PDF:
        return DocumentUnits("page", _guarded(_count_pdf_pages, file_path, document_format))
    if document_format == DocumentFormat.IMAGE_TIFF:
        return DocumentUnits("page", _guarded(_count_tiff_frames, file_path, document_format))
    if document_format == DocumentFormat.PPTX:
        return DocumentUnits("page", _guarded(_count_slides, file_path, document_format))
    if document_format == DocumentFormat.DOCX:
        return _measure_docx(file_path)
    return DocumentUnits("page", None)


def _measure_docx(file_path: str) -> DocumentUnits:
    try:
        text_bytes, embedded_images = _read_docx_text(file_path)
    except Exception as exc:  # noqa: BLE001 - an unreadable text reserves the ceiling
        log_event(
            logger,
            logging.WARNING,
            "budget.document_text_unmeasured",
            "DOCX text unreadable; the per-item ceiling of text is reserved",
            error_type=type(exc).__name__,
        )
        return DocumentUnits("page", None)
    return DocumentUnits("page", None, text_bytes=text_bytes, embedded_images=embedded_images)


def _guarded(counter, file_path: str, document_format: DocumentFormat) -> Optional[int]:  # type: ignore[no-untyped-def]
    try:
        count = int(counter(file_path))
    except Exception as exc:  # noqa: BLE001 - an unreadable count reserves the ceiling
        log_event(
            logger,
            logging.WARNING,
            "budget.document_unmeasured",
            "Document units unreadable; the per-item ceiling is reserved",
            document_format=document_format.value,
            error_type=type(exc).__name__,
        )
        return None
    return count if count > 0 else None


def _count_pdf_pages(file_path: str) -> int:
    from pypdf import PdfReader

    return len(PdfReader(file_path).pages)


def _count_tiff_frames(file_path: str) -> int:
    from PIL import Image

    with Image.open(file_path) as image:
        return int(getattr(image, "n_frames", 1) or 1)


def _count_slides(file_path: str) -> int:
    with zipfile.ZipFile(file_path) as archive:
        return sum(1 for name in archive.namelist() if _SLIDE_ENTRY.match(name))


def _count_sheets(file_path: str) -> int:
    with zipfile.ZipFile(file_path) as archive:
        return len(_SHEET_ELEMENT.findall(archive.read("xl/workbook.xml")))


def _read_docx_text(file_path: str) -> Tuple[int, int]:
    """The UTF-8 bytes of every ``<w:t>`` run, and the count of embedded pictures.

    Parts are streamed and cleared as they are read: the compressed size an upload
    is limited to does not bound the size of its XML.
    """
    text_bytes = 0
    with zipfile.ZipFile(file_path) as archive:
        names = archive.namelist()
        for name in names:
            if not _DOCX_TEXT_PART.match(name):
                continue
            with archive.open(name) as part:
                for _, element in ElementTree.iterparse(part):
                    if element.tag == _DOCX_TEXT_ELEMENT and element.text:
                        text_bytes += len(element.text.encode("utf-8"))
                    element.clear()
        embedded_images = sum(1 for name in names if _DOCX_MEDIA_ENTRY.match(name))
    return text_bytes, embedded_images
