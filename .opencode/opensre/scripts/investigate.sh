#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

usage() {
  echo "Usage: $0 <alert-file|-> [options]"
  echo ""
  echo "  <alert-file>  Path to alert JSON/MD/TXT file (use '-' for stdin)"
  echo "  --interactive Paste alert interactively"
  echo "  --template    Print an alert template (generic|datadog|grafana|honeycomb|coralogix)"
  echo "  --service     Investigate a deployed service by name"
  echo "  --output      Output file for the RCA report"
  echo ""
  echo "Examples:"
  echo "  $0 .opencode/opensre/alerts/sample-generic.json"
  echo "  $0 --template datadog"
  echo "  $0 --service api-gateway"
  exit 1
}

if [ $# -eq 0 ]; then
  usage
fi

cd "$PROJECT_ROOT"
python3 -m opensre investigate "$@"
