---
description: Executa o plano gerado por /plan etapa por etapa, guiando o usuário sem editar arquivos de código. Atualiza checklist de progresso no plano.
agent: orchestrator
subtask: true
---

# /plan-execute — Executar Plano Etapa a Etapa

## Propósito
Pega o plano gerado pelo `/plan` (ou arquivo em `docs/plans/`) e guia o usuário através de cada estágio do pipeline harness (SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT), **sem editar nenhum arquivo de código**. Apenas:
1. Apresenta a tarefa do estágio atual de forma resumida
2. Pergunta se o usuário quer prosseguir, pular ou ver detalhes
3. Atualiza o checklist de progresso no arquivo do plano

## Como Usar

```bash
# Executa o último plano gerado
/plan-execute

# Executa um plano específico
/plan-execute docs/plans/minha-feature-plan.md

# Executa a partir de um estágio específico
/plan-execute --stage BUILD
```

## Fluxo de Execução

### 1. Carregar Plano
- Se nenhum arquivo especificado, procura o mais recente em `docs/plans/*.md`
- Se não encontrar, pergunta ao usuário qual plano usar
- Lê o plano e identifica os estágios (SPEC, PLAN, ANALYZE, BUILD, REVIEW, DOCUMENT)

### 2. Para Cada Estágio (em ordem)

#### A. Apresentar Resumo do Estágio
```
═══════════════════════════════════════
📋 ESTÁGIO: BUILD (3/6)
═══════════════════════════════════════

🎯 Objetivo: Implementar REQ-001, REQ-002, REQ-003

📝 Tarefas:
  ☐ REQ-001: Criar endpoint GET /api/reports/monthly
  ☐ REQ-002: Adicionar validação de parâmetros de query
  ☐ REQ-003: Implementar cache Redis com TTL 5min

🔧 Sub-agents sugeridos: @fixer (tarefas isoladas), @cbm-agent (get_code_snippet)

📁 Arquivos a modificar (do plano):
  - src/routes/reports.ts
  - src/services/report-service.ts
  - src/cache/redis-client.ts

⚠️  Riscos identificados (do ANALYZE):
  - Cache invalidation race condition
  - Rate limiting no endpoint público
```

#### B. Perguntar Ação do Usuário
Use `question` com opções:
- **▶ Prosseguir** — Iniciar este estágio (delega para sub-agents se necessário)
- **⏭ Pular** — Marcar como concluído e ir para o próximo
- **🔍 Ver detalhes** — Mostrar seção completa do plano para este estágio
- **⏸ Pausar** — Salvar progresso e sair (cria handoff)
- **↩ Voltar** — Retornar ao estágio anterior

#### C. Se "Prosseguir":
- **Estágios SPEC/PLAN/ANALYZE/REVIEW/DOCUMENT**: Delegar para sub-agents apropriados via `task`
- **Estágio BUILD**: Informar que a implementação deve ser feita manualmente ou via `/super-pipeline`; este comando apenas marca progresso
- Atualizar checklist no arquivo do plano (marcar tarefas como `[x]`)
- Log: `nexus-log level=info message="Estágio BUILD iniciado" category=pipeline`

#### D. Se "Pular":
- Marcar todas as tarefas do estágio como `[x]`
- Log: `nexus-log level=info message="Estágio BUILD pulado pelo usuário" category=pipeline`

### 3. Atualização do Checklist no Arquivo do Plano

O plano deve ter seções com checkboxes. Exemplo de formato:

```markdown
## Estágio 3: BUILD

### Tarefas
- [ ] REQ-001: Criar endpoint GET /api/reports/monthly
- [ ] REQ-002: Adicionar validação de parâmetros de query
- [ ] REQ-003: Implementar cache Redis com TTL 5min

### Sub-agents
- @fixer para tarefas isoladas
- @cbm-agent para get_code_snippet

### Arquivos Afetados
- src/routes/reports.ts
- src/services/report-service.ts
- src/cache/redis-client.ts
```

Ao marcar progresso, edite o arquivo do plano trocando `[ ]` por `[x]`.

### 4. Finalização
Quando todos os estágios estiverem concluídos:
- Mostrar resumo final
- Perguntar se deseja executar `/commit-&-docs`
- Criar handoff com `nexus-handoff` para retomada futura

## Regras Importantes

| Regra | Descrição |
|-------|-----------|
| **NÃO edite código** | Este comando NUNCA usa `write`, `edit`, `bash` para modificar arquivos de código |
| **SIM edite o plano** | Use `edit` para atualizar checkboxes `[ ]` → `[x]` no arquivo do plano |
| **Delegue execução** | Para SPEC/PLAN/ANALYZE/REVIEW/DOCUMENT, use `task` com sub-agents |
| **BUILD é manual** | Para BUILD, apenas oriente; a implementação real é fora deste comando |
| **Progresso persistido** | Checklist salvo no arquivo do plano serve como estado |

## Sub-Agents por Estágio

| Estágio | Sub-Agent | Comando/Action |
|---------|-----------|----------------|
| SPEC | @spec-reviewer + @cbm-agent | Revisar spec, get_architecture |
| PLAN | @orchestrator + @cbm-agent | search_graph, trace_call_path |
| ANALYZE | @security-secret-auditor + @cbm-agent | Auditoria + análise arquitetural |
| BUILD | (manual / @fixer) | Implementação guiada |
| REVIEW | @quality-assurance-analyst + @cbm-agent | Testes + detect_changes |
| DOCUMENT | @docs-architect + @cbm-agent | Docs + manage_adr |

## Exemplo de Uso

```bash
# 1. Gerar plano
/plan "Adicionar endpoint de relatório mensal com cache Redis"

# 2. Executar plano passo a passo
/plan-execute

# Fluxo interativo:
# 📋 ESTÁGIO: SPEC (1/6) - Gerar spec formal
#    ▶ Prosseguir  ⏭ Pular  🔍 Ver detalhes  ⏸ Pausar
# > Prosseguir
#    → Delegando @spec-reviewer para revisar spec...
#    → Spec aprovada! Checklist atualizado.
#
# 📋 ESTÁGIO: PLAN (2/6) - Planejar implementação
#    ▶ Prosseguir  ⏭ Pular  🔍 Ver detalhes  ⏸ Pausar
# > Prosseguir
#    → Delegando @cbm-agent para search_graph...
#    → Plano aprovado! Checklist atualizado.
#
# ...e assim por diante
```

## Comandos Relacionados

- `/plan` — Gerar novo plano
- `/super-pipeline` — Pipeline completo automatizado (este comando é o modo "guiado manual")
- `/commit-&-docs` — Commit final com documentação
- `nexus-handoff` — Salvar/carregar progresso entre sessões