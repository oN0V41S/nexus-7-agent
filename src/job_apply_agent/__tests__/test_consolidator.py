"""
Testes básicos para o módulo consolidator (REQ-004).
"""
import pytest
from pathlib import Path
from src.job_apply_agent import consolidator


class TestConsolidator:
    """Testes para consolidação de currículos PDF → DOCX ATS."""

    def test_normalize_text(self):
        """Verifica normalização de texto."""
        result = consolidator.normalize_text("  Hello   World  ")
        assert result == "Hello World"

    def test_parse_resume_sections_returns_dict(self):
        """Verifica que parse_resume_sections retorna dict."""
        text = "Experiência\nDesenvolvedor\n\nSkills\nReact, Node"
        result = consolidator.parse_resume_sections(text)
        assert isinstance(result, dict)
        assert "experiência" in result

    def test_build_profile_from_sections(self):
        """Verifica construção de perfil a partir de seções."""
        sections = {
            "skills": "React Node Python",
            "experience": "Desenvolvedor Full Stack",
            "education": "Ciência da Computação",
            "summary": "Profissional dedicado",
        }
        result = consolidator.build_profile_from_sections(sections)
        assert isinstance(result, dict)
        assert "skills" in result
        assert "experience" in result

    def test_merge_profiles(self):
        """Verifica merge de múltiplos perfis."""
        profiles = [
            {"skills": ["React"], "experience": "Job A"},
            {"skills": ["Node"], "experience": "Job B"},
        ]
        result = consolidator.merge_profiles(profiles)
        assert "React" in result["skills"]
        assert "Node" in result["skills"]

    def test_extract_text_from_pdf_raises_on_missing_file(self):
        """Verifica que extract_text_from_pdf levanta erro para arquivo inexistente."""
        with pytest.raises(FileNotFoundError):
            consolidator.extract_text_from_pdf(Path("/nonexistent.pdf"))

    def test_generate_ats_docx_creates_file(self, tmp_path):
        """Verifica geração de DOCX ATS."""
        profile = {
            "name": "João Silva",
            "skills": ["Python", "React"],
            "experience": "Desenvolvedor Full Stack",
            "education": "Ciência da Computação",
        }
        output_path = tmp_path / "test.docx"
        result = consolidator.generate_ats_docx(profile, output_path)
        assert result.exists()
        assert result.name == "test.docx"