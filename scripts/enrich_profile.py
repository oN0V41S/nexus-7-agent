#!/usr/bin/env python3
"""
Enriquece profile.json com dados completos da KB.md.

Uso:
    python scripts/enrich_profile.py [--kb data/job-apply-agent/*-kb-*.md]

Lê a KB.md (fonte de verdade), extrai seções completas,
e atualiza profile.json APENAS adicionando os campos:
- experience_raw (preserva estrutura original)
- education_raw (preserva estrutura original)

NÃO sobrescreve experience/education já normalizados.
"""
import json
import re
import sys
from pathlib import Path

PROFILE_DIR = Path.home() / ".job-apply-agent"
PROFILE_JSON = PROFILE_DIR / "profile.json"
PROJECT_DATA = Path(__file__).resolve().parent.parent / "data" / "job-apply-agent"


def find_latest_kb() -> Path | None:
    """Encontra a KB.md mais recente em data/job-apply-agent/."""
    kb_files = sorted(PROJECT_DATA.glob("*-kb-*.md"), reverse=True)
    return kb_files[0] if kb_files else None


def parse_kb_sections(kb_path: Path) -> dict:
    """Parseia KB.md em seções com conteúdo completo preservado."""
    text = kb_path.read_text(encoding="utf-8")
    sections = {}
    current_section = "__header"
    current_content = []

    for line in text.split("\n"):
        if line.startswith("# ") and not line.startswith("## "):
            if current_content:
                sections[current_section] = "\n".join(current_content).strip()
            current_section = "__header"
            current_content = [line[2:]]
        elif line.startswith("## "):
            if current_content:
                sections[current_section] = "\n".join(current_content).strip()
            current_section = line[3:].strip().lower()
            current_content = []
        else:
            current_content.append(line)

    if current_content:
        sections[current_section] = "\n".join(current_content).strip()

    return sections


def enrich_profile(kb_path: Path | None = None) -> dict:
    """Lê KB.md, enriquece profile.json, salva de volta."""
    if not kb_path:
        kb_path = find_latest_kb()
    if not kb_path or not kb_path.exists():
        print(f"❌ KB.md não encontrada em {PROJECT_DATA}")
        sys.exit(1)

    print(f"📖 Lendo KB: {kb_path}")
    sections = parse_kb_sections(kb_path)

    if not PROFILE_JSON.exists():
        print(f"❌ profile.json não encontrado em {PROFILE_JSON}")
        sys.exit(1)

    profile = json.loads(PROFILE_JSON.read_text())
    print(f"📄 Profile atual: {len(profile)} campos")

    changes = {}

    # 1. experience_raw — APENAS adiciona se não existir
    if "experience_raw" not in profile:
        for kb_key in ["experiência profissional", "experiencia profissional"]:
            if kb_key in sections:
                content = sections[kb_key]
                profile["experience_raw"] = content
                changes["experience_raw"] = f"{len(content)} chars (estrutura original)"
                break

    # 2. education_raw — APENAS adiciona se não existir
    if "education_raw" not in profile:
        for kb_key in ["formação acadêmica", "formacao academica"]:
            if kb_key in sections:
                content = sections[kb_key]
                profile["education_raw"] = content
                changes["education_raw"] = f"{len(content)} chars (estrutura original)"
                break

    # Salva profile enriquecido
    PROFILE_JSON.write_text(json.dumps(profile, indent=2, ensure_ascii=False))
    print(f"✅ Profile enriquecido salvo: {len(profile)} campos")
    if changes:
        print("   Mudanças:")
        for k, v in sorted(changes.items()):
            print(f"   + {k}: {v}")
    else:
        print("   (nenhuma mudança necessária)")

    return profile


if __name__ == "__main__":
    kb_arg = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "--kb" else None
    kb_path = Path(kb_arg) if kb_arg and Path(kb_arg).exists() else None
    if sys.argv[1:2] == ["--kb"] and len(sys.argv) > 2:
        kb_path = Path(sys.argv[2])
    enrich_profile(kb_path)
