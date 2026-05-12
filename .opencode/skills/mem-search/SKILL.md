---
name: mem-search
description: Consulta a memória persistente do harness Nexus com progressive disclosure. Busca observações de sessões anteriores e handoffs salvos.
---

# Mem Search Skill

Skill para consultar o histórico de memória do Nexus usando progressive disclosure (3 camadas), inspirando-se no padrão do claude-mem.

## Quando Usar Esta Skill

- O usuário pergunta "o que fizemos na sessão anterior?"
- Precisa recuperar contexto de uma tarefa que ficou incompleta
- Quer saber quais ferramentas foram usadas em uma sessão anterior
- Precisa encontrar um handoff salvo para retomar o trabalho
- O orquestrador quer consultar o histórico antes de iniciar um novo pipeline

## Quando NÃO Usar Esta Skill

- A tarefa é nova e não precisa de contexto anterior
- O usuário já forneceu todo o contexto necessário

## Progressive Disclosure Pattern (3 Camadas)

### Camada 1: SEARCH — Índice Compacto

Use `nexus-memory` com `action=search` para obter um índice compacto dos resultados:

```
nexus-memory({ action: "search", query: "<termo>", limit: 10 })
```

**Retorna:** Lista compacta com key, scope, savedAt, agent, summary (200 chars) e score de relevância.

**Custo:** ~50-100 tokens por resultado.

### Camada 2: LOAD — Detalhes Completos

Após revisar o índice, use `nexus-memory` com `action=load` para obter detalhes completos das entradas mais relevantes:

```
nexus-memory({ action: "load", key: "<key>", scope: "<scope>" })
```

**Retorna:** O valor completo da entrada, com savedAt, agent e sessionID.

**Custo:** ~500-1000 tokens por resultado.

### Camada 3: HANDOFF — Retomada de Contexto

Se o resultado da busca for um handoff, use `nexus-handoff` para aplicar:

```
nexus-handoff({ action: "apply", handoffId: "<id>" })
```

**Retorna:** Resumo completo + próximos passos + artefatos + pendências.

## Fluxo de Consulta Recomendado

```
Usuário: "O que estávamos fazendo ontem?"

1. SEARCH → nexus-memory action=search query="ontem" limit=5
   → Índice: [key: "tool-abc123", scope: "observations", summary: "write: Adicionado endpoint..."]
            [key: "handoff-...", scope: "session", summary: "Pipeline: feature de relatórios..."]

2. LOAD → nexus-memory action=load key="handoff-..." scope="session"
   → Detalhes: { title, summary, nextSteps, artifacts, pending }

3. HANDOFF → nexus-handoff action=apply handoffId="handoff-..."
   → Contexto completo para retomar a tarefa
```

## Ferramentas e Permissões

- `nexus-memory` — search, load, list para consultar memória
- `nexus-handoff` — apply para retomar handoffs
- `nexus-log` — para registrar consultas de memória

## Critérios de Qualidade

- [ ] Sempre começar com SEARCH (Camada 1) antes de LOAD (Camada 2)
- [ ] Buscar vários termos se o primeiro não retornar resultados
- [ ] Usar `scope: "observations"` para buscas de ferramentas
- [ ] Usar `scope: "session"` para buscas de contexto geral
- [ ] Usar `scope: "project"` para buscas de conhecimento permanente
- [ ] Retornar handoff formatado quando encontrado
