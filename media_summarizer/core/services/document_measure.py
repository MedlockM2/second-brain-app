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
- **DOCX**: never counted. A DOCX has no pages before it is rendered, and the
  ``Pages`` field of ``docProps/app.xml`` is often missing or stale, so it is not
  a bound: the per-item ceiling is always reserved and the parse is settled on
  the pages LlamaParse bills.

A count that cannot be read is ``None``, never a guess: the caller reserves the
per-item ceiling (rule 3). The text formats cost no provider call and are not
measured.
"""

from __future__ import annotations

import logging
import re
import zipfile
from dataclasses import dataclass
from typing import Optional

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


@dataclass(frozen=True)
class DocumentUnits:
    """The unit a document is billed in, and how many of them it holds."""

    #: ``page`` or ``sheet``: the unit of ``beta_budget.document_line``.
    unit: str
    #: None when the file does not tell (always for a DOCX).
    count: Optional[int]


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
    return DocumentUnits("page", None)


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
