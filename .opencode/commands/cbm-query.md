---
description: "Consulta o knowledge graph do codebase-memory-mcp via Cypher query ou nome de função. Delega ao @cbm-agent."
agent: cbm-agent
subtask: true
---

Execute uma consulta no knowledge graph do codebase-memory-mcp usando os argumentos fornecidos em `$ARGUMENTS`.

## Modos de Uso

### Cypher Query
```
/cbm-query MATCH (f:Function) RETURN f.name LIMIT 10
```

### Nome de função para rastrear
```
/cbm-query NomeDaFuncao
```

### Descrição em linguagem natural
```
/cbm-query "Quais funções chamam a função main?"
```

## Projeto Padrão

Sempre inclua o parâmetro `"project": "workspaces-nexus-7-agent"` nas consultas. Sem o project name, o CBM retorna erro.

## Fluxo

1. Use `bash` com `codebase-memory-mcp cli` para executar a consulta
2. Se for uma Cypher query, use `query_graph` com o project padrão
3. Se for um nome de função, use `search_graph` primeiro para descobrir o nome exato, depois `trace_call_path`
4. Se for linguagem natural, interprete e traduza para a tool CBM apropriada
5. Apresente os resultados formatados

```bash
# Cypher query (sempre com project):
codebase-memory-mcp cli query_graph '{"query": "$ARGUMENTS", "project": "workspaces-nexus-7-agent"}' 2>/dev/null | grep -v "^level="

# Nome de função → search primeiro (sempre com project):
codebase-memory-mcp cli search_graph '{"name_pattern": ".*$ARGUMENTS.*", "label": "Function", "project": "workspaces-nexus-7-agent"}' 2>/dev/null | grep -v "^level="
```

## Exemplos

**Query:** `/cbm-query MATCH (f:Function) RETURN f.name LIMIT 5`

**Resposta:** Lista das 5 primeiras funções no grafo.

**Query:** `/cbm-query "trace extractFrontmatter"`

**Resposta:** Quem chama extractFrontmatter e o que ela chama.
