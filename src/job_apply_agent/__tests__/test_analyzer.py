"""
Testes básicos para o módulo analyzer (REQ-003).
"""
import pytest
from src.job_apply_agent import analyzer


class TestAnalyzer:
    """Testes para análise de compatibilidade e match score."""

    def test_extract_requirements_returns_dict(self):
        """Verifica que extract_requirements retorna dict."""
        result = analyzer.extract_requirements("Vaga para React e Node.js")
        assert isinstance(result, dict)
        assert "tech_skills" in result
        assert "seniority" in result

    def test_calculate_match_score_returns_float(self):
        """Verifica que calculate_match_score retorna float."""
        profile = {"skills": ["react", "node"]}
        requirements = {"tech_skills": ["react", "node", "python"], "nice_to_have": [], "soft_skills": []}
        result = analyzer.calculate_match_score(profile, requirements)
        assert isinstance(result, float)
        assert 0 <= result <= 100

    def test_calculate_match_score_high_match(self):
        """Verifica score alto para perfil compatível."""
        profile = {"skills": ["react", "node", "python", "aws"]}
        requirements = {"tech_skills": ["react", "node"], "nice_to_have": [], "soft_skills": []}
        result = analyzer.calculate_match_score(profile, requirements)
        assert result >= 60

    def test_calculate_match_score_zero(self):
        """Verifica score zero para perfil incompatível."""
        profile = {"skills": ["react"]}
        requirements = {"tech_skills": ["java", "kubernetes"], "nice_to_have": [], "soft_skills": []}
        result = analyzer.calculate_match_score(profile, requirements)
        assert result == 0.0

    def test_identify_gaps_returns_list(self):
        """Verifica que identify_gaps retorna lista."""
        profile = {"skills": ["react"]}
        requirements = {"tech_skills": ["react", "node", "python"], "nice_to_have": [], "soft_skills": []}
        result = analyzer.identify_gaps(profile, requirements)
        assert isinstance(result, list)
        assert "node" in result
        assert "python" in result

    def test_identify_strengths_returns_list(self):
        """Verifica que identify_strengths retorna lista."""
        profile = {"skills": ["react", "node"]}
        requirements = {"tech_skills": ["react", "node", "python"], "nice_to_have": [], "soft_skills": []}
        result = analyzer.identify_strengths(profile, requirements)
        assert isinstance(result, list)
        assert "react" in result
        assert "node" in result

    def test_rank_jobs_adds_rank_and_label(self):
        """Verifica que rank_jobs adiciona rank e label."""
        jobs = [
            {"id": "1", "score": 50},
            {"id": "2", "score": 90},
            {"id": "3", "score": 30},
        ]
        result = analyzer.rank_jobs(jobs)
        assert result[0]["rank"] == 1
        assert result[0]["label"] == "alta"
        assert result[2]["label"] == "baixa"

    def test_analyze_jobs_returns_enriched_jobs(self):
        """Verifica que analyze_jobs retorna vagas enriquecidas."""
        profile = {"skills": ["react", "python"]}
        jobs = [
            {"id": "1", "title": "Dev React", "company": "A", "description": "Vaga para React e Python", "url": "", "platform": "linkedin"}
        ]
        result = analyzer.analyze_jobs(profile, jobs)
        assert len(result) == 1
        assert "score" in result[0]
        assert "gaps" in result[0]
        assert "strengths" in result[0]