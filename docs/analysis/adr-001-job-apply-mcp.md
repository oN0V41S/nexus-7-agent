# ADR-001: Job Apply Agent — MCP Server Wrapper

## Status
Aceito (2026-06-19)

## Contexto
O Job Application Workflow era executado exclusivamente via CLI Python (`python -m src.job_apply_agent`), exigindo:
- Setup manual de `PYTHONPATH`
- Passagem de argumentos complexos em linha de comando
- Context switching entre o agente e o terminal
- ~2-3min de overhead operacional por comando

## Decisão
Criar um MCP Server em TypeScript que exponha todas as 7 operações como tools MCP nativas, invocando os scripts Python existentes via subprocesso.

### Arquitetura
```
.opencode/mcp/job-apply-mcp.ts
  ├── 8 MCP Tools (stdio JSON-RPC)
  │   ├── job_search          → python3 -m src.job_apply_agent search
  │   ├── job_analyze         → python3 -m src.job_apply_agent analyze
  │   ├── job_consolidate     → python3 -m src.job_apply_agent consolidate
  │   ├── job_kb              → python3 -m src.job_apply_agent kb
  │   ├── job_adapt           → python3 -m src.job_apply_agent adapt
  │   ├── job_apply           → python3 -m src.job_apply_agent apply
  │   ├── job_track           → python3 -m src.job_apply_agent track
  │   └── job_check_duplicate → scripts/job_check_duplicate.py
  └── Python Subprocess Wrapper (spawnSync, env restrito, sanitizeArg)
```

### Decisões Técnicas

1. **stdio JSON-RPC** (não MCP SDK oficial): Segue o padrão existente do `nexus-memory-server.ts`. Menos dependências, mais controle.

2. **Subprocesso Python** (não reescrita em TS): NFR-002 exige zero alterações no Python. O wrapper é puramente um adaptador de protocolo.

3. **spawnSync sem shell=true**: Previne shell injection. `sanitizeArg` é camada extra de defesa.

4. **Env vars restritos ao subprocesso**: Apenas `PATH`, `HOME`, `PYTHONPATH`, `NODE_PATH`, `LANG`, `LC_ALL` são propagados. Sem `...process.env` para evitar vazamento de credenciais.

5. **job_check_duplicate via helper script**: O `main.py` não tem comando para dedup. Um script Python de 20 linhas em `scripts/` faz o bridge.

## Consequências

### Positivas
- Integração nativa com agentes OpenCode via MCP tools
- Eliminação do overhead de CLI (~2min por operação)
- Zero alterações no código Python existente
- ~40min economizados por ciclo de candidatura
- Break-even após ~15 ciclos

### Negativas
- 45.9% coverage inicial (main loop stdin não testável unitariamente)
- Latência natural do Python (~1-30s) permanece nas tools que invocam subprocesso
- Manutenção de um ponto extra de integração (TS → Python)

## Alternativas Consideradas

1. **Reescrita completa em TypeScript**: Rejeitada — violaria NFR-002 e duplicaria 2000+ linhas de Python.

2. **MCP SDK oficial**: Rejeitada — o padrão `nexus-memory-server.ts` já funciona e evita dependência extra.

3. **Proxy HTTP em vez de stdio**: Rejeitada — adicionaria complexidade de rede sem benefício para uso local.

## Métricas
- **Tools expostas**: 8
- **Testes**: 21 (100% passing)
- **Coverage**: 45.9% (job-apply-mcp.ts, main loop excluído)
- **Issues de segurança**: 3 encontradas e corrigidas (env vars, argument injection, stderr sanitization)
- **Linhas totais**: 430 (TS) + 23 (Python helper)
