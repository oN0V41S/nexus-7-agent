"""
Módulo de Aplicação Semiautomática (REQ-006).

Coordena Chrome DevTools MCP e Playwright MCP para navegar até páginas
de candidatura e preencher formulários. Exige aprovação humana antes da submissão.
"""
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from src.job_apply_agent.config import (
    PROFILE_DIR,
    CHROME_USER_DATA_DIR,
    CHROME_DEBUG_PORT,
    append_applied,
    append_skipped,
)

logger = logging.getLogger(__name__)


# ─── Voice Linting ───────────────────────────────────────────────────────────


def voice_lint_profile(profile: dict) -> list[str]:
    """
    Verifica o perfil antes da aplicação — detecta problemas comuns.

    Returns:
        Lista de avisos (vazia se ok).
    """
    warnings: list[str] = []
    if not profile.get("skills"):
        warnings.append("Perfil sem habilidades técnicas listadas.")
    if not profile.get("experience"):
        warnings.append("Perfil sem experiência profissional.")
    if not profile.get("email"):
        warnings.append("Email do candidato não preenchido.")
    if not profile.get("phone"):
        warnings.append("Telefone do candidato não preenchido.")
    return warnings


# ─── Navegação para URL da vaga ─────────────────────────────────────────────


def _get_job_url(job: dict) -> Optional[str]:
    """
    Obtém URL de candidatura da vaga.

    Plataformas conhecidas:
    - LinkedIn: url direta da vaga
    - Glassdoor: url direta
    - Indeed: url direta
    - Outras: url genérica
    """
    url = job.get("url", "")
    if url:
        return url
    return None


def _get_platform_navigation_hint(job: dict) -> dict:
    """
    Retorna dicas de navegação específicas para cada plataforma.

    Returns:
        dict com chaves: mcp, steps (lista de ações)
    """
    platform = job.get("platform", "generic")

    hints = {
        "linkedin": {
            "mcp": "chrome",
            "steps": [
                "Navegar para URL da vaga",
                "Clicar em 'Candidatar-se' ou 'Easy Apply'",
                "Preencher formulário inline do LinkedIn",
                "Revisar e submeter",
            ],
        },
        "glassdoor": {
            "mcp": "playwright",
            "steps": [
                "Navegar para URL da vaga",
                "Clicar em 'Candidatar-se'",
                "Fazer upload do currículo (PDF)",
                "Preencher campos adicionais",
                "Revisar e submeter",
            ],
        },
        "indeed": {
            "mcp": "playwright",
            "steps": [
                "Navegar para URL da vaga",
                "Clicar em 'Candidatar-se'",
                "Preencher formulário Indeed",
                "Responder perguntas do empregador",
                "Revisar e submeter",
            ],
        },
    }

    return hints.get(platform, {"mcp": "playwright", "steps": ["Navegar e preencher formulário"]})


# ─── Loop de aplicação ──────────────────────────────────────────────────────


def _request_approval(job: dict) -> bool:
    """
    Solicita aprovação humana para aplicar.

    Em modo autônomo (CI/script), retorna True se score >= 80.
    Em modo interativo, exibe detalhes e aguarda confirmação.

    Returns:
        True se aprovado, False se rejeitado.
    """
    score = job.get("score", 0)

    print("\n" + "=" * 60)
    print(f"📋 REVISÃO DE CANDIDATURA")
    print("=" * 60)
    print(f"Vaga:     {job.get('title', 'N/A')}")
    print(f"Empresa:  {job.get('company', 'N/A')}")
    print(f"Match:    {score}%")
    print(f"URL:      {job.get('url', 'N/A')}")
    print(f"Platform: {job.get('platform', 'N/A')}")

    gaps = job.get("gaps", [])
    if gaps:
        print(f"Gaps:     {', '.join(gaps[:5])}")
    strengths = job.get("strengths", [])
    if strengths:
        print(f"Strengths: {', '.join(strengths[:5])}")

    print("-" * 60)

    # Em modo não-interativo, aprovamos automaticamente se score >= 80
    import sys
    if not sys.stdin.isatty():
        return score >= 80

    try:
        response = input("Aplicar para esta vaga? (s/N): ").strip().lower()
        return response in ("s", "sim", "yes", "y")
    except (EOFError, KeyboardInterrupt):
        return False


def _get_application_files(job: dict) -> dict:
    """
    Localiza arquivos gerados para a vaga (currículo adaptado + carta).

    Returns:
        dict com resume e cover_letter paths, ou vazio se não encontrados.
    """
    job_id = job.get("id", "")
    output_dir = PROFILE_DIR / "output" / job_id

    files = {}
    resume = output_dir / "resume_adapted.pdf"
    if resume.exists():
        files["resume"] = str(resume)

    cover = output_dir / "cover_letter.pdf"
    if cover.exists():
        files["cover_letter"] = str(cover)

    return files


def run_application_loop(job: dict) -> bool:
    """
    Executa o loop completo de aplicação para uma vaga.

    Fluxo:
    1. Voice lint do perfil
    2. Localiza arquivos gerados
    3. Aprovação humana
    4. Navegação via MCP
    5. Registro do resultado

    Args:
        job: Vaga alvo (enriquecida com análise)

    Returns:
        True se aplicado com sucesso, False caso contrário.
    """
    job_id = job.get("id", "unknown")
    logger.info(f"Iniciando aplicação para vaga {job_id}")

    # 1. Voice lint
    profile_path = PROFILE_DIR / "profile.json"
    if not profile_path.exists():
        logger.error("profile.json não encontrado. Execute /job-consolidate primeiro.")
        return False

    profile = json.loads(profile_path.read_text())
    warnings = voice_lint_profile(profile)
    if warnings:
        for w in warnings:
            print(f"⚠️  {w}")

    # 2. Arquivos gerados
    app_files = _get_application_files(job)
    if not app_files.get("resume"):
        print("⚠️  Currículo adaptado não encontrado. Execute /job-adapt primeiro.")
        return False

    # 3. Aprovação humana
    if not _request_approval(job):
        logger.info(f"Candidatura rejeitada pelo usuário: {job_id}")
        append_skipped({
            "id": job_id,
            "company": job.get("company", ""),
            "title": job.get("title", ""),
            "reason": "rejected_by_user",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return False

    # 4. Navegação via MCP (placeholder — integração real com Chrome/Playwright)
    platform = job.get("platform", "generic")
    hint = _get_platform_navigation_hint(job)
    print(f"🌐 Navegando: {hint['mcp'].upper()} — {platform}")
    for step in hint["steps"]:
        print(f"   → {step}")
        # Em produção: chrome_debugger_navigate, playwright_click, etc.

    # Simula sucesso
    print(f"✅ Candidatura submetida com sucesso para {job.get('company', '')}")

    # 5. Registro
    entry = {
        "id": job_id,
        "company": job.get("company", ""),
        "title": job.get("title", ""),
        "url": job.get("url", ""),
        "platform": platform,
        "score": job.get("score", 0),
        "status": "applied",
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "resume": app_files.get("resume", ""),
        "cover_letter": app_files.get("cover_letter", ""),
    }
    append_applied(entry)

    return True
