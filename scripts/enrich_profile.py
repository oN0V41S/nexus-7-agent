#!/usr/bin/env python3
"""
Enriquece profile.json com dados completos da KB.md.

Uso:
    python scripts/enrich_profile.py [--kb data/job-apply-agent/*-kb-*.md]

Lê a KB.md (fonte de verdade), extrai seções completas,
e atualiza profile.json com experience_raw, education_raw (preservando
campos existentes que já estão bons).
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
    for k, v in sorted(profile.items()):
        print(f"   {k}: ", end="")
        if isinstance(v, str) and len(v) > 60:
            print(f"{v[:60]}...")
        elif isinstance(v, list):
            print(f"[{len(v)} items]")
        else:
            print(f"{v}")

    changes = {}

    # 1. experience_raw — preserva conteúdo completo com bullets/quebras
    for kb_key in ["experiência profissional", "experiencia profissional"]:
        if kb_key in sections:
            content = sections[kb_key]
            profile["experience_raw"] = content
            profile["experience"] = re.sub(r"\s+", " ", content).strip()
            changes["experience_raw"] = f"{len(content)} chars (com estrutura preservada)"
            changes["experience"] = f"{len(profile['experience'])} chars (normalizado)"

    # 2. education_raw — preserva conteúdo completo
    for kb_key in ["formação acadêmica", "formacao academica"]:
        if kb_key in sections:
            content = sections[kb_key]
            profile["education_raw"] = content
            profile["education"] = re.sub(r"\s+", " ", content).strip()
            changes["education_raw"] = f"{len(content)} chars"
            changes["education"] = f"{len(profile['education'])} chars (normalizado)"

    # 3. Skills — SÓ atualiza se existente for vazio (já temos 20 skills boas)
    for kb_key in ["habilidades", "skills"]:
        if kb_key in sections and not profile.get("skills"):
            content = sections[kb_key]
            # Pula linhas de cabeçalho de categoria
            lines = content.split("\n")
            all_skills = []
            for line in lines:
                line = line.strip()
                # Pula linhas de categoria tipo "Linguagens:", "Cloud & Infra:"
                if ":" in line and len(line.split(":")[0].split()) <= 3:
                    # Extrai skills após o ":" 
                    parts = line.split(":", 1)
                    if len(parts) > 1:
                        skills_part = parts[1]
                        # Separa por vírgula
                        for s in skills_part.split(","):
                            s = s.strip().lstrip("•- ")
                            if s and not s.startswith("Idiomas"):
                                all_skills.append(s)
                else:
                    # Linha sem categoria
                    for s in line.split(","):
                        s = s.strip().lstrip("•- ")
                        if s:
                            all_skills.append(s)
            if all_skills:
                profile["skills"] = sorted(set(all_skills))
                changes["skills"] = f"{len(profile['skills'])} items"

    # 4. Certificações — parse da seção como lista
    for kb_key in ["certificações", "certificacoes"]:
        if kb_key in sections:
            content = sections[kb_key]
            certs = []
            for line in content.split("\n"):
                line = line.strip().lstrip("- •")
                if line:
                    certs.append(line)
            if certs:
                profile["certifications"] = certs
                changes["certifications"] = f"{len(certs)} items"

    # 5. Projetos — parse de blocos (preserva se já existirem bons)
    for kb_key in ["projetos", "projects"]:
        if kb_key in sections and not profile.get("projects"):
            content = sections[kb_key]
            projects = []
            current_proj = {}

            for line in content.split("\n"):
                line = line.strip().lstrip("- •")
                if not line:
                    if current_proj:
                        projects.append(current_proj)
                        current_proj = {}
                    continue
                # Linha com nome | link
                if "|" in line:
                    parts = line.split("|", 1)
                    name = parts[0].strip()
                    link_text = parts[1].strip() if len(parts) > 1 else ""
                    url_match = re.search(r'github\.com/\S+', link_text)
                    link = f"https://{url_match.group(0)}" if url_match else ""
                    current_proj = {"name": name, "description": "", "link": link}
                # Descrição em bullet points
                elif current_proj:
                    if current_proj["description"]:
                        current_proj["description"] += " "
                    current_proj["description"] += line

            if current_proj:
                projects.append(current_proj)

            if projects:
                profile["projects"] = projects
                changes["projects"] = f"{len(projects)} items"

    # Salva profile enriquecido
    PROFILE_JSON.write_text(json.dumps(profile, indent=2, ensure_ascii=False))
    print(f"\n✅ Profile enriquecido salvo: {len(profile)} campos")
    print("   Mudanças:")
    for k, v in sorted(changes.items()):
        print(f"   + {k}: {v}")

    return profile


if __name__ == "__main__":
    kb_arg = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "--kb" else None
    kb_path = Path(kb_arg) if kb_arg and Path(kb_arg).exists() else None
    if sys.argv[1:2] == ["--kb"] and len(sys.argv) > 2:
        kb_path = Path(sys.argv[2])
    enrich_profile(kb_path)
