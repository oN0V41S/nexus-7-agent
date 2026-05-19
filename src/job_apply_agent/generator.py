"""
Módulo de Geração Contextualizada (REQ-005).

Gera currículo adaptado à vaga e carta de apresentação usando Ollama
para conteúdo contextualizado com fallback para templates.
"""
import json
import logging
import re
from pathlib import Path
from typing import Optional

from fpdf import FPDF

from src.job_apply_agent.config import OLLAMA_URL, OLLAMA_MODEL, PROFILE_DIR
from src.job_apply_agent.analyzer import _call_ollama

logger = logging.getLogger(__name__)


# ─── Templates de carta ──────────────────────────────────────────────────────

COVER_LETTER_TEMPLATE = """{candidate_name}
{candidate_email} | {candidate_phone} | {candidate_location}

{date}

{company_name}
{company_location}

Ref.: Candidatura à vaga de {job_title}

Prezado(a) Recrutador(a),

{body}

Atenciosamente,
{candidate_name}
"""


COVER_LETTER_BODY_TEMPLATE = (
    "Gostaria de expressar meu interesse pela vaga de {job_title} na {company_name}. "
    "Com base na descrição da vaga, identifico forte alinhamento entre minha trajetória "
    "profissional e os requisitos apresentados.\n\n"
    "{strengths_paragraph}\n\n"
    "Estou entusiasmado(a) com a possibilidade de contribuir para os desafios da "
    "{company_name} e acredito que minha experiência pode agregar valor ao time.\n\n"
    "Coloco-me à disposição para uma conversa aprofundada sobre minha candidatura."
)


# ─── Geração via LLM ─────────────────────────────────────────────────────────


def _build_ollama_prompt(section: str, profile: dict, job: dict) -> str:
    """Constrói prompt para o Ollama gerar conteúdo contextualizado."""
    prompts = {
        "resume_summary": (
            "Gere um resumo profissional de 3-4 linhas para um currículo adaptado "
            "à seguinte vaga. Destaque as experiências e habilidades mais relevantes "
            "para a posição. Seja conciso e impactante.\n\n"
            f"Perfil do candidato:\n{json.dumps(profile.get('skills', []), ensure_ascii=False)}\n"
            f"Experiência: {profile.get('experience', '')[:500]}\n\n"
            f"Vaga: {job.get('title', '')} em {job.get('company', '')}\n"
            f"Descrição: {job.get('description', '')[:1000]}\n\n"
            "Resumo profissional (texto puro, sem markdown):"
        ),
        "cover_letter": (
            "Gere o corpo de uma carta de apresentação profissional (2-3 parágrafos) "
            "para a candidatura à vaga abaixo. Use tom profissional e entusiasmado. "
            "Destaque skills relevantes. Mencione contribuições específicas.\n\n"
            f"Candidato: {json.dumps(profile.get('skills', []), ensure_ascii=False)}\n"
            f"Experiência: {profile.get('experience', '')[:800]}\n\n"
            f"Vaga: {job.get('title', '')} em {job.get('company', '')}\n"
            f"Descrição: {job.get('description', '')[:1000]}\n\n"
            "Texto da carta (apenas o corpo, sem saudações, sem markdown):"
        ),
    }
    return prompts.get(section, "")


def _generate_text_ollama(prompt: str) -> Optional[str]:
    """Gera texto via Ollama com tratamento de erro."""
    result = _call_ollama(prompt)
    if result:
        # Limpa markdown residual
        result = re.sub(r"```[\w]*\n?", "", result).strip()
        return result
    return None


# ─── Geração de currículo adaptado ───────────────────────────────────────────


def _build_resume_content(profile: dict, job: dict) -> str:
    """Constrói conteúdo textual do currículo adaptado."""
    lines = []
    name = profile.get("name", "Candidato(a)")
    lines.append(name.upper())
    lines.append("")

    # Summary adaptado
    summary = _generate_text_ollama(_build_ollama_prompt("resume_summary", profile, job))
    if summary:
        lines.append(summary)
    elif profile.get("summary"):
        lines.append(profile["summary"])
    lines.append("")

    # Skills
    if profile.get("skills"):
        lines.append("HABILIDADES")
        lines.append(", ".join(profile["skills"]))
        lines.append("")

    # Experiência
    if profile.get("experience"):
        lines.append("EXPERIÊNCIA PROFISSIONAL")
        lines.append(profile["experience"])
        lines.append("")

    # Formação
    if profile.get("education"):
        lines.append("FORMAÇÃO ACADÊMICA")
        lines.append(profile["education"])
        lines.append("")

    # Idiomas
    if profile.get("languages"):
        lines.append("IDIOMAS")
        lines.append(profile["languages"])
        lines.append("")

    return "\n".join(lines)


def generate_adapted_resume(profile: dict, job: dict, output_dir: Path) -> Path:
    """
    Gera PDF do currículo adaptado à vaga usando fpdf2.

    Args:
        profile: Perfil do candidato (profile.json)
        job: Vaga alvo (com score, gaps, strengths)
        output_dir: Diretório de saída

    Returns:
        Path para o PDF gerado
    """
    content = _build_resume_content(profile, job)
    output_path = output_dir / "resume_adapted.pdf"

    pdf = _render_text_to_pdf(content, title=job.get("title", "Resume"))
    pdf.output(str(output_path))
    logger.info(f"Currículo adaptado salvo: {output_path}")
    return output_path


# ─── Geração de carta de apresentação ────────────────────────────────────────


def generate_cover_letter(profile: dict, job: dict, output_dir: Path) -> Path:
    """
    Gera PDF da carta de apresentação adaptada à vaga.

    Usa Ollama para gerar conteúdo; fallback para template.
    """
    company = job.get("company", "Empresa")
    title = job.get("title", "Vaga")
    strengths = job.get("strengths", [])

    # Tenta gerar corpo via Ollama
    body = _generate_text_ollama(_build_ollama_prompt("cover_letter", profile, job))

    # Fallback para template
    if not body:
        strengths_text = (
            f"Entre minhas principais qualificações, destaco: "
            f"{', '.join(strengths)}."
        ) if strengths else (
            "Minha trajetória profissional e habilidades técnicas estão alinhadas "
            "com os requisitos da posição."
        )
        body = COVER_LETTER_BODY_TEMPLATE.format(
            job_title=title,
            company_name=company,
            strengths_paragraph=strengths_text,
        )

    letter = COVER_LETTER_TEMPLATE.format(
        candidate_name=profile.get("name", "Candidato(a)"),
        candidate_email=profile.get("email", "email@exemplo.com"),
        candidate_phone=profile.get("phone", "(11) 99999-9999"),
        candidate_location=profile.get("location", "São Paulo, SP"),
        date="",
        company_name=company,
        company_location=job.get("location", ""),
        job_title=title,
        body=body,
    )

    output_path = output_dir / "cover_letter.pdf"
    pdf = _render_text_to_pdf(letter, title=f"Carta - {title}")
    pdf.output(str(output_path))
    logger.info(f"Carta de apresentação salva: {output_path}")
    return output_path


# ─── Renderização PDF ────────────────────────────────────────────────────────


def _render_text_to_pdf(text: str, title: str = "Documento") -> FPDF:
    """Renderiza texto em PDF formatado (fpdf2)."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_font("Helvetica", size=10)

    # Fallback para conteúdo mínimo se vazio
    if not text or not text.strip():
        text = "Documento gerado pelo Job Application Agent"

    for line in text.split("\n"):
        if not line.strip():
            pdf.ln(4)
            continue

        # Detecta linhas em maiúsculas (cabeçalhos de seção)
        if line.isupper() and len(line) > 3:
            pdf.set_font("Helvetica", "B", 11)
            try:
                pdf.cell(0, 6, line)
                pdf.ln()
            except Exception:
                pdf.set_font("Helvetica", size=10)
                pdf.cell(0, 5, line[:50] if len(line) > 50 else line)
                pdf.ln()
        else:
            try:
                pdf.cell(0, 5, line)
                pdf.ln()
            except Exception:
                # Fallback para linha truncada se ainda falhar
                pdf.cell(0, 5, line[:50] if len(line) > 50 else line)
                pdf.ln()

    return pdf


# ─── Orquestração ────────────────────────────────────────────────────────────


def generate_application(profile: dict, job: dict, output_dir: Path) -> dict:
    """
    Pipeline completo de geração: currículo adaptado + carta.

    Args:
        profile: Perfil do candidato
        job: Vaga alvo (enriquecida com análise)
        output_dir: Diretório de saída

    Returns:
        dict com chaves: resume_path, cover_letter_path
    """
    resume_path = generate_adapted_resume(profile, job, output_dir)
    letter_path = generate_cover_letter(profile, job, output_dir)

    return {
        "resume_path": str(resume_path),
        "cover_letter_path": str(letter_path),
    }
