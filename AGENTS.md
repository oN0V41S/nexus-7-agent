# Nexus 7 Agent — Harness Context

## Sobre o Projeto

Ecossistema de Agentes de IA 100% local para orquestração de tarefas, automação de código e gestão de conhecimento. Stack: Docker, Ollama, n8n, Open WebUI.

## Harness de Orquestração

O Nexus usa um **harness de 5 estágios** (PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT) implementado via OpenCode:

| Componente | Localização | Função |
|---|---|---|
| **Orquestrador** | `.opencode/agents/orchestrator.md` | Agente primário que gerencia o pipeline |
| **Harness Workflow** | `.opencode/skills/harness-workflow/SKILL.md` | Skill que define os 5 estágios |
| **Pipeline Command** | `.opencode/commands/pipeline.md` | Atalho `/pipeline` para iniciar o ciclo |
| **Sub-agents** | `.opencode/agents/*.md` | Agentes especializados delegáveis |

## Agentes do Ecossistema

| Agente | Mode | Descrição |
|---|---|---|
| `@orchestrator` | primary | Orquestrador principal - inicia e gerencia o pipeline |
| `@security-secret-auditor` | subagent | Auditoria de segurança no código |
| `@quality-assurance-analyst` | subagent | Testes e validação de qualidade |
| `@docs-architect` | subagent | Documentação técnica |

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

## Comandos Customizados

| Comando | Descrição |
|---|---|
| `/pipeline` | Inicia o pipeline harness para uma tarefa |
| `/spec-gen` | Adapta prompt para Spec Driven Development |
| `/review-doc` | Revisa documentação contra código |
| `/create-component` | Cria componentes UI |
| `/commit-&-docs` | Commit + atualização de documentação |

## Convenções

- **Linguagem:** Português para comunicação com o usuário
- **Commits:** Descritivos e atômicos, usando `/commit-&-docs`
- **Pipeline:** Sempre iniciar com `/pipeline` para tarefas complexas
- **Sub-agents:** Usar `task("descrição", "@agent-name")` para delegação
