#!/usr/bin/env python3
"""Nexus ↔ OpenSRE integration bridge.

Usage:
    python3 nexus-opensre.py investigate <alert.json>
    python3 nexus-opensre.py template [generic|datadog|grafana]
    python3 nexus-opensre.py health
"""

import sys
import json
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOGS_DIR = PROJECT_ROOT / ".opencode" / "logs" / "opensre"
CONFIG_PATH = PROJECT_ROOT / ".opencode" / "opensre" / "config.yaml"


def load_alert(filepath: str) -> dict:
    with open(filepath) as f:
        return json.load(f)


def investigate(alert_file: str):
    payload = load_alert(alert_file)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    report = {
        "alert": payload.get("alert", {}),
        "status": "investigation_triggered",
        "tool": "opensre",
        "message": (
            f"Investigating alert '{payload.get('alert', {}).get('title', 'unknown')}' "
            f"for service '{payload.get('alert', {}).get('service', 'unknown')}'"
        ),
    }

    output_path = LOGS_DIR / f"rca-{payload.get('alert', {}).get('id', 'unknown')}.json"
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    print(json.dumps(report, indent=2))
    print(f"\nReport saved: {output_path}")


def print_template(template_type: str = "generic"):
    templates_dir = PROJECT_ROOT / ".opencode" / "opensre" / "alerts"
    mapping = {
        "generic": "sample-generic.json",
        "datadog": "sample-datadog.json",
    }
    filename = mapping.get(template_type)
    if filename:
        path = templates_dir / filename
        if path.exists():
            print(path.read_text())
            return
    print(json.dumps({"alert": {"title": "example", "severity": "critical"}}, indent=2))


def health_check():
    result = {
        "opensre_version": "2026.4.5",
        "python": sys.version,
        "config_exists": CONFIG_PATH.exists(),
        "alerts_dir": str(PROJECT_ROOT / ".opencode" / "opensre" / "alerts"),
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == "investigate" and len(sys.argv) >= 3:
        investigate(sys.argv[2])
    elif command == "template":
        print_template(sys.argv[2] if len(sys.argv) >= 3 else "generic")
    elif command == "health":
        health_check()
    else:
        print(__doc__)
        sys.exit(1)
