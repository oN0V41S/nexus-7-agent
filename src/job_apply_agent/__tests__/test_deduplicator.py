"""
Testes básicos para o módulo deduplicator (REQ-007).
"""
import pytest
from src.job_apply_agent import deduplicator


class TestDeduplicator:
    """Testes para desduplicação de candidaturas."""

    def test_normalize(self):
        """Verifica normalização de texto."""
        result = deduplicator._normalize("  Hello World  ")
        assert result == "hello world"

    def test_company_variations(self):
        """Verifica geração de variações de nome de empresa."""
        result = deduplicator._company_variations("Tech Ltda")
        assert "tech ltda" in result
        assert "tech" in result

    def test_check_duplicate_local_returns_false_for_new(self):
        """Verifica que check_duplicate_local retorna False para vaga nova."""
        result = deduplicator.check_duplicate_local("Empresa Nova", "Vaga Nova")
        assert result is False

    def test_check_duplicate_local_returns_true_for_existing(self, tmp_path, monkeypatch):
        """Verifica que check_duplicate_local retorna True para duplicata."""
        # Cria arquivo applied.jsonl temporário
        from src.job_apply_agent import config
        monkeypatch.setattr(config, "APPLIED_LOG", tmp_path / "applied.jsonl")
        
        # Registra uma candidatura
        from src.job_apply_agent.config import append_applied
        append_applied({"company": "Tech Corp", "title": "Dev"})
        
        # Verifica duplicata
        result = deduplicator.check_duplicate_local("Tech Corp", "Dev")
        assert result is True

    def test_check_duplicate_local_fuzzy_match(self, tmp_path, monkeypatch):
        """Verifica matching fuzzy para nomes de empresa."""
        from src.job_apply_agent import config
        monkeypatch.setattr(config, "APPLIED_LOG", tmp_path / "applied.jsonl")
        
        from src.job_apply_agent.config import append_applied
        append_applied({"company": "Tech Corp", "title": "Dev"})
        
        # Deve detectar como duplicata (variação de nome)
        result = deduplicator.check_duplicate_local("Tech Corp Ltda", "Dev")
        assert result is True

    def test_mark_as_applied(self, tmp_path, monkeypatch):
        """Verifica marcação de vaga como aplicada."""
        from src.job_apply_agent import config
        monkeypatch.setattr(config, "APPLIED_LOG", tmp_path / "applied.jsonl")
        
        deduplicator.mark_as_applied("Empresa X", "Vaga Y", {"score": 85})
        
        # Verifica que foi registrada
        result = deduplicator.check_duplicate_local("Empresa X", "Vaga Y")
        assert result is True