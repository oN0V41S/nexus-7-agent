"""
Módulo de Desduplicação.

Verifica se uma vaga já foi aplicada consultando:
1. JSONL local (applied.jsonl)
2. Notion (via Notion MCP — página de tracking)

Previne candidaturas duplicadas.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from src.job_apply_agent.config import APPLIED_LOG, load_applied, append_applied

logger = logging.getLogger(__name__)


def _normalize(text: str) -> str:
    """Normaliza string para comparação: lowercase, sem espaços extras."""
    return text.strip().lower()


def _company_variations(name: str) -> list[str]:
    """Gera variações de nome de empresa para matching fuzzy."""
    n = _normalize(name)
    variations = {n}

    # Remove sufixos comuns
    for suffix in [" ltda", " s.a", " s/a", " inc", " corp", " llc", " gmbh", " ltd"]:
        if n.endswith(suffix):
            variations.add(n[: -len(suffix)].strip())

    # Remove acentos simplificados
    replacements = {
        "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
        "ã": "a", "õ": "o", "ç": "c",
        "à": "a", "ê": "e", "ô": "o",
    }
    for old, new in replacements.items():
        if old in n:
            variations.add(n.replace(old, new))

    return list(variations)


# ─── Checagem JSONL ─────────────────────────────────────────────────────────


def check_duplicate_local(company: str, title: str) -> bool:
    """
    Verifica no JSONL local se já existe candidatura para empresa + título.

    Usa matching aproximado (case-insensitive, variações de nome).
    """
    applied = load_applied()
    target_company = _normalize(company)
    target_title = _normalize(title)
    company_variants = _company_variations(company)

    for entry in applied:
        entry_company = _normalize(entry.get("company", ""))
        entry_title = _normalize(entry.get("title", ""))

        # Match de empresa (exato ou variante)
        company_match = (
            entry_company == target_company
            or entry_company in company_variants
            or target_company in _company_variations(entry.get("company", ""))
        )
        # Match de título (contido ou contém)
        title_match = (
            entry_title == target_title
            or target_title in entry_title
            or entry_title in target_title
        )

        if company_match and title_match:
            logger.info(
                f"Duplicata local detectada: {company} / {title}"
                f" — já registrada em {entry.get('date', 'data desconhecida')}"
            )
            return True

    return False


# ─── Checagem Notion ────────────────────────────────────────────────────────


def _notion_available() -> bool:
    """Verifica se o MCP do Notion está disponível."""
    try:
        import importlib
        # Tentativa de verificar se o módulo notion está disponível
        # Na prática, o Notion é um MCP externo configurado no opencode.json
        return True  # Assume disponível; falha será tratada no try/except
    except ImportError:
        return False


async def check_duplicate_notion(company: str, title: str) -> bool:
    """
    Verifica no Notion se a vaga já foi registrada.

    Requer Notion MCP configurado com página de tracking.
    Placeholder — em produção, usa notion_API-query-data-source.

    Returns:
        True se encontrou duplicata no Notion.
    """
    try:
        # Placeholder: integração real com Notion MCP
        # database_id = os.getenv("NOTION_TRACKING_DATABASE_ID", "")
        # results = await notion_API_query_data_source(
        #     data_source_id=database_id,
        #     filter={"property": "company", "text": {"equals": company}}
        # )
        # return len(results.get("results", [])) > 0

        logger.info("Notion check: aguardando MCP Notion...")
        return False
    except Exception as e:
        logger.warning(f"Falha ao consultar Notion: {e}")
        return False


# ─── Interface pública ──────────────────────────────────────────────────────


def check_duplicate(company: str, title: str) -> bool:
    """
    Verifica duplicidade em todas as fontes (JSONL + Notion).

    Args:
        company: Nome da empresa
        title: Título da vaga

    Returns:
        True se duplicata detectada em qualquer fonte.
    """
    if check_duplicate_local(company, title):
        return True

    # Notion check (síncrono adaptado)
    try:
        import asyncio
        result = asyncio.run(check_duplicate_notion(company, title))
        if result:
            return True
    except Exception as e:
        logger.warning(f"Notion check falhou: {e}")

    return False


def mark_as_applied(company: str, title: str, metadata: Optional[dict] = None) -> None:
    """Registra vaga como aplicada na base local."""
    entry = {
        "company": company,
        "title": title,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **(metadata or {}),
    }
    append_applied(entry)
    logger.info(f"Registrado como aplicado: {company} - {title}")
