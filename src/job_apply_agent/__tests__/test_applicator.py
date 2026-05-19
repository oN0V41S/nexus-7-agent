"""
Testes básicos para o módulo applicator (REQ-006).
"""
import pytest
from src.job_apply_agent import applicator


class TestApplicator:
    """Testes para aplicação semiautomática com aprovação humana."""

    def test_voice_lint_profile_returns_list(self):
        """Verifica que voice_lint_profile retorna lista."""
        profile = {"skills": [], "experience": ""}
        result = applicator.voice_lint_profile(profile)
        assert isinstance(result, list)

    def test_voice_lint_profile_warns_empty_skills(self):
        """Verifica aviso para perfil sem skills."""
        profile = {"skills": [], "experience": "Job"}
        result = applicator.voice_lint_profile(profile)
        assert any("habilidades" in w.lower() for w in result)

    def test_voice_lint_profile_warns_empty_experience(self):
        """Verifica aviso para perfil sem experiência."""
        profile = {"skills": ["React"], "experience": ""}
        result = applicator.voice_lint_profile(profile)
        assert any("experiência" in w.lower() for w in result)

    def test_voice_lint_profile_no_warnings_for_complete(self):
        """Verifica que perfil completo não tem avisos."""
        profile = {
            "skills": ["React"],
            "experience": "Desenvolvedor",
            "email": "test@test.com",
            "phone": "11999999999",
        }
        result = applicator.voice_lint_profile(profile)
        assert len(result) == 0

    def test_get_job_url_returns_url(self):
        """Verifica que _get_job_url retorna URL."""
        job = {"url": "https://example.com/job"}
        result = applicator._get_job_url(job)
        assert result == "https://example.com/job"

    def test_get_job_url_returns_none_for_empty(self):
        """Verifica que _get_job_url retorna None para URL vazia."""
        job = {}
        result = applicator._get_job_url(job)
        assert result is None

    def test_get_platform_navigation_hint_linkedin(self):
        """Verifica dica de navegação para LinkedIn."""
        job = {"platform": "linkedin"}
        result = applicator._get_platform_navigation_hint(job)
        assert result["mcp"] == "chrome"
        assert "steps" in result

    def test_get_platform_navigation_hint_glassdoor(self):
        """Verifica dica de navegação para Glassdoor."""
        job = {"platform": "glassdoor"}
        result = applicator._get_platform_navigation_hint(job)
        assert result["mcp"] == "playwright"
        assert "steps" in result