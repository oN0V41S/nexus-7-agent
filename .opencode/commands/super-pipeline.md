# /super-pipeline — Pipeline Harness Aprimorado com Sub-Agents

## Propósito
Orquestra o pipeline completo de desenvolvimento (SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT) delegando **cada estágio a sub-agents especializados**. É a versão aprimorada do `/pipeline` com delegação inteligente e paralelização.

Use este comando para tarefas complexas que exigem múltiplos estágios do pipeline com validação especializada em cada etapa.

## Mapeamento Estágio → Sub-Agent

| Estágio | Sub-Agent / Comando | Ação |
|---------|--------------------|------|
| **PRE** | @cbm-agent | Indexação automática (fast, timeout 30s) |
| **0. SPEC** | `/spec-gen` → @spec-reviewer + @cbm-agent | Gera spec formal + get_architecture |
| **1. PLAN** | @orchestrator + `/plan` + @cbm-agent | Plano com search_graph + trace_call_path |
| **2. ANALYZE** | @security-secret-auditor + @cbm-agent | Segurança + impacto arquitetural |
| **3. BUILD** | Implementação direta (+ @fixer + @cbm-agent) | Código + get_code_snippet |
| **4. REVIEW** | @quality-assurance-analyst + linters + @testsprite-mcp-agent + @cbm-agent | Testes + detect_changes (blast radius) |
| **5. DOCUMENT** | @docs-architect + @cbm-agent + `/commit-&-docs` | Documentação + manage_adr (ADRs) |

## Fluxo Detalhado com Sub-Agents

### Pré-pipeline: Indexação CBM
1. **Verificação**: Delega `@cbm-agent` via `task` para `index_status` no projeto atual
2. **Indexação**: Se não indexado, execute `index_repository` modo `fast` (timeout 30s). Se exceder, continue com fallback glob/grep.
3. **Log**: `nexus-log level=info message="CBM index status: OK|TIMEOUT|OFFLINE" category=pipeline`

### Estágio 0: SPEC (Geração de Spec)
1. **Contexto CBM**: Delega `@cbm-agent` via `task` para `get_architecture` e enriquece a seção de Contexto da spec com módulos, entry points e dependências
2. **Geração**: Execute `/spec-gen` com a descrição da tarefa para gerar spec formal em `docs/spec/<feature>.spec.md`
3. **Revisão**: Delega `@spec-reviewer` via `task` para revisar a spec (completude, REQ-IDs, CT-IDs, critérios de aceitação)
4. **Correção**: Se o revisor apontar issues, corrija antes de prosseguir
5. **Aprovação**: Use `question` para obter aprovação do usuário na spec
6. **Log**: `nexus-log level=info message="Spec aprovada" category=pipeline metadata=<caminho da spec>`

### Estágio 1: PLAN (Planejamento)
1. Use a spec aprovada como base
2. **Sub-etapa**: Delega `@cbm-agent` via `task` para:
   - `search_graph` — descobrir funções/classes/arquivos existentes relacionados ao escopo
   - `trace_call_path` — mapear dependências e impacto entre os arquivos afetados
3. Decomponha REQ-IDs em tarefas de implementação com dependências
4. **Inclua seção de "Arquivos Afetados" no plano, referenciando descobertas do CBM**
5. Identifique quais sub-agents usar em cada estágio
6. Apresente o plano ao usuário e aguarde aprovação
7. **Log**: `nexus-log level=info message="Plano aprovado" category=pipeline`

### Estágio 2: ANALYZE (Análise)
**Paralelize** as análises abaixo:

1. **Segurança**: Delega `@security-secret-auditor` via `task` para auditar:
   - Hardcoded secrets (API keys, tokens, senhas)
   - Padrões de injeção (SQL, XSS)
   - Configurações inseguras de autenticação/autorização
   - Dados sensíveis sem criptografia

2. **Impacto Arquitetural**: Delega `@cbm-agent` via `task` para analisar:
   - `search_graph` para encontrar funções/classes afetadas
   - `trace_path` para rastrear dependências
   - `get_architecture` para visão geral do impacto

3. **Resultados**: Consolide os achados. Documente riscos que afetam BUILD.
4. **Log**: `nexus-log level=info message="Análise concluída" category=pipeline`

### Estágio 3: BUILD (Implementação)
1. Siga o plano aprovado, implementando REQ-ID por REQ-ID
2. **Sub-etapa**: Para tarefas isoladas e bem definidas, delega `@fixer` via `task`
3. **Sub-etapa**: Use `@cbm-agent` com `get_code_snippet` para consultar código existente e acelerar implementação (fallback: glob/grep)
4. Faça commits frequentes com `git add` + `git commit` (referencie REQ-IDs)
5. Use `nexus-log` a cada REQ-ID implementado
6. Ao final, execute `npm run build` ou equivalente para verificar erros de compilação

### Estágio 4: REVIEW (Revisão e Testes)
**Paralelize** as validações abaixo:

1. **Testes e Qualidade**: Delega `@quality-assurance-analyst` via `task`:
   - Escrever/atualizar testes unitários e de integração
   - Verificar cobertura mínima de 80%
   - Validar padrão AAA e isolamento
   - Reportar falhas

2. **Blast Radius**: Delega `@cbm-agent` via `task` para `detect_changes` — validar que o diff cobre exatamente o escopo planejado (opcional, requer git history)

3. **Linters e Type Checking**: Execute em paralelo:
   - `npm run lint` ou `npx eslint .`
   - `npx tsc --noEmit` (se TypeScript)

4. **Testes Automatizados (opcional)**: Se UI/API estiver no escopo:
   - Delega `@testsprite-mcp-agent` via `task` para testes E2E
   - Delega `@playwright-agent` via `task` para testes de navegador (se aplicável)

4. **Validação de Cobertura de Requisitos** (orquestrador):
   - TODO REQ-ID da spec tem teste correspondente?
   - Reporte requisitos sem cobertura como falha
   - Peça aprovação do usuário para correções

### Estágio 5: DOCUMENT (Documentação)
1. **Documentação Técnica**: Delega `@docs-architect` via `task`:
   - Atualizar documentação de API (se aplicável)
   - Diagramas de arquitetura (Mermaid)
   - ADRs (Architecture Decision Records) — via `manage_adr` do CBM
   - Referenciar arquivos em `docs/`

2. **ADRs via CBM**: Delega `@cbm-agent` via `task` para `manage_adr` — criar Architecture Decision Records das decisões tomadas (se CBM offline, pule sem falha)

3. **Commit Final**: Execute `/commit-&-docs` para commit com documentação atualizada

3. **Resumo**: Entregue ao usuário:
   - O que foi implementado (REQ-IDs concluídos)
   - O que foi testado (CTs validados)
   - Documentação atualizada
   - Próximos passos sugeridos

## Recursos Úteis

### Sub-Agents Disponíveis para Delegação

| Sub-Agent | Estágio | Ferramentas | Uso |
|-----------|---------|-------------|-----|
| `@spec-reviewer` | SPEC | read, glob, grep | Revisar spec |
| `@cbm-agent` | PRE, SPEC, PLAN, ANALYZE, BUILD, REVIEW, DOCUMENT | 14 tools CBM | Indexação, arquitetura, search, trace, código, detect_changes, ADRs |
| `@security-secret-auditor` | ANALYZE | read, glob, grep | Auditoria de segurança |
| `@quality-assurance-analyst` | REVIEW | write, edit, bash | Testes e qualidade |
| `@testsprite-mcp-agent` | REVIEW | bash, task, webfetch | Testes automatizados E2E |
| `@playwright-agent` | REVIEW | Playwright MCP | Testes de navegador |
| `@chrome-devtools-agent` | REVIEW | Chrome DevTools MCP | Debugging frontend |
| `@docs-architect` | DOCUMENT | write, edit, bash | Documentação técnica |
| `@google-workspace-agent` | DOCUMENT | Google Workspace MCP | Salvar docs no Drive |

### Modelo de Invocação de Sub-Agent

```markdown
Use `task` para invocar sub-agents:
task(description="Revisar spec de extrato mensal", prompt="Revise o arquivo docs/spec/extrato-mensal.spec.md...", subagent_type="spec-reviewer")
```

### Modelo de Paralelização

```markdown
# Executar em paralelo (mesmo turno):
task(description="Auditar segurança", ..., subagent_type="security-secret-auditor")
task(description="Analisar impacto", ..., subagent_type="cbm-agent")

# Aguardar ambos completarem antes de BUILD
```

## Exemplos

### Exemplo 1: Feature completa com segurança
```
/super-pipeline "Adicione um novo endpoint de extrato mensal com autenticação JWT e testes"
```

### Exemplo 2: Refatoração com análise de impacto
```
/super-pipeline "Refatore o módulo de notificações para usar filas assíncronas com RabbitMQ"
```

### Exemplo 3: Bug fix com auditoria
```
/super-pipeline "Corrija o bug de cálculo de juros e adicione logging — escopo: src/features/transactions/, prioridade: alta"
```
