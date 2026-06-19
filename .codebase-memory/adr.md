# ADR-001: Estrutura Arquitetural do Nexus 7 Agent

## Status
Aceito em 2026-05-19

## Contexto
Mapeamento arquitetural completo do ecossistema Nexus 7 Agent via codebase-memory-mcp.

## Decisão
O projeto segue arquitetura em camadas:

1. **Agentes** (.opencode/agents/) - 12 agentes: orchestrador (primary), job-apply-agent (primary), 10 sub-agents
2. **Skills** (.opencode/skills/) - 15 skills de workflow
3. **Comandos** (.opencode/commands/) - 14 comandos customizados
4. **Tools Layer 2** (.opencode/tools/) - 5 ferramentas customizadas em TypeScript
5. **Plugin** (.opencode/plugins/) - 1 plugin de observabilidade
6. **MCP Server** (.opencode/mcp/) - 1 servidor MCP de memória
7. **Dashboard** (.opencode/dashboard/) - 1 UI web
8. **Aplicação** (src/job_apply_agent/) - CLI Python com 9 módulos
9. **Documentação** (docs/spec/) - Spec-Driven Development com 8 specs
10. **Config** raiz - opencode.json + AGENTS.md

## Consequências
- Predominantemente declarativo (Markdown para agentes/skills/comandos)
- Código executável em Python (job_apply_agent) e TypeScript (tools/plugin/mcp/dashboard)
- Sem rotas HTTP (ecossistema local, não web)
- 52 arestas TESTS mapeadas entre testes e funções testadas