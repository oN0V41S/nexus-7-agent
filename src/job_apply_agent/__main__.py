"""
Entry point para python -m src.job_apply_agent
"""
import sys
from pathlib import Path

# Garante que src está no path
_src_dir = Path(__file__).resolve().parent.parent
if str(_src_dir) not in sys.path:
    sys.path.insert(0, str(_src_dir))

from src.job_apply_agent.main import main

main()
