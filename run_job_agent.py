#!/usr/bin/env python3
"""
Wrapper para executar o Job Application Workflow.

Uso:
    python run_job_agent.py search "data scientist" "São Paulo"
    python run_job_agent.py analyze
    python run_job_agent.py consolidate cv1.pdf cv2.pdf
    python run_job_agent.py adapt vaga-001
    python run_job_agent.py apply vaga-001
    python run_job_agent.py track

Equivalente a:
    PYTHONPATH=src python -m src.job_apply_agent [args]
"""
import sys
import os
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"

if not (SRC_DIR / "job_apply_agent" / "__init__.py").exists():
    print("❌ Pacote src/job_apply_agent/ não encontrado.", file=sys.stderr)
    sys.exit(1)

# Define PYTHONPATH para incluir src
env = os.environ.copy()
existing = env.get("PYTHONPATH", "")
env["PYTHONPATH"] = str(SRC_DIR) + (os.pathsep + existing if existing else "")

# Executa o pacote via python -m
cmd = [sys.executable, "-m", "job_apply_agent"] + sys.argv[1:]
sys.exit(subprocess.call(cmd, env=env, cwd=str(ROOT_DIR)))
