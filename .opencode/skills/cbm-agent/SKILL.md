---
name: cbm-agent
description: "Code intelligence via codebase-memory-mcp knowledge graph. Search, trace, architecture, impact analysis e Cypher queries sobre o código indexado."
---

# CBM Agent Skill

Skill para usar o MCP server `codebase-memory-mcp` para análise estrutural de código. Use quando precisar entender a estrutura, rastrear chamadas, detectar dead code ou analisar arquitetura.

## Quando Usar Esta Skill

- Entender um código desconhecido (arquitetura, pacotes, entry points)
- Rastrear quem chama uma função e o que ela chama
- Detectar dead code antes de refatorar
- Mapear impacto de mudanças via git diff
- Responder perguntas estruturais sobre o código

## Quando NÃO Usar Esta Skill

- Para ler arquivos individuais (use read diretamente)
- Para busca textual simples (use grep)
- Quando o repositório não está indexado

## Workflow de Uso

### 1. Verificar indexação

```bash
codebase-memory-mcp cli list_projects 2>/dev/null | grep -v "^level="
```

Se o projeto não aparecer, indexar:

```bash
codebase-memory-mcp cli index_repository '{"repo_path": "/workspaces/nexus-7-agent"}' 2>/dev/null | grep -v "^level="
```

### 2. Explorar arquitetura

```bash
codebase-memory-mcp cli get_graph_schema 2>/dev/null | grep -v "^level="
codebase-memory-mcp cli get_architecture '{"aspects": ["all"], "project": "workspaces-nexus-7-agent"}' 2>/dev/null | grep -v "^level="
```

### 3. Buscar símbolos

```bash
# Por nome (case-insensitive)
codebase-memory-mcp cli search_graph '{"name_pattern": ".*Handler.*", "label": "Function"}' 2>/dev/null | grep -v "^level="

# Por label
codebase-memory-mcp cli search_graph '{"label": "Route"}' 2>/dev/null | grep -v "^level="

# Por arquivo
codebase-memory-mcp cli search_graph '{"file_pattern": ".*agent.*", "label": "Function"}' 2>/dev/null | grep -v "^level="
```

### 4. Rastrear chamadas

```bash
# Quem chama esta função? (inbound)
codebase-memory-mcp cli trace_call_path '{"function_name": "NomeExato", "direction": "inbound", "depth": 3}' 2>/dev/null | grep -v "^level="

# O que esta função chama? (outbound)
codebase-memory-mcp cli trace_call_path '{"function_name": "NomeExato", "direction": "outbound", "depth": 3}' 2>/dev/null | grep -v "^level="
```

### 5. Cypher queries

```bash
codebase-memory-mcp cli query_graph '{"query": "MATCH (f:Function) RETURN f.name LIMIT 10"}' 2>/dev/null | grep -v "^level="
codebase-memory-mcp cli query_graph '{"query": "MATCH (f:Function)-[:CALLS]->(g) RETURN f.name, g.name LIMIT 20"}' 2>/dev/null | grep -v "^level="
```

### 6. Impact analysis

```bash
codebase-memory-mcp cli detect_changes '{"repo_path": "/workspaces/nexus-7-agent"}' 2>/dev/null | grep -v "^level="
```

## Exemplos de Queries Cypher

```cypher
-- Listar todas as funções
MATCH (f:Function) RETURN f.name LIMIT 20

-- Listar todas as classes
MATCH (c:Class) RETURN c.name

-- Quem chama uma função específica
MATCH (f:Function)-[:CALLS]->(g:Function) WHERE g.name = 'main' RETURN f.name

-- Encontrar funções sem caller (dead code candidate)
MATCH (f:Function) WHERE NOT (f)<-[:CALLS]-() RETURN f.name

-- Todas as rotas HTTP
MATCH (r:Route) RETURN r.path, r.method

-- Pacotes e suas funções
MATCH (pkg:Package)-[:CONTAINS_FILE]->(:File)-[:DEFINES]->(f:Function) RETURN pkg.name, f.name LIMIT 30
```

## Critérios de Qualidade

- [ ] Repositório indexado antes de consultar
- [ ] `search_graph` usado para descobrir nome exato antes de `trace_call_path`
- [ ] Projeto especificado em queries multi-projeto
- [ ] Resultados Cypher verificados com `get_code_snippet`
