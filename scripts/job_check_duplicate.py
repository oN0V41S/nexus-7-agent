#!/usr/bin/env python3
"""
Helper script for job_check_duplicate MCP tool.
Imports from src.job_apply_agent.deduplicator and returns JSON result.
"""
import sys
import json
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from src.job_apply_agent.deduplicator import check_duplicate

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: job_check_duplicate.py <company> <title>"}))
        sys.exit(1)

    company = sys.argv[1]
    title = sys.argv[2]
    result = check_duplicate(company, title)
    print(json.dumps({"duplicate": result}))
