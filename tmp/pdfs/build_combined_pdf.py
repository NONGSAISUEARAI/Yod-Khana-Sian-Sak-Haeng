from pathlib import Path

from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


sources = [
    Path(r"C:\Users\popul\OneDrive\เอกสาร\S__32849927_0.jpg"),
    Path(r"C:\Users\popul\OneDrive\เอกสาร\S__32849924_0.jpg"),
]
output = Path(r"output\pdf\รวมเอกสาร.pdf")

page_width, page_height = A4
margin = 12
pdf = canvas.Canvas(str(output), pagesize=A4)
pdf.setTitle("รวมเอกสาร")

for image_path in sources:
    with Image.open(image_path) as image:
        image_width, image_height = image.size
    scale = min((page_width - 2 * margin) / image_width, (page_height - 2 * margin) / image_height)
    draw_width = image_width * scale
    draw_height = image_height * scale
    pdf.drawImage(
        str(image_path),
        (page_width - draw_width) / 2,
        (page_height - draw_height) / 2,
        width=draw_width,
        height=draw_height,
        preserveAspectRatio=True,
        mask="auto",
    )
    pdf.showPage()

pdf.save()
