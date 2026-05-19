"""
Testes básicos para o módulo search (REQ-002).
"""
import pytest
from src.job_apply_agent import search


class TestSearch:
    """Testes para busca multi-plataforma."""

    def test_search_linkedin_returns_list(self):
        """Verifica que search_linkedin retorna lista de vagas."""
        result = search.search_linkedin("Frontend", "São Paulo")
        assert isinstance(result, list)
        assert len(result) > 0
        assert result[0]["platform"] == "linkedin"

    def test_search_glassdoor_returns_list(self):
        """Verifica que search_glassdoor retorna lista de vagas."""
        result = search.search_glassdoor("Backend", "São Paulo")
        assert isinstance(result, list)
        assert len(result) > 0
        assert result[0]["platform"] == "glassdoor"

    def test_search_indeed_returns_list(self):
        """Verifica que search_indeed retorna lista de vagas."""
        result = search.search_indeed("Full Stack", "Remoto")
        assert isinstance(result, list)
        assert len(result) > 0
        assert result[0]["platform"] == "indeed"

    def test_search_monster_returns_list(self):
        """Verifica que search_monster retorna lista de vagas."""
        result = search.search_monster("DevOps", "São Paulo")
        assert isinstance(result, list)
        assert len(result) > 0
        assert result[0]["platform"] == "monster"

    def test_consolidate_results_removes_duplicates(self):
        """Verifica que consolidate_results remove duplicatas."""
        jobs = [
            [{"company": "Tech", "title": "Dev", "platform": "linkedin"}],
            [{"company": "Tech", "title": "Dev", "platform": "glassdoor"}],
        ]
        result = search.consolidate_results(jobs)
        assert len(result) == 1

    def test_consolidate_results_adds_ids(self):
        """Verifica que consolidate_results adiciona IDs únicos."""
        jobs = [
            [{"company": "A", "title": "Dev", "platform": "linkedin"}],
            [{"company": "B", "title": "Dev", "platform": "glassdoor"}],
        ]
        result = search.consolidate_results(jobs)
        assert all(job.get("id") for job in result)

    def test_make_job_id_format(self):
        """Verifica formato do ID de vaga."""
        job_id = search._make_job_id("linkedin", 1)
        assert job_id.startswith("li-")
        assert "0001" in job_id