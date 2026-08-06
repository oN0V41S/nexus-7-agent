
#!/bin/bash
# Script for run Opencode without suspend OS

echo "Iniciando Opencode Server (Suspensão inibida).."
nohub opencode serve --hostname 0.0.0.0 --port 4096 > opencode.log 2>&1  &

