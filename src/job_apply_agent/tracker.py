"""
Módulo de Rastreamento de Candidaturas.

Gerencia o histórico completo de candidaturas: listagem, exportação,
atualização de status e integração com Notion.
"""
import csv
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from src.job_apply_agent.config import APPLIED_LOG, SKIPPED_LOG
from src.job_apply_agent.deduplicator import append_applied

logger = logging.getLogger(__name__)

# Notion integration
try:
    import requests
    NOTION_AVAILABLE = True
except ImportError:
    NOTION_AVAILABLE = False
    logger.warning("requests library not available, Notion integration disabled")

# Notion configuration
NOTION_DATABASE_ID = "3893da06f613801089af000c1fd7e1c1"
NOTION_KB_PAGE_ID = "3893da06f61380e18013cc35db16fa2c"

# Status válidos
VALID_STATUSES = {
    "applied", "reviewing", "interview", "offer", "rejected",
    "accepted", "ghosted", "withdrawn",
}


# ─── Leitura ─────────────────────────────────────────────────────────────────


def list_applications(status: Optional[str] = None) -> list[dict]:
    """
    Lista todas as candidaturas registradas.

    Args:
        status: Filtro opcional por status

    Returns:
        Lista de entradas ordenadas por data (mais recente primeiro)
    """
    apps = _load_applied()
    if status:
        apps = [a for a in apps if a.get("status") == status]
    apps.sort(key=lambda a: a.get("date", ""), reverse=True)
    return apps


def list_skipped() -> list[dict]:
    """Lista candidaturas que foram puladas."""
    skipped = []
    if SKIPPED_LOG.exists():
        for line in SKIPPED_LOG.read_text().splitlines():
            if line.strip():
                try:
                    skipped.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return skipped


def _load_applied() -> list[dict]:
    """Carrega todas as entradas de applied.jsonl."""
    apps = []
    if APPLIED_LOG.exists():
        for line in APPLIED_LOG.read_text().splitlines():
            if line.strip():
                try:
                    apps.append(json.loads(line))
                except json.JSONDecodeError:
                    logger.warning(f"Linha inválida no applied.jsonl: {line[:50]}")
                    continue
    return apps


# ─── Atualização ─────────────────────────────────────────────────────────────


def update_status(job_id: str, new_status: str) -> bool:
    """
    Atualiza o status de uma candidatura.

    Args:
        job_id: ID da candidatura
        new_status: Novo status (applied, reviewing, interview, offer, rejected, etc.)

    Returns:
        True se atualizado, False se não encontrado.
    """
    new_status = new_status.lower()
    if new_status not in VALID_STATUSES:
        valid = ", ".join(sorted(VALID_STATUSES))
        logger.error(f"Status inválido: '{new_status}'. Válidos: {valid}")
        return False

    apps = _load_applied()
    updated = False

    for app in apps:
        if app.get("id") == job_id:
            app["status"] = new_status
            app["updated_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"Status atualizado: {job_id} → {new_status}")
            updated = True
            break

    if updated:
        _rewrite_applied_log(apps)

    return updated


def _rewrite_applied_log(apps: list[dict]) -> None:
    """Reescreve o arquivo applied.jsonl com a lista fornecida."""
    with open(APPLIED_LOG, "w") as f:
        for app in apps:
            f.write(json.dumps(app, ensure_ascii=False) + "\n")


def save_to_notion(app_data: dict, notion_token: str, database_id: str) -> bool:
    """
    Salva uma candidatura no Notion.

    Args:
        app_data: Dados da candidatura a serem salvos
        notion_token: Token de acesso do Notion
        database_id: ID do banco de dados do Notion

    Returns:
        True se salvo com sucesso, False caso contrário
    """
    if not NOTION_AVAILABLE:
        logger.warning("Notion integration not available (requests library missing)")
        return False

    try:
        # Preparar propriedades para o Notion
        properties = {
            "Nome da Vaga": {
                "title": [{"text": {"content": app_data.get("title", "")}}]
            },
            "Empresa": {
                "rich_text": [{"text": {"content": app_data.get("company", "")}}]
            },
            "Nível": {
                "select": {"name": app_data.get("level", "")}
            },
            "Área": {
                "select": {"name": app_data.get("area", "")}
            },
            "Plataforma": {
                "rich_text": [{"text": {"content": app_data.get("platform", "")}}]
            },
            "Link": {
                "url": app_data.get("url", "")
            },
            "Data": {
                "date": {"start": app_data.get("date", "")}
            },
            "Score": {
                "number": app_data.get("score", 0)
            },
            "Status": {
                "select": {"name": app_data.get("status", "")}
            },
        }

        # Remover propriedades vazias
        properties = {k: v for k, v in properties.items() if v}

        # Enviar para Notion
        response = requests.post(
            "https://api.notion.com/v1/pages",
            headers={
                "Authorization": f"Bearer {notion_token}",
                "Content-Type": "application/json",
                "Notion-Version": "2022-06-28",
            },
            json={
                "parent": {"database_id": database_id},
                "properties": properties,
            },
        )

        if response.status_code == 200:
            logger.info(f"Candidatura salva no Notion: {app_data.get('title', '')}")
            return True
        else:
            logger.error(f"Erro ao salvar no Notion: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        logger.error(f"Exceção ao salvar no Notion: {str(e)}")
        return False


# ─── Exportação ──────────────────────────────────────────────────────────────


def export_csv(output_path: Path) -> Path:
    """Exporta candidaturas para CSV."""
    apps = _load_applied()
    if not apps:
        logger.warning("Nenhuma candidatura para exportar.")
        return output_path

    fieldnames = [
        "id", "company", "title", "url", "platform", "score",
        "status", "date", "timestamp",
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(apps)

    logger.info(f"Exportado CSV: {output_path} ({len(apps)} candidaturas)")
    return output_path


def export_json(output_path: Path) -> Path:
    """Exporta candidaturas para JSON."""
    apps = _load_applied()
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(apps, f, indent=2, ensure_ascii=False)
    logger.info(f"Exportado JSON: {output_path} ({len(apps)} candidaturas)")
    return output_path


# ─── Estatísticas ────────────────────────────────────────────────────────────


def get_stats() -> dict:
    """Retorna estatísticas resumidas das candidaturas."""
    apps = _load_applied()
    skipped = list_skipped()

    status_counts: dict[str, int] = {}
    for app in apps:
        s = app.get("status", "applied")
        status_counts[s] = status_counts.get(s, 0) + 1

    # Empresas únicas
    companies = set(a.get("company", "").lower() for a in apps if a.get("company"))

    return {
        "total_applications": len(apps),
        "total_skipped": len(skipped),
        "unique_companies": len(companies),
        "status_counts": status_counts,
        "last_application": apps[0] if apps else None,
    }
