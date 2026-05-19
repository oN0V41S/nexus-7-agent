"""
Módulo de Consolidação de Currículos (REQ-004).

Extrai texto de múltiplos PDFs de currículo, normaliza em perfil unificado
e gera DOCX padrão ATS de 1 página + PDF de saída.
"""
import json
import logging
import re
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from src.job_apply_agent.config import PROFILE_DIR

logger = logging.getLogger(__name__)


# ─── Extração ────────────────────────────────────────────────────────────────


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extrai texto completo de um PDF usando PyMuPDF."""
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF não encontrado: {pdf_path}")

    text_parts: list[str] = []
    with fitz.open(str(pdf_path)) as doc:
        for page in doc:
            text_parts.append(page.get_text())

    full_text = "\n".join(text_parts)
    logger.info(f"Extraídos {len(full_text)} caracteres de {pdf_path.name}")
    return full_text


def normalize_text(text: str) -> str:
    """Remove espaços extras, normaliza quebras de linha."""
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\n\s*\n", "\n\n", text)
    return text.strip()


# ─── Parse de seções ─────────────────────────────────────────────────────────


_SECTION_HEADERS = [
    "experiência", "experiencia", "formação", "formacao", "educação", "educacao",
    "habilidades", "skills", "idiomas", "cursos", "certificações", "certificacoes",
    "projetos", "projects", "resumo", "objetivo", "summary", "objective",
    "publicações", "publicacoes", "idioma",
]


def _guess_section(line: str) -> Optional[str]:
    """Tenta identificar se uma linha é cabeçalho de seção."""
    clean = line.strip().lower().rstrip(":")
    for header in _SECTION_HEADERS:
        # Exato ou contido
        if clean == header or clean.startswith(header):
            return header
    return None


def parse_resume_sections(text: str) -> dict[str, str]:
    """Divide texto de currículo em seções nomeadas."""
    lines = text.split("\n")
    sections: dict[str, str] = {"__header": ""}
    current_section = "__header"

    for line in lines:
        header = _guess_section(line)
        if header:
            current_section = header
            sections[current_section] = ""
        else:
            sections[current_section] = sections.get(current_section, "") + line + "\n"

    # Remove whitespace
    for key in sections:
        sections[key] = sections[key].strip()

    return sections


# ─── Geração de perfil ───────────────────────────────────────────────────────


def build_profile_from_sections(sections: dict[str, str]) -> dict:
    """Constrói dicionário de perfil estruturado a partir das seções extraídas."""
    skills_text = " ".join([
        sections.get(h, "") for h in ["habilidades", "skills", "cursos"]
    ])
    # Extrai skills como palavras capitalizadas
    skill_words = re.findall(r"[A-Z][a-zA-Z+#]+(?:\s*[A-Z][a-zA-Z+#]*)*", skills_text)
    skills = sorted(set(s.strip() for s in skill_words if len(s.strip()) > 1))

    experience = sections.get("experiência", "") or sections.get("experiencia", "")
    education = sections.get("formação", "") or sections.get("formacao", "") \
        or sections.get("educação", "") or sections.get("educacao", "")

    profile = {
        "skills": skills,
        "experience": normalize_text(experience),
        "education": normalize_text(education),
        "summary": normalize_text(
            sections.get("resumo", "") or sections.get("summary", "")
            or sections.get("objetivo", "") or sections.get("objective", "")
        ),
        "languages": normalize_text(sections.get("idiomas", "")),
        "certifications": normalize_text(sections.get("certificações", "")
                                         or sections.get("certificacoes", "")),
    }
    return profile


def merge_profiles(profiles: list[dict]) -> dict:
    """Merge de múltiplos perfis (ex: PDFs de fontes diferentes)."""
    merged = {}
    all_skills: set[str] = set()
    experiences: list[str] = []
    summaries: list[str] = []

    for p in profiles:
        all_skills.update(p.get("skills", []))
        if p.get("experience"):
            experiences.append(p["experience"])
        if p.get("summary"):
            summaries.append(p["summary"])
        # Pega a primeira education não vazia
        if p.get("education") and not merged.get("education"):
            merged["education"] = p["education"]
        if p.get("languages") and not merged.get("languages"):
            merged["languages"] = p["languages"]
        if p.get("certifications"):
            merged["certifications"] = p.get("certifications", "")

    merged["skills"] = sorted(all_skills)
    merged["experience"] = "\n\n".join(experiences) if experiences else ""
    merged["summary"] = " ".join(summaries) if summaries else ""
    return merged


# ─── Geração DOCX ATS ────────────────────────────────────────────────────────


def generate_ats_docx(profile: dict, output_path: Path) -> Path:
    """Gera DOCX padronizado para ATS (1 página, fonte limpa)."""
    doc = Document()

    # Configurar margens apertadas
    for section in doc.sections:
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.7)
        section.right_margin = Inches(0.7)

    style = doc.styles["Normal"]
    font = style.font
    font.name = "Calibri"
    font.size = Pt(10.5)
    font.color.rgb = RGBColor(0x1A, 0x1A, 0x1A)
    paragraph_format = style.paragraph_format
    paragraph_format.space_after = Pt(2)
    paragraph_format.space_before = Pt(0)
    paragraph_format.line_spacing = 1.15

    # Nome (placeholder — virá do profile ou será editado manualmente)
    name = profile.get("name", "Candidato(a)")
    p = doc.add_heading(name, level=1)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in p.runs:
        run.font.size = Pt(16)
        run.font.color.rgb = RGBColor(0x1A, 0x1A, 0x1A)

    # Summary
    if profile.get("summary"):
        p = doc.add_paragraph(profile["summary"])
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        for run in p.runs:
            run.font.size = Pt(10)

    # Skills
    if profile.get("skills"):
        doc.add_heading("Habilidades", level=2)
        skills_text = ", ".join(profile["skills"])
        p = doc.add_paragraph(skills_text)
        for run in p.runs:
            run.font.size = Pt(10)

    # Experience
    if profile.get("experience"):
        doc.add_heading("Experiência Profissional", level=2)
        for exp_block in profile["experience"].split("\n\n"):
            p = doc.add_paragraph(exp_block.strip())
            for run in p.runs:
                run.font.size = Pt(10)

    # Education
    if profile.get("education"):
        doc.add_heading("Formação Acadêmica", level=2)
        p = doc.add_paragraph(profile["education"])
        for run in p.runs:
            run.font.size = Pt(10)

    # Languages
    if profile.get("languages"):
        doc.add_heading("Idiomas", level=2)
        p = doc.add_paragraph(profile["languages"])
        for run in p.runs:
            run.font.size = Pt(10)

    # Certifications
    if profile.get("certifications"):
        doc.add_heading("Certificações", level=2)
        p = doc.add_paragraph(profile["certifications"])
        for run in p.runs:
            run.font.size = Pt(10)

    doc.save(str(output_path))
    logger.info(f"DOCX salvo: {output_path}")
    return output_path


# ─── Geração PDF ─────────────────────────────────────────────────────────────


def generate_pdf_from_docx(docx_path: Path, output_path: Path) -> Path:
    """
    Converte DOCX para PDF usando fpdf2 com re-extração de texto.

    Nota: Para conversão direta DOCX→PDF com formatação completa,
    considere LibreOffice headless (soffice --convert-to pdf).
    Aqui usamos fpdf2 como fallback portável.
    """
    # Placeholder: fpdf2 exigiria re-parsing do docx.
    # Por ora, copiamos o DOCX como base.
    # Em produção, substitua por conversão via LibreOffice ou Unoconv.
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=10)

    doc = Document(str(docx_path))
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        # Tenta detectar cabeçalhos
        if para.style.name.startswith("Heading"):
            pdf.set_font("Helvetica", "B", 12)
            pdf.multi_cell(0, 6, text)
            pdf.set_font("Helvetica", size=10)
        else:
            pdf.multi_cell(0, 5, text)

    pdf.output(str(output_path))
    logger.info(f"PDF salvo: {output_path}")
    return output_path


# ─── Orquestração ────────────────────────────────────────────────────────────


def consolidate_pdfs_to_docx(pdf_paths: list[Path], output_dir: Path) -> dict:
    """
    Pipeline completo: extrai PDFs → constrói perfil → gera DOCX + PDF.

    Returns:
        dict com chaves: profile, docx_path, pdf_path
    """
    profiles = []
    for pdf_path in pdf_paths:
        text = extract_text_from_pdf(pdf_path)
        sections = parse_resume_sections(text)
        profile = build_profile_from_sections(sections)
        profiles.append(profile)

    merged_profile = merge_profiles(profiles)

    # Salva profile.json
    profile_path = PROFILE_DIR / "profile.json"
    profile_path.write_text(
        json.dumps(merged_profile, indent=2, ensure_ascii=False)
    )

    # Gera DOCX
    docx_path = output_dir / "resume_ats.docx"
    generate_ats_docx(merged_profile, docx_path)

    # Gera PDF
    pdf_path = output_dir / "resume_ats.pdf"
    generate_pdf_from_docx(docx_path, pdf_path)

    return {
        "profile": merged_profile,
        "docx_path": str(docx_path),
        "pdf_path": str(pdf_path),
    }
