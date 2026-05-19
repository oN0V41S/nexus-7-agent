---
title: "Integração Google Workspace com OpenCode"
status: "implemented"
author: "Nexus Orquestrador"
created: "2026-05-19"
updated: "2026-05-19"
version: "0.1.0"
---

## Problema
O ambiente OpenCode precisa de acesso programático ao Google Workspace para manipular e salvar documentos (Google Docs, Google Drive, Google Sheets), permitindo que o agente crie, leia, edite e armazene arquivos no ecossistema Google.

## Stack Disponível

Após pesquisa, duas abordagens principais foram identificadas:

### Abordagem A: Google Workspace MCP Server (Oficial - Recomendado)
- **Status:** Developer Preview (Google Cloud, 2025-2026)
- **Transporte:** HTTP remoto (Streamable HTTP MCP)
- **Autenticação:** OAuth 2.0 via Google Cloud Console
- **Servidores:** 5 servidores dedicados (Gmail, Drive, Calendar, Chat, People)
- **APIs necessárias:** Gmail API, Drive API, Calendar API, Chat API, People API

### Abordagem B: Comunidade (Stdio MCP)
- **Pacote:** `@aaronsb/google-workspace-mcp` — MCP stdio server com suporte a Gmail, Calendar, Drive
- **Autenticação:** OAuth 2.0 Desktop Client
- **Vantagem:** Funciona com stdio MCP (compatível com OpenCode atualmente)

## Requisitos Funcionais

### REQ-001: Configuração do Google Cloud Project
- ID: REQ-001
- Prioridade: alta
- Descrição: Criar/configurar um projeto no Google Cloud Console com as APIs necessárias habilitadas e OAuth configurado.
- Critérios de aceitação:
  - Projeto Google Cloud criado.
  - APIs habilitadas: Gmail API, Google Drive API, Google Calendar API.
  - OAuth 2.0 Client ID criado (tipo Desktop App ou Web App).
  - Tela de consentimento OAuth configurada.
- Casos de teste:
  - CT-001.1: `gcloud services list` mostra as APIs habilitadas.
  - CT-001.2: Credenciais OAuth geradas e baixadas.
  - CT-001.3: Fluxo de autorização OAuth concluído com sucesso.

### REQ-002: Integração Google Drive
- ID: REQ-002
- Prioridade: alta
- Descrição: Permitir que o agente OpenCode liste, leia, crie e faça upload de arquivos no Google Drive.
- Critérios de aceitação:
  - Ferramenta de listagem de arquivos do Drive disponível no OpenCode.
  - Leitura de conteúdo de documentos do Drive.
  - Criação de novo arquivo no Drive.
  - Upload de arquivo local para o Drive.
- Casos de teste:
  - CT-002.1: Listar arquivos recentes do Drive.
  - CT-002.2: Ler conteúdo de um documento Google Docs.
  - CT-002.3: Criar novo arquivo de texto no Drive.
  - CT-002.4: Fazer upload de arquivo local para o Drive.

### REQ-003: Integração Google Docs
- ID: REQ-003
- Prioridade: alta
- Descrição: Permitir que o agente OpenCode crie e edite documentos Google Docs diretamente.
- Critérios de aceitação:
  - Criação de novo documento Google Docs.
  - Leitura de conteúdo de documento existente.
  - Atualização de documento (append/substituição de texto).
- Casos de teste:
  - CT-003.1: Criar novo documento com título e conteúdo.
  - CT-003.2: Ler conteúdo de documento existente.
  - CT-003.3: Atualizar conteúdo de documento existente.

### REQ-004: Manipulação de Documentos
- ID: REQ-004
- Prioridade: média
- Descrição: Funcionalidades auxiliares de manipulação de documentos (copiar, mover, renomear, excluir).
- Critérios de aceitação:
  - Renomear arquivo no Drive.
  - Excluir arquivo do Drive (com confirmação).
  - Exportar documento em formato específico (PDF, DOCX, TXT).
- Casos de teste:
  - CT-004.1: Renomear arquivo no Drive.
  - CT-004.2: Exportar Google Doc como PDF.

## Requisitos Não-Funcionais

### NFR-001: Segurança e Autenticação
- ID: NFR-001
- Prioridade: alta
- Descrição: Toda comunicação com Google Workspace deve ser autenticada via OAuth 2.0, com tokens armazenados de forma segura.
- Métrica: Nenhum token ou secret em texto panto no repositório. Uso de OAuth 2.0 com refresh tokens.
- Critérios de aceitação:
  - Tokens armazenados em diretório seguro (fora do repositório).
  - Suporte a refresh token automático.
  - Escopos de acesso mínimos necessários.

### NFR-002: Performance
- ID: NFR-002
- Prioridade: média
- Descrição: As operações no Google Workspace devem ter latência aceitável.
- Métrica: Operações de leitura/escrita < 5s, operações de listagem < 3s.

## Abordagem Escolhida: Google MCP Oficial (HTTP Remoto)

O usuário escolheu a abordagem oficial do Google e precisa criar um Google Cloud Project do zero.

### Arquitetura da Solução

1. **Google Cloud Project** → APIs habilitadas (Drive, Docs, Gmail, Calendar, People)
2. **OAuth 2.0 Client ID** (Desktop app type) → Credenciais para autenticação
3. **OpenCode MCP config** → Registro dos servidores remotos do Google

### Formato de Configuração no OpenCode

O OpenCode suporta `type: "remote"` com `url`, mas os servidores Google usam OAuth 2.0 com fluxo de redirect, não API Key. Duas opções:

**Opção 1: Proxy MCP Local**
Criar um adaptador MCP stdio local que:
- Inicia o fluxo OAuth
- Atua como proxy para os servidores HTTP do Google
- Gerencia refresh de tokens

**Opção 2: Usar cliente HTTP direto com tokens**
- Autenticar manualmente via OAuth
- Usar o access token como Bearer token no header
- Renovar token quando expirar

### Servidores Google Workspace MCP

| Serviço | URL | Tools |
|---------|-----|-------|
| Google Drive | `https://drivemcp.googleapis.com/mcp/v1` | 7 tools (list, read, create, search, upload) |
| Gmail | `https://gmailmcp.googleapis.com/mcp/v1` | 10 tools (search, draft, labels, threads) |
| Google Calendar | `https://calendarmcp.googleapis.com/mcp/v1` | 8 tools (list, create, update, delete events) |
| People API | `https://people.googleapis.com/mcp/v1` | 3 tools (profile, contacts, directory) |

### Roadmap de Implementação

1. **Fase 1 — Google Cloud Project** (REQ-001)
   - Criar conta Google Cloud (se necessário)
   - Criar projeto
   - Habilitar APIs (Drive, Docs, Gmail, Calendar)
   - Configurar OAuth consent screen
   - Criar OAuth 2.0 Client ID (Desktop app)
   
2. **Fase 2 — Autenticação e Proxy** (NFR-001)
   - Desenvolver/adaptar proxy MCP stdio → HTTP
   - Implementar fluxo OAuth 2.0
   - Armazenar tokens com segurança
   
3. **Fase 3 — Google Drive** (REQ-002)
   - Configurar Drive MCP server no OpenCode
   - Testar listagem, leitura, criação de arquivos
   
4. **Fase 4 — Google Docs** (REQ-003)
   - Testar criação e edição de documentos
   
5. **Fase 5 — Operações Avançadas** (REQ-004)
   - Renomear, mover, exportar documentos
   
6. **Fase 6 — Validação** (NFR-001, NFR-002)
   - Testes de segurança
   - Testes de performance

## Ordem de Implementação

1. **REQ-001:** Criar/configurar Google Cloud Project e credenciais OAuth (pré-requisito para todos)
2. **NFR-001:** Implementar autenticação segura com armazenamento de tokens
3. **REQ-002:** Integrar Google Drive (leitura/escrita de arquivos)
4. **REQ-003:** Integrar Google Docs (criação/edição de documentos)
5. **REQ-004:** Operações auxiliares de manipulação
6. **NFR-002:** Validação de performance
