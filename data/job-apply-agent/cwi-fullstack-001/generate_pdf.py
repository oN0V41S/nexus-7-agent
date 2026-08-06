#!/usr/bin/env python3
"""Gera PDF do currículo adaptado usando fpdf2."""

import re
from fpdf import FPDF


class ResumePDF(FPDF):
    def header(self):
        pass

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f"Pagina {self.page_no()}", align="C")


def parse_and_write(pdf, text, bold=False, italic=False, font="Helvetica"):
    """Parse inline markdown and write to PDF."""
    parts = re.split(r'(\*\*[^*]+\*\*)', text)
    for part in parts:
        if part.startswith('**') and part.endswith('**'):
            pdf.set_font(font, "B", 10)
            pdf.write(4, part[2:-2])
            if bold:
                pdf.set_font(font, "B", 10)
            else:
                pdf.set_font(font, "", 10)
        elif part:
            if italic:
                pdf.set_font(font, "I", 10)
            else:
                pdf.set_font(font, "", 10)
            pdf.write(4, part)


def main():
    pdf = ResumePDF(format='A4')
    pdf.set_auto_page_break(auto=True, margin=15)
    
    import os
    base = "/usr/share/fonts/truetype/liberation"
    if os.path.exists(f"{base}/LiberationSans-Regular.ttf"):
        pdf.add_font("LibSans", "", f"{base}/LiberationSans-Regular.ttf")
        pdf.add_font("LibSans", "B", f"{base}/LiberationSans-Bold.ttf")
        pdf.add_font("LibSans", "I", f"{base}/LiberationSans-Italic.ttf")
        pdf.add_font("LibSans", "BI", f"{base}/LiberationSans-BoldItalic.ttf")
        FONT = "LibSans"
    else:
        FONT = "Helvetica"
    
    pdf.add_page()

    with open("data/job-apply-agent/cwi-fullstack-001/resume_adapted.md", "r") as f:
        lines = f.readlines()

    margin_left = 15
    margin_right = 15
    pdf.set_left_margin(margin_left)
    pdf.set_right_margin(margin_right)
    pdf.set_x(margin_left)

    for line in lines:
        line = line.rstrip('\n')

        if line.startswith('# ') and not line.startswith('## '):
            pdf.set_font(FONT, "B", 15)
            pdf.set_text_color(0, 0, 0)
            pdf.cell(0, 8, line[2:], align="C", new_x="LMARGIN", new_y="NEXT")

        elif line.startswith('## '):
            pdf.ln(3)
            pdf.set_font(FONT, "B", 10.5)
            pdf.set_text_color(51, 51, 51)
            pdf.cell(0, 6, line[3:].upper(), new_x="LMARGIN", new_y="NEXT")
            y = pdf.get_y()
            pdf.set_draw_color(51, 51, 51)
            pdf.set_line_width(0.3)
            pdf.line(margin_left, y, pdf.w - margin_right, y)
            pdf.ln(1.5)

        elif line.startswith('### '):
            pdf.ln(1.5)
            pdf.set_font(FONT, "BI", 10)
            pdf.set_text_color(0, 0, 0)
            pdf.cell(0, 5, line[4:], new_x="LMARGIN", new_y="NEXT")

        elif line.startswith('- '):
            pdf.set_font(FONT, "", 9.5)
            pdf.set_text_color(0, 0, 0)
            pdf.set_x(margin_left + 3)
            pdf.cell(3, 4, "-")
            parse_and_write(pdf, line[2:], font=FONT)
            pdf.ln(4)

        elif line.strip() == '':
            continue

        elif '|' in line and not line.startswith('**'):
            pdf.set_font(FONT, "", 9)
            pdf.set_text_color(80, 80, 80)
            parts = [p.strip() for p in line.split(' | ')]
            pdf.cell(0, 4, "  |  ".join(parts), align="C", new_x="LMARGIN", new_y="NEXT")

        else:
            pdf.set_font(FONT, "", 9.5)
            pdf.set_text_color(0, 0, 0)
            parse_and_write(pdf, line, font=FONT)
            pdf.ln(4)

    pdf.output("data/job-apply-agent/cwi-fullstack-001/resume_adapted.pdf")
    print("✅ PDF gerado com sucesso")


if __name__ == "__main__":
    main()
