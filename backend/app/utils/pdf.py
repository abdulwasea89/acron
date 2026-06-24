"""Lightweight PDF/document generation for receipts and pay stubs.

Produces a minimal but valid PDF without external dependencies. This keeps the
backend runnable with zero extra system packages; swap for a richer renderer
(WeasyPrint/ReportLab) in production if desired.
"""

from __future__ import annotations


def _escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def render_simple_pdf(title: str, lines: list[str]) -> bytes:
    """Render a single-page PDF with a title and body lines. Returns bytes."""

    body_lines = [title, ""] + lines
    text_ops = ["BT", "/F1 14 Tf", "72 760 Td", "16 TL"]
    for i, line in enumerate(body_lines):
        text_ops.append(f"({_escape(line)}) Tj" if i == 0 else f"T* ({_escape(line)}) Tj")
    text_ops.append("ET")
    content = "\n".join(text_ops).encode("latin-1", "replace")

    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objects.append(
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
    )
    objects.append(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content))
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    pdf = b"%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref_pos = len(pdf)
    pdf += b"xref\n0 %d\n" % (len(objects) + 1)
    pdf += b"0000000000 65535 f \n"
    for off in offsets:
        pdf += b"%010d 00000 n \n" % off
    pdf += b"trailer\n<< /Size %d /Root 1 0 R >>\n" % (len(objects) + 1)
    pdf += b"startxref\n%d\n%%%%EOF" % xref_pos
    return pdf
