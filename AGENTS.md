# Nexus 7 Agent — Harness Context

## Sobre o Projeto

Ecossistema de Agentes de IA 100% local para orquestração de tarefas, automação de código e gestão de conhecimento. Stack: Docker, Ollama, n8n, Open WebUI.

## Harness de Orquestração

O Nexus usa um **harness de 6 estágios** (SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT) implementado via OpenCode, com **2 camadas de infraestrutura**:

| Componente | Localização | Função |
|---|---|---|
| **Orquestrador** | `.opencode/agents/orchestrator.md` | Agente primário que gerencia o pipeline |
| **Harness Workflow** | `.opencode/skills/harness-workflow/SKILL.md` | Skill que define os 6 estágios |
| **Pipeline Command** | `.opencode/commands/pipeline.md` | Atalho `/pipeline` para iniciar o ciclo |
| **Sub-agents** | `.opencode/agents/*.md` | Agentes especializados delegáveis |
| **Custom Tools** | `.opencode/tools/*.ts` | Ferramentas customizadas (log, memória, handoff) |
| **Plugin** | `.opencode/plugins/nexus-plugin.ts` | Observabilidade e hooks de ciclo de vida |
| **oh-my-opencode-slim** | `~/.config/opencode/oh-my-opencode-slim.json` | Orquestração multi-agente com roteamento de modelos |
| **Superpowers** | `superpowers@git+https://github.com/obra/superpowers.git` | 500+ skills de workflow e boas práticas |
| **MCP Memory Server** | `.opencode/mcp/nexus-memory-server.ts` | Servidor MCP expondo nexus-memory para ferramentas externas |
| **Google Workspace MCP** | `.opencode/mcp/google-workspace/server.mjs` | Servidor MCP local para Google Workspace (Drive, Docs, Sheets, Gmail) |
| **Dashboard** | `.opencode/dashboard/server.ts` | UI visual para logs, memória, handoffs e agentes |

## Agentes do Ecossistema

| Agente | Mode | Descrição |
|---|---|---|
| `@orchestrator` | primary | Orquestrador principal - inicia e gerencia o pipeline |
| `@security-secret-auditor` | subagent | Auditoria de segurança no código |
| `@quality-assurance-analyst` | subagent | Testes e validação de qualidade |
| `@docs-architect` | subagent | Documentação técnica |
| `@testsprite-mcp-agent` | subagent | Integração e orquestração do TestSprite MCP Server para testes automatizados |
| `@spec-reviewer` | subagent | Revisão de especificações (specs) para completude, consistência e testabilidade |
| `@cbm-agent` | subagent | Code intelligence via codebase-memory-mcp (knowledge graph, 14 tools) |
| `@notion-agent` | subagent | Gerenciamento de conteúdo no Notion via MCP (criar, apagar, reestruturar páginas) |
| `@google-workspace-agent` | subagent | Google Workspace specialist — Drive, Docs, Sheets, Gmail via MCP local com OAuth 2.0 |
| `@playwright-agent` | subagent | Automação de navegador via Playwright MCP — navegar, clicar, preencher, extrair dados |
| `@chrome-devtools-agent` | subagent | Debugging frontend via Chrome DevTools MCP — performance, network, console, memory |
| `@job-apply-agent` | primary | Agente principal do Job Application Workflow — busca, análise, consolidação, geração e aplicação de vagas |

## Skills do Ecossistema

| Skill | Descrição |
|---|---|
| `harness-workflow` | Pipeline de 6 estágios do harness (SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT) |
| `project-review` | Revisão de estrutura e arquitetura |
| `prisma-scaffold` | Scaffold de modelos Prisma |
| `quality-assurance-analyst` | Validação de qualidade |
| `documentation-architect` | Documentação técnica |
| `react-components` | Componentes React com shadcn/ui |
| `commit-push` | Fluxo de commit, documentação e push |
| `mem-search` | Consulta de memória persistente com progressive disclosure |
| `agent-creator` | Meta-agente que cria outros agentes a partir de descrição natural |
| `testsprite-mcp` | Skill para orquestração do fluxo completo de testes automatizados com TestSprite MCP Server |
| `auto-discovery` | Escaneia repositório, detecta gaps e gera agentes/skills automaticamente |
| `notion-agent-copilot` | Acessa a página Agent Copilot no Notion via MCP (busca, leitura, comentários e atualizações) |
| `spec-driven-dev` | Skill de Spec Driven Development para o ecossistema Nexus |
| `cbm-agent` | Code intelligence via codebase-memory-mcp knowledge graph (search, trace, architecture) |
| `google-workspace` | Acessar e manipular Google Workspace (Drive, Docs, Sheets, Gmail) via MCP server local com OAuth 2.0 |
| `playwright-automation` | Automação de navegador via Playwright MCP — navegar, clicar, preencher, extrair dados |
| `chrome-devtools` | Debugging frontend via Chrome DevTools MCP — performance, network, console, memory |

## Comandos Customizados

| Comando | Descrição |
|---|---|
| `/pipeline` | Inicia o pipeline harness para uma tarefa |
| `/spec-gen` | Gera spec formal .spec.md em docs/spec/ (Spec Driven Development) |
| `/spec-review` | Revisa spec com @spec-reviewer (delega ao spec-reviewer) |
| `/cbm-query` | Consulta o knowledge graph CBM (delega ao @cbm-agent) |
| `/review-doc` | Revisa documentação contra código |
| `/create-component` | Cria componentes UI |
| `/plan` | Planeja feature usando pipeline harness (delega ao orchestrator) |
| `/security` | Auditoria de segurança (delega ao @security-secret-auditor) |
| `/qa` | Testes e qualidade (delega ao @quality-assurance-analyst) |
| `/docs` | Documentação técnica (delega ao @docs-architect) |
| `/memory` | Consulta memória persistente do harness |
| `/criar-agente` | Cria novo agente para o ecossistema Nexus (delega ao orchestrator) |
| `/commit-&-docs` | Commit + atualização de documentação |
| `/playwright` | Automação de navegador via Playwright MCP (delega ao @playwright-agent) |
| `/devtools` | Debugging frontend via Chrome DevTools MCP (delega ao @chrome-devtools-agent) |

## Custom Tools (Layer 2)

| Tool | Descrição |
|---|---|
| `nexus-log` | Log estruturado para `.opencode/logs/`. Níveis: info, warn, error, debug, trace |
| `nexus-memory` | Persistência de contexto entre sessões em `.opencode/memory/`. Ações: save, load, list, delete, search |
| `nexus-handoff` | Handoff entre agentes/sessões em `.opencode/memory/handoffs/`. Ações: create, apply, list |
| `spec-validator` | Valida documentos de spec (.spec.md) contra o JSON schema Nexus |

## Diretórios de Dados

| Diretório | Propósito |
|---|---|
| `.opencode/logs/` | Logs estruturados do harness (rotacionados por data e categoria) |
| `.opencode/memory/` | Dados persistentes entre sessões (SQLite + FTS5) |
| `.opencode/mcp/` | Servidor MCP do Nexus Memory Server |
| `.opencode/dashboard/` | Dashboard web do ecossistema Nexus |
| `.opencode/memory/handoffs/` | Documentos de handoff para retomada de contexto |
| `.opencode/tools/` | Ferramentas customizadas do ecossistema |
| `.opencode/plugins/` | Plugins de hook do OpenCode |

## Convenções

- **Linguagem:** Português para comunicação com o usuário
- **Commits:** Descritivos e atômicos, usando `/commit-&-docs`
- **Pipeline:** Sempre iniciar com `/pipeline` para tarefas complexas
- **Sub-agents:** Usar `task("descrição", "@agent-name")` para delegação
- **Logs:** Usar `nexus-log` para registrar eventos importantes
- **Memória:** Usar `nexus-memory` para salvar/recuperar contexto entre sessões
- **Handoff:** Usar `nexus-handoff` antes de pausar tarefas longas
