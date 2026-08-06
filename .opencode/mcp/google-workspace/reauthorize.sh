#!/bin/bash

echo "═══════════════════════════════════════════════════════"
echo "  Google Workspace MCP - Reautorização"
echo "═══════════════════════════════════════════════════════"
echo ""

# Verificar se as APIs estão habilitadas
echo "📋 Verificando configuração no Google Cloud..."
echo ""
echo "1. Acesse: https://console.cloud.google.com/apis/library"
echo "   Verifique se estão habilitadas:"
echo "   - Google Drive API"
echo "   - Google Docs API"
echo "   - Google Sheets API"  
echo "   - Gmail API"
echo ""

echo "2. Acesse: https://console.cloud.google.com/apis/credentials/consent"
echo "   Verifique:"
echo "   - Tipo: Externo"
echo "   - Seu e-mail como usuário de teste"
echo ""

echo "3. Acesse: https://console.developers.google.com/auth/clients"
echo "   Clique no seu Client ID"
echo "   Adicione redirect URI: http://localhost:3000"
echo ""

echo "Após verificar tudo, execute:"
echo "  cd .opencode/mcp/google-workspace"
echo "  node auth.mjs --authorize"
echo ""
