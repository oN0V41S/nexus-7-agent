"""
Testes básicos para o módulo generator (REQ-005).
"""
import pytest
from pathlib import Path
from src.job_apply_agent import generator


class TestGenerator:
    """Testes para geração contextualizada de currículo e carta."""

    def test_generate_adapted_resume_returns_dict(self, tmp_path):
        """Verifica que generate_adapted_resume retorna dict com docx_path e md_path."""
        profile = {
            "name": "João Silva",
            "skills": ["React", "Node"],
            "experience": "Desenvolvedor Full Stack na Empresa X (2020 - 2022): React, Node",
        }
        job = {
            "title": "Desenvolvedor React",
            "company": "Tech Corp",
            "description": "Vaga para React e Node.js",
            "strengths": ["React"],
            "gaps": ["Node"],
        }
        result = generator.generate_adapted_resume(profile, job, tmp_path)
        assert isinstance(result, dict)
        assert "docx_path" in result
        assert "md_path" in result
        assert Path(result["docx_path"]).exists()
        assert Path(result["docx_path"]).suffix == ".docx"
        assert Path(result["md_path"]).exists()
        assert Path(result["md_path"]).suffix == ".md"

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
        assert result.name == "cover_letter.txt"

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

    def test_smart_summary_differentiates_jobs(self):
        """Verifica que _build_smart_summary gera resumos DIFERENTES para vagas diferentes."""
        from src.job_apply_agent.generator import _build_smart_summary
        profile = {
            "name": "Rafael",
            "skills": ["Java", "Python", "AWS", "Docker", "Kubernetes", "Power BI", "SQL"],
            "summary": "Desenvolvedor Backend com Java e AWS. Background em infraestrutura Linux.",
        }
        job_infra = {
            "title": "Analista de Infraestrutura",
            "strengths": ["aws", "docker", "kubernetes", "linux"],
            "gaps": [],
        }
        job_bi = {
            "title": "Analista de BI",
            "strengths": ["python", "sql"],
            "gaps": ["ai"],
        }
        summary_infra = _build_smart_summary(profile, job_infra)
        summary_bi = _build_smart_summary(profile, job_bi)
        # Resumos devem ser diferentes
        assert summary_infra != summary_bi
        # Resumo de infra deve mencionar infraestrutura
        assert "infraestrutura" in summary_infra.lower() or "linux" in summary_infra.lower()
        # Resumo de BI deve mencionar dados/analytics
        assert "dados" in summary_bi.lower() or "analytics" in summary_bi.lower() or "python" in summary_bi.lower()

    def test_resume_markdown_includes_all_profile_data(self):
        """Verifica que _build_resume_markdown inclui TODO o conteúdo do perfil."""
        from src.job_apply_agent.generator import _build_resume_markdown
        from src.job_apply_agent.consolidator import normalize_text
        profile = {
            "name": "Rafael Augusto Nascimento Novais",
            "email": "rafael@email.com",
            "phone": "(11) 99831-7761",
            "location": "São Paulo, SP",
            "github": "https://github.com/oN0V41S",
            "linkedin": "https://linkedin.com/in/rafaelnovais042",
            "languages": "Inglês Intermediário, Espanhol Básico",
            "skills": ["Java", "Python", "AWS", "Docker", "Kubernetes", "CI/CD"],
            "experience_raw": (
                "Analista de Dados Júnior na Zyon Tech (Dez 2024 - Atual)\n"
                "• ETL com Python e MySQL\n"
                "• Dashboards em Power BI e Tableau\n\n"
                "Desenvolvedor Full Stack no Projeto Olho Mágico (Jul 2024 - Dez 2024)\n"
                "• APIs RESTful com Node.js/Express\n"
                "• Implementação de microsserviços\n\n"
                "Suporte de Infraestrutura no SERPRO (Jul 2022 - Out 2023)\n"
                "• Servidores Linux\n"
                "• Redes e hardware"
            ),
            "experience": normalize_text(
                "Analista de Dados Júnior na Zyon Tech (Dez 2024 - Atual): "
                "ETL com Python e MySQL, Dashboards Power BI e Tableau. "
                "Desenvolvedor Full Stack no Projeto Olho Mágico (Jul 2024 - Dez 2024): "
                "APIs RESTful com Node.js/Express, Microsserviços, MySQL."
            ),
            "education": "Tecnólogo em ADS na UNISA (Conclusão Dez 2026). Técnico em DS no SENAI (Concluído Dez 2024).",
            "certifications": ["Network Essentials | Cisco", "LGPD | SENAI"],
            "projects": [
                {"name": "Microsserviços", "description": "NestJS + API Gateway", "link": "https://github.com/oN0V41S/nestjs-microservices"},
            ],
            "summary": "Desenvolvedor Backend com Java e AWS.",
        }
        job = {
            "title": "Analista de Infraestrutura",
            "company": "Mazzatech",
            "description": "Vaga para infraestrutura Linux",
            "strengths": ["aws", "docker", "kubernetes", "linux"],
            "gaps": [],
        }

        md = _build_resume_markdown(profile, job)

        # Deve conter os bullets das experiências
        assert "- ETL com Python" in md
        assert "- Dashboards em Power BI" in md
        assert "- APIs RESTful com Node.js" in md
        assert "- Servidores Linux" in md

        # Deve conter certificações
        assert "Network Essentials" in md
        assert "LGPD" in md

        # Deve conter projetos
        assert "Microsserviços" in md
        assert "NestJS" in md

        # Deve conter links
        assert "github.com/oN0V41S" in md or "GitHub" in md

        # Deve conter idiomas
        assert "Inglês Intermediário" in md

        # Deve ter resumo adaptado (diferente do summary genérico)
        assert "infraestrutura" in md.lower() or "linux" in md.lower()

    def test_validate_resume_detects_missing_content(self):
        """Verifica que validate_resume_completeness detecta campos ausentes."""
        from src.job_apply_agent.generator import validate_resume_completeness
        profile = {
            "skills": ["Java", "Python", "Kubernetes"],
            "projects": [{"name": "API Gateway", "description": "Microsserviços"}],
            "certifications": ["AWS Certified"],
            "languages": "Inglês Fluente",
        }
        md_incomplete = "# Nome\n\n## Resumo\nSem skills, sem projetos, sem certs"
        warnings = validate_resume_completeness(md_incomplete, profile)
        assert len(warnings) > 0
        assert any("Skill" in w for w in warnings)
