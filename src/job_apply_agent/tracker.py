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
