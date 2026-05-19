"""
Testes básicos para o módulo generator (REQ-005).
"""
import pytest
from pathlib import Path
from src.job_apply_agent import generator


class TestGenerator:
    """Testes para geração contextualizada de currículo e carta."""

    def test_generate_adapted_resume_returns_path(self, tmp_path):
        """Verifica que generate_adapted_resume retorna Path."""
        profile = {
            "name": "João Silva",
            "skills": ["React", "Node"],
            "experience": "Desenvolvedor Full Stack",
        }
        job = {
            "title": "Desenvolvedor React",
            "company": "Tech Corp",
            "description": "Vaga para React e Node.js",
            "strengths": ["React"],
            "gaps": ["Node"],
        }
        result = generator.generate_adapted_resume(profile, job, tmp_path)
        assert isinstance(result, Path)
        assert result.name == "resume_adapted.pdf"

    def test_generate_cover_letter_returns_path(self, tmp_path):
        """Verifica que generate_cover_letter retorna Path."""
        profile = {
            "name": "João Silva",
            "email": "joao@email.com",
            "phone": "11999999999",
            "location": "São Paulo",
            "skills": ["React", "Node"],
        }
        job = {
            "title": "Desenvolvedor React",
            "company": "Tech Corp",
            "location": "São Paulo",
            "strengths": ["React"],
        }
        result = generator.generate_cover_letter(profile, job, tmp_path)
        assert isinstance(result, Path)
        assert result.name == "cover_letter.pdf"

    def test_generate_application_returns_dict(self, tmp_path):
        """Verifica que generate_application retorna dict."""
        profile = {
            "name": "João Silva",
            "email": "joao@email.com",
            "phone": "11999999999",
            "location": "São Paulo",
            "skills": ["React", "Node"],
            "experience": "Desenvolvedor",
        }
        job = {
            "title": "Desenvolvedor React",
            "company": "Tech Corp",
            "description": "Vaga para React",
            "strengths": ["React"],
            "gaps": [],
        }
        result = generator.generate_application(profile, job, tmp_path)
        assert isinstance(result, dict)
        assert "resume_path" in result
        assert "cover_letter_path" in result

    def test_cover_letter_template_exists(self):
        """Verifica que template de carta existe."""
        assert generator.COVER_LETTER_TEMPLATE is not None
        assert "{candidate_name}" in generator.COVER_LETTER_TEMPLATE