"""
Testes básicos para o módulo config (REQ-001).
"""
import pytest
from src.job_apply_agent import config


class TestConfig:
    """Testes para configurações do Job Application Workflow."""

    def test_profile_dir_exists(self):
        """Verifica que o diretório de perfil foi criado."""
        assert config.PROFILE_DIR.exists()

    def test_searches_dir_exists(self):
        """Verifica que o diretório de buscas foi criado."""
        assert config.SEARCHES_DIR.exists()

    def test_chrome_debug_port(self):
        """Verifica porta de debug do Chrome."""
        assert config.CHROME_DEBUG_PORT == 9222

    def test_ollama_url_default(self):
        """Verifica URL padrão do Ollama."""
        assert config.OLLAMA_URL == "http://localhost:11434"

    def test_platforms_config(self):
        """Verifica configuração das plataformas."""
        assert "linkedin" in config.PLATFORMS
        assert config.PLATFORMS["linkedin"]["auth"] is True
        assert config.PLATFORMS["linkedin"]["mcp"] == "chrome"

    def test_load_profile_returns_none_when_not_exists(self):
        """Verifica que load_profile retorna None quando não existe."""
        # profile.json não existe ainda, deve retornar None
        result = config.load_profile()
        assert result is None

    def test_load_applied_returns_empty_list_when_not_exists(self):
        """Verifica que load_applied retorna lista vazia quando não existe."""
        result = config.load_applied()
        assert result == []