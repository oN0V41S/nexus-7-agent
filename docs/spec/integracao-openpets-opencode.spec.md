---
title: "Integração OpenPets com OpenCode"
status: "implemented"
author: "Nexus Orquestrador"
created: "2026-05-19"
updated: "2026-05-19"
version: "0.2.0"
---

## Problema
O ecossistema OpenPets (github.com/alvinunreal/openpets) é um desktop companion para agentes de IA que reage a eventos de codificação (thinking, editing, testing, error, success). O ambiente OpenCode atual precisa ser integrado ao OpenPets para receber feedback visual de status do agente.

## Stack Descoberta

Após análise do repositório oficial, o OpenPets já possui suporte nativo ao OpenCode via:

- **`@open-pets/cli`** — CLI de configuração (instala MCP, plugin, instruction file)
- **`@open-pets/mcp`** — Servidor MCP stdio com ferramentas: `openpets_status`, `openpets_react`, `openpets_say`
- **`@open-pets/opencode`** — Plugin OpenCode para reações automáticas durante tool use
- **`openpets.md`** — Instruction file gerenciado
- **`@open-pets/client`** — Cliente IPC local para comunicação com o desktop app
- **`@open-pets/desktop`** — Aplicação Electron de desktop (tray)

Portanto, a integração não requer construção de código novo, mas sim configuração e instalação correta dos pacotes existentes.

## Requisitos Funcionais

### REQ-001: Instalação do OpenPets Desktop
- ID: REQ-001
- Prioridade: alta
- Descrição: Baixar e instalar o aplicativo OpenPets Desktop no sistema.
- Critérios de aceitação:
  - AppImage baixado do GitHub Releases (`OpenPets-*-linux-x86_64.AppImage`)
  - Aplicativo executável e com permissão de execução.
  - Pet padrão visível na bandeja do sistema.
- Casos de teste:
  - CT-001.1: Download do release mais recente via URL oficial.
  - CT-001.2: Verificação de que o binário está executável.

### REQ-002: Configuração do MCP Server OpenPets
- ID: REQ-002
- Prioridade: alta
- Descrição: Adicionar o servidor MCP do OpenPets à configuração do OpenCode para expor as ferramentas `openpets_status`, `openpets_react` e `openpets_say`.
- Critérios de aceitação:
  - Entrada MCP registrada em `.opencode/opencode.jsonc` ou via OpenCode MCP config.
  - Ferramenta `openpets_status` retorna "reachable" quando o desktop app está rodando.
  - Ferramenta `openpets_react` consegue alterar a reação do pet.
- Casos de teste:
  - CT-002.1: Adicionar configuração MCP e verificar se o servidor está ativo.
  - CT-002.2: Chamar `openpets_react` com reação "thinking" e verificar se o pet reage.

### REQ-003: Instalação do Plugin OpenPets para OpenCode
- ID: REQ-003
- Prioridade: média
- Descrição: Instalar e configurar o plugin `@open-pets/opencode` para reações automáticas durante tool use do agente.
- Critérios de aceitação:
  - Plugin registrado no OpenCode.
  - Reações automáticas ocorrem durante atividades do agente (edit, test, error, success).
  - Plugin não interfere no funcionamento normal do OpenCode.
- Casos de teste:
  - CT-003.1: Plugin carregado na inicialização do OpenCode.
  - CT-003.2: Reação automática é disparada em um evento de edição de arquivo.

### REQ-004: Instalação do Instruction File (openpets.md)
- ID: REQ-004
- Prioridade: média
- Descrição: Garantir que o agente tenha instruções sobre como usar as ferramentas MCP do OpenPets.
- Critérios de aceitação:
  - Arquivo `openpets.md` presente no diretório de instruções (global ou local).
  - Agente demonstra conhecimento das ferramentas `openpets_status`, `openpets_react`, `openpets_say`.
- Casos de teste:
  - CT-004.1: Verificar presença do arquivo de instruções.
  - CT-004.2: Agente responde corretamente quando perguntado sobre OpenPets.

## Requisitos Não-Funcionais

### NFR-001: Privacidade
- ID: NFR-001
- Descrição: O OpenPets não deve expor prompts, código, logs, secrets, URLs ou caminhos de arquivo nas speech bubbles.
- Métrica: Revisão de segurança das mensagens automáticas.
- Prioridade: alta

### NFR-002: Performance
- ID: NFR-002
- Descrição: O plugin OpenPets não deve adicionar latência perceptível ao ciclo de tool use do OpenCode.
- Métrica: < 50ms de overhead por operação.
- Prioridade: média

## Plano de Implementação

### Ordem de Execução
1. **REQ-001**: Instalar OpenPets Desktop (pré-requisito para testar as demais)
2. **REQ-002**: Configurar MCP Server (pré-requisito para REQ-003 e REQ-004)
3. **REQ-003**: Instalar plugin OpenCode
4. **REQ-004**: Verificar instruction file
5. **NFR-001 + NFR-002**: Validação de segurança e performance

### Estratégia
Usar preferencialmente `@open-pets/cli` para configuração automatizada, com fallback para configuração manual quando necessário.
