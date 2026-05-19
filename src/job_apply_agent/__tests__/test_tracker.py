"""
Testes básicos para o módulo tracker (REQ-008).
"""
import pytest
import json
import os
import tempfile
from pathlib import Path
from src.job_apply_agent import tracker


class TestTracker:
    """Testes para rastreamento e relatório de candidaturas."""

    def test_list_applications_returns_list(self):
        """Verifica que list_applications retorna lista."""
        # Usa diretório temporário do sistema
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["TEST_APPLIED_LOG"] = str(Path(tmpdir) / "applied.jsonl")
            result = tracker.list_applications()
            assert isinstance(result, list)

    def test_list_skipped_returns_list(self):
        """Verifica que list_skipped retorna lista."""
        result = tracker.list_skipped()
        assert isinstance(result, list)

    def test_update_status_returns_true(self):
        """Verifica que update_status retorna True para atualização bem-sucedida."""
        # Cria arquivo no diretório real do config
        from src.job_apply_agent import config
        original = config.APPLIED_LOG
        
        # Backup e cria arquivo de teste
        backup_content = config.APPLIED_LOG.read_text() if config.APPLIED_LOG.exists() else ""
        config.APPLIED_LOG.write_text('{"id": "job-001", "company": "A", "title": "Dev", "status": "applied", "date": "2026-05-19", "timestamp": "2026-05-19T00:00:00Z"}\n')
        
        try:
            result = tracker.update_status("job-001", "interview")
            assert result is True
        finally:
            # Restaura conteúdo original
            if backup_content:
                config.APPLIED_LOG.write_text(backup_content)
            elif config.APPLIED_LOG.exists():
                config.APPLIED_LOG.unlink()

    def test_update_status_returns_false_for_invalid_status(self):
        """Verifica que update_status retorna False para status inválido."""
        result = tracker.update_status("job-001", "invalid_status")
        assert result is False

    def test_export_csv_creates_file(self):
        """Verifica que export_csv cria arquivo."""
        from src.job_apply_agent import config
        original = config.APPLIED_LOG
        
        # Backup e cria arquivo de teste
        backup_content = config.APPLIED_LOG.read_text() if config.APPLIED_LOG.exists() else ""
        config.APPLIED_LOG.write_text('{"id": "job-001", "company": "A", "title": "Dev", "url": "", "platform": "linkedin", "score": 80, "status": "applied", "date": "2026-05-19", "timestamp": "2026-05-19T00:00:00Z"}\n')
        
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                output_path = Path(tmpdir) / "export.csv"
                result = tracker.export_csv(output_path)
                assert result.exists()
        finally:
            # Restaura conteúdo original
            if backup_content:
                config.APPLIED_LOG.write_text(backup_content)
            elif config.APPLIED_LOG.exists():
                config.APPLIED_LOG.unlink()

    def test_export_json_creates_file(self):
        """Verifica que export_json cria arquivo."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "export.json"
            result = tracker.export_json(output_path)
            assert result.exists()

    def test_get_stats_returns_dict(self):
        """Verifica que get_stats retorna dict."""
        result = tracker.get_stats()
        assert isinstance(result, dict)
        assert "total_applications" in result

    def test_valid_statuses(self):
        """Verifica status válidos."""
        assert "applied" in tracker.VALID_STATUSES
        assert "interview" in tracker.VALID_STATUSES
        assert "rejected" in tracker.VALID_STATUSES