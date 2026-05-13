# Nexus 7 Agent — Harness Context

## Sobre o Projeto

Ecossistema de Agentes de IA 100% local para orquestração de tarefas, automação de código e gestão de conhecimento. Stack: Docker, Ollama, n8n, Open WebUI.

## Harness de Orquestração

O Nexus usa um **harness de 5 estágios** (PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT) implementado via OpenCode, com **2 camadas de infraestrutura**:

| Componente | Localização | Função |
|---|---|---|
| **Orquestrador** | `.opencode/agents/orchestrator.md` | Agente primário que gerencia o pipeline |
| **Harness Workflow** | `.opencode/skills/harness-workflow/SKILL.md` | Skill que define os 5 estágios |
| **Pipeline Command** | `.opencode/commands/pipeline.md` | Atalho `/pipeline` para iniciar o ciclo |
| **Sub-agents** | `.opencode/agents/*.md` | Agentes especializados delegáveis |
| **Custom Tools** | `.opencode/tools/*.ts` | Ferramentas customizadas (log, memória, handoff) |
| **Plugin** | `.opencode/plugins/nexus-plugin.ts` | Observabilidade e hooks de ciclo de vida |
| **oh-my-opencode-slim** | `~/.config/opencode/oh-my-opencode-slim.json` | Orquestração multi-agente com roteamento de modelos |
| **Superpowers** | `superpowers@git+https://github.com/obra/superpowers.git` | 500+ skills de workflow e boas práticas |
| **MCP Memory Server** | `.opencode/mcp/nexus-memory-server.ts` | Servidor MCP expondo nexus-memory para ferramentas externas |
| **Dashboard** | `.opencode/dashboard/server.ts` | UI visual para logs, memória, handoffs e agentes |

## Agentes do Ecossistema

| Agente | Mode | Descrição |
|---|---|---|
| `@orchestrator` | primary | Orquestrador principal - inicia e gerencia o pipeline |
| `@security-secret-auditor` | subagent | Auditoria de segurança no código |
| `@quality-assurance-analyst` | subagent | Testes e validação de qualidade |
| `@docs-architect` | subagent | Documentação técnica |
| `@testsprite-mcp-agent` | subagent | Integração e orquestração do TestSprite MCP Server para testes automatizados |

## Skills do Ecossistema

| Skill | Descrição |
|---|---|
| `harness-workflow` | Pipeline de 5 estágios do harness |
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

## Comandos Customizados

| Comando | Descrição |
|---|---|
| `/pipeline` | Inicia o pipeline harness para uma tarefa |
| `/spec-gen` | Adapta prompt para Spec Driven Development |
| `/review-doc` | Revisa documentação contra código |
| `/create-component` | Cria componentes UI |
| `/plan` | Planeja feature usando pipeline harness (delega ao orchestrator) |
| `/security` | Auditoria de segurança (delega ao @security-secret-auditor) |
| `/qa` | Testes e qualidade (delega ao @quality-assurance-analyst) |
| `/docs` | Documentação técnica (delega ao @docs-architect) |
| `/memory` | Consulta memória persistente do harness |
| `/criar-agente` | Cria novo agente para o ecossistema Nexus (delega ao orchestrator) |
| `/commit-&-docs` | Commit + atualização de documentação |

## Custom Tools (Layer 2)

| Tool | Descrição |
|---|---|
| `nexus-log` | Log estruturado para `.opencode/logs/`. Níveis: info, warn, error, debug, trace |
| `nexus-memory` | Persistência de contexto entre sessões em `.opencode/memory/`. Ações: save, load, list, delete, search |
| `nexus-handoff` | Handoff entre agentes/sessões em `.opencode/memory/handoffs/`. Ações: create, apply, list |

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
