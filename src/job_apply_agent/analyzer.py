"""
Módulo de Análise de Compatibilidade e Match Score (REQ-003).

Calcula score de compatibilidade (0-100%) entre perfil do candidato e vagas,
usando Ollama como LLM padrão com fallback heurístico.
"""
import json
import logging
import re
from typing import Optional

import httpx

from src.job_apply_agent.config import OLLAMA_URL, OLLAMA_MODEL

logger = logging.getLogger(__name__)

# Keywords técnicas comuns para fallback heurístico
COMMON_TECH_KEYWORDS = [
    "react", "node", "python", "java", "typescript", "javascript",
    "aws", "docker", "kubernetes", "gcp", "azure", "terraform",
    "sql", "postgresql", "mongodb", "redis", "elasticsearch",
    "graphql", "rest", "grpc", "kafka", "rabbitmq",
    "ci/cd", "jenkins", "github actions", "gitlab",
    "vue", "angular", "nextjs", "nest", "fastify", "express",
    "machine learning", "ai", "data science", "nlp",
    "agile", "scrum", "kanban", "tdd", "ddd",
]


def _call_ollama(prompt: str) -> Optional[str]:
    """Chama Ollama com um prompt e retorna a resposta."""
    try:
        response = httpx.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 1024},
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json().get("response", "")
    except (httpx.HTTPError, httpx.TimeoutException, json.JSONDecodeError) as e:
        logger.warning(f"Ollama indisponível: {e}")
        return None


def _extract_skills_heuristic(text: str) -> list[str]:
    """Extrai skills de um texto usando correspondência de keywords."""
    text_lower = text.lower()
    found = set()
    for kw in COMMON_TECH_KEYWORDS:
        if kw in text_lower:
            found.add(kw.title())
    return sorted(found)


def extract_requirements(job_description: str) -> dict:
    """
    Extrai requisitos de uma descrição de vaga.

    Usa Ollama por padrão; fallback para extração heurística.
    """
    prompt = f"""Analise a descrição de vaga abaixo e extraia:
1. tech_skills: lista de habilidades técnicas OBRIGATÓRIAS
2. nice_to_have: lista de habilidades DESEJÁVEIS/nice-to-have
3. soft_skills: lista de soft skills mencionadas
4. seniority: nível de senioridade (junior, pleno, senior, lead, ou "não especificado")

Responda APENAS em JSON puro, sem formatação extra:
{{"tech_skills": [...], "nice_to_have": [...], "soft_skills": [...], "seniority": "..."}}

Descrição da vaga:
{job_description[:3000]}  # limita a 3000 chars
"""
    result = _call_ollama(prompt)

    if result:
        try:
            # Extrai JSON da resposta (remove ```json ... ``` se presente)
            json_str = re.sub(r"```json\s*|\s*```", "", result).strip()
            parsed = json.loads(json_str)
            return {
                "tech_skills": parsed.get("tech_skills", []),
                "nice_to_have": parsed.get("nice_to_have", []),
                "soft_skills": parsed.get("soft_skills", []),
                "seniority": parsed.get("seniority", "não especificado"),
            }
        except (json.JSONDecodeError, KeyError):
            logger.warning("Falha ao parsear resposta do Ollama, usando fallback")

    # Fallback heurístico
    skills = _extract_skills_heuristic(job_description)
    return {
        "tech_skills": skills,
        "nice_to_have": [],
        "soft_skills": [],
        "seniority": "não especificado",
    }


def _normalize_skills(skills: list[str]) -> set[str]:
    """Normaliza skills para comparação (lowercase, sem espaços extras)."""
    return {s.strip().lower() for s in skills if s.strip()}


def calculate_match_score(profile: dict, requirements: dict) -> float:
    """
    Calcula match score entre perfil e requisitos da vaga.

    Fórmula: (tech_match / total_required) * 70
             + (nice_match / total_nice) * 20
             + soft_skills_bonus * 10
    """
    profile_skills = _normalize_skills(profile.get("skills", []))
    req_tech = _normalize_skills(requirements.get("tech_skills", []))
    req_nice = _normalize_skills(requirements.get("nice_to_have", []))
    req_soft = _normalize_skills(requirements.get("soft_skills", []))

    total_required = len(req_tech)
    total_nice = len(req_nice)

    if total_required == 0:
        return 0.0

    tech_match = len(req_tech & profile_skills)
    nice_match = len(req_nice & profile_skills)

    score = (tech_match / total_required) * 70.0

    if total_nice > 0:
        score += (nice_match / total_nice) * 20.0

    # Bônus soft skills
    if req_soft:
        soft_match = len(req_soft & profile_skills)
        score += (soft_match / len(req_soft)) * 10.0

    return round(min(score, 100.0), 1)


def identify_gaps(profile: dict, requirements: dict) -> list[str]:
    """Identifica skills obrigatórias que o candidato não possui."""
    profile_skills = _normalize_skills(profile.get("skills", []))
    req_tech = _normalize_skills(requirements.get("tech_skills", []))
    return sorted(req_tech - profile_skills)


def identify_strengths(profile: dict, requirements: dict) -> list[str]:
    """Identifica skills obrigatórias que o candidato possui."""
    profile_skills = _normalize_skills(profile.get("skills", []))
    req_tech = _normalize_skills(requirements.get("tech_skills", []))
    return sorted(req_tech & profile_skills)


def rank_jobs(jobs_with_scores: list[dict]) -> list[dict]:
    """
    Ordena vagas por score descendente e adiciona metadados.

    Adiciona campos: rank, label (alta/média/baixa).
    """
    sorted_jobs = sorted(jobs_with_scores, key=lambda j: j.get("score", 0), reverse=True)

    for i, job in enumerate(sorted_jobs, 1):
        job["rank"] = i
        score = job.get("score", 0)
        if score >= 80:
            job["label"] = "alta"
        elif score >= 40:
            job["label"] = "média"
        else:
            job["label"] = "baixa"

    return sorted_jobs


def analyze_jobs(profile: dict, jobs: list[dict], job_id: Optional[str] = None) -> list[dict]:
    """
    Analisa compatibilidade do perfil contra uma ou mais vagas.

    Args:
        profile: Perfil do candidato (profile.json)
        jobs: Lista de vagas a analisar
        job_id: Se especificado, analisa apenas esta vaga

    Returns:
        Lista de vagas enriquecidas com score, gaps, strengths, rank, label
    """
    target_jobs = [j for j in jobs if job_id is None or j.get("id") == job_id]

    if not target_jobs:
        logger.warning(f"Nenhuma vaga encontrada para análise (job_id={job_id})")
        return []

    enriched = []
    for job in target_jobs:
        requirements = extract_requirements(job.get("description", ""))
        score = calculate_match_score(profile, requirements)
        gaps = identify_gaps(profile, requirements)
        strengths = identify_strengths(profile, requirements)

        enriched.append({
            **job,
            "score": score,
            "gaps": gaps,
            "strengths": strengths,
            "requirements": requirements,
        })

    return rank_jobs(enriched)
