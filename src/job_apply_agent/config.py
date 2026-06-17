"""
Configuração compartilhada do Job Application Workflow.
"""
import os
import json
from pathlib import Path

# Diretórios
HOME = Path.home()
PROFILE_DIR = HOME / ".job-apply-agent"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)

# Diretório de dados do projeto (onde ficam KB, currículos adaptados, etc.)
PROJECT_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "job-apply-agent"
PROJECT_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Arquivos de estado
PROFILE_JSON = PROFILE_DIR / "profile.json"
APPLIED_LOG = PROFILE_DIR / "applied.jsonl"
SKIPPED_LOG = PROFILE_DIR / "skipped.jsonl"
SEARCHES_DIR = PROFILE_DIR / "searches"
SEARCHES_DIR.mkdir(exist_ok=True)

# Chrome isolado
CHROME_USER_DATA_DIR = "/tmp/job-profile"
CHROME_DEBUG_PORT = 9222

# Ollama (default)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

# API Keys (fallback cloud)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")

# Rate limiting
MAX_REQS_PER_MIN = int(os.getenv("JOB_MAX_REQS_PER_MIN", "10"))

# Platforms
PLATFORMS = {
    "linkedin": {"auth": True, "mcp": "chrome"},
    "glassdoor": {"auth": False, "mcp": "playwright"},
    "indeed": {"auth": False, "mcp": "playwright"},
    "monster": {"auth": False, "mcp": "playwright"},
}


def load_profile() -> dict | None:
    """Carrega o perfil do candidato do disco."""
    if PROFILE_JSON.exists():
        return json.loads(PROFILE_JSON.read_text())
    return None


def save_profile(profile: dict) -> None:
    """Salva o perfil do candidato no disco."""
    PROFILE_JSON.write_text(json.dumps(profile, indent=2, ensure_ascii=False))


def load_applied() -> list[dict]:
    """Carrega lista de candidaturas já realizadas."""
    if not APPLIED_LOG.exists():
        return []
    return [json.loads(line) for line in APPLIED_LOG.read_text().splitlines() if line]


def append_applied(entry: dict) -> None:
    """Adiciona entrada ao log de candidaturas."""
    with open(APPLIED_LOG, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def append_skipped(entry: dict) -> None:
    """Adiciona entrada ao log de candidaturas ignoradas."""
    with open(SKIPPED_LOG, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
