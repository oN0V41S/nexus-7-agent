"""
Módulo de Busca Multi-plataforma (REQ-002).

Busca vagas em LinkedIn (Chrome MCP), Glassdoor, Indeed e Monster (Playwright MCP).
"""
import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional

from src.job_apply_agent.config import MAX_REQS_PER_MIN, PLATFORMS, SEARCHES_DIR

logger = logging.getLogger(__name__)

# Rate limiting: track requests per platform
_request_timestamps: dict[str, list[float]] = {}


def _check_rate_limit(platform: str) -> None:
    """Aguarda se excedeu o limite de requisições por minuto para a plataforma."""
    now = time.time()
    timestamps = _request_timestamps.setdefault(platform, [])
    # Remove timestamps mais antigos que 60s
    _request_timestamps[platform] = [t for t in timestamps if now - t < 60]

    if len(_request_timestamps[platform]) >= MAX_REQS_PER_MIN:
        wait = 60 - (now - _request_timestamps[platform][0])
        if wait > 0:
            logger.info(f"Rate limit: aguardando {wait:.1f}s para {platform}")
            time.sleep(wait)

    _request_timestamps[platform].append(time.time())


def _make_job_id(platform: str, index: int) -> str:
    """Gera ID único para uma vaga."""
    prefix = platform[:2]
    return f"{prefix}-{index:04d}"


def _build_job_entry(
    title: str,
    company: str,
    location: str,
    description: str,
    url: str,
    date_str: str,
    platform: str,
) -> dict:
    """Constrói dict padronizado de vaga."""
    return {
        "id": _make_job_id(platform, 0),  # será sobrescrito na consolidação
        "title": title.strip(),
        "company": company.strip(),
        "location": location.strip(),
        "description": description.strip(),
        "url": url.strip(),
        "date": date_str.strip(),
        "platform": platform,
        "found_at": datetime.now(timezone.utc).isoformat(),
    }


def search_linkedin(query: str, location: str, filters: str = "") -> list[dict]:
    """
    Busca vagas no LinkedIn via Chrome DevTools MCP.

    Requer Chrome rodando com --remote-debugging-port=9222
    e sessão do LinkedIn ativa.
    """
    logger.info(f"Buscando '{query}' no LinkedIn em '{location}'")
    _check_rate_limit("linkedin")

    # Placeholder: integração real usa chrome_debugger_navigate e chrome_debugger_evaluate
    # Aqui retornamos estrutura simulada para desenvolvimento
    # Em produção, substituir por chamadas reais ao Chrome DevTools MCP
    logger.info("LinkedIn search: aguardando conexão Chrome MCP...")
    return [
        {
            "id": "",
            "title": f"Engenheiro(a) de Software - {query}",
            "company": "Exemplo Tech Ltda",
            "location": location or "São Paulo, Brazil",
            "description": f"Vaga para {query} com experiência em desenvolvimento de software...",
            "url": "https://www.linkedin.com/jobs/view/123456",
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "platform": "linkedin",
            "found_at": datetime.now(timezone.utc).isoformat(),
        }
    ]


def search_glassdoor(query: str, location: str, filters: str = "") -> list[dict]:
    """
    Busca vagas no Glassdoor via Playwright MCP.
    """
    logger.info(f"Buscando '{query}' no Glassdoor em '{location}'")
    _check_rate_limit("glassdoor")

    # Placeholder: integração real usa Playwright MCP
    logger.info("Glassdoor search: aguardando Playwright MCP...")
    return [
        {
            "id": "",
            "title": f"Desenvolvedor(a) {query}",
            "company": "Tech Solutions S.A.",
            "location": location or "São Paulo, SP",
            "description": f"Oportunidade para {query} atuar com tecnologias modernas...",
            "url": "https://www.glassdoor.com/job/789012",
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "platform": "glassdoor",
            "found_at": datetime.now(timezone.utc).isoformat(),
        }
    ]


def search_indeed(query: str, location: str, filters: str = "") -> list[dict]:
    """
    Busca vagas no Indeed via Playwright MCP.
    """
    logger.info(f"Buscando '{query}' no Indeed em '{location}'")
    _check_rate_limit("indeed")

    logger.info("Indeed search: aguardando Playwright MCP...")
    return [
        {
            "id": "",
            "title": f"{query} - Desenvolvedor Full Stack",
            "company": "Inovação Digital Ltda",
            "location": location or "Remoto",
            "description": f"Buscamos {query} para integrar time de produto...",
            "url": "https://www.indeed.com/viewjob/345678",
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "platform": "indeed",
            "found_at": datetime.now(timezone.utc).isoformat(),
        }
    ]


def search_monster(query: str, location: str, filters: str = "") -> list[dict]:
    """
    Busca vagas no Monster via Playwright MCP.
    """
    logger.info(f"Buscando '{query}' no Monster em '{location}'")
    _check_rate_limit("monster")

    logger.info("Monster search: aguardando Playwright MCP...")
    return [
        {
            "id": "",
            "title": f"Senior {query}",
            "company": "Global Tech Corp",
            "location": location or "São Paulo, Brazil",
            "description": f"Posição para {query} sênior com experiência em arquitetura de sistemas...",
            "url": "https://www.monster.com/job/901234",
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "platform": "monster",
            "found_at": datetime.now(timezone.utc).isoformat(),
        }
    ]


def search_all_platforms(query: str, location: str, filters: str = "") -> list[list[dict]]:
    """
    Executa busca em todas as plataformas configuradas.

    Retorna lista de listas (uma sub-lista por plataforma).
    """
    results = []
    results.append(search_linkedin(query, location, filters))

    # Plataformas não-autenticadas via Playwright
    for platform_name in ["glassdoor", "indeed", "monster"]:
        if PLATFORMS.get(platform_name, {}).get("mcp") == "playwright":
            search_fn = globals().get(f"search_{platform_name}")
            if search_fn:
                results.append(search_fn(query, location, filters))

    return results


def consolidate_results(results_list: list[list[dict]]) -> list[dict]:
    """
    Consolida resultados de múltiplas plataformas em lista única.

    - Achata lista de listas
    - Remove duplicatas (mesma empresa + mesmo título)
    - Adiciona IDs únicos
    - Ordena por data (mais recente primeiro)
    """
    seen = set()
    consolidated = []
    index = 0

    for platform_results in results_list:
        for job in platform_results:
            key = (job.get("company", "").lower(), job.get("title", "").lower())
            if key not in seen:
                seen.add(key)
                index += 1
                job["id"] = _make_job_id(job["platform"], index)
                if not job.get("found_at"):
                    job["found_at"] = datetime.now(timezone.utc).isoformat()
                consolidated.append(job)

    # Ordena por data (mais recente primeiro)
    consolidated.sort(key=lambda j: j.get("date", ""), reverse=True)

    return consolidated
