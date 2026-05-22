---
name: harness-workflow
description: Define o pipeline de 6 estágios (SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT) para orquestração de tarefas no ecossistema Nexus 7 Agent. Inclui geração e validação de spec formal (Spec Driven Development).
---

# Harness Workflow Skill

Define o pipeline de execução do ecossistema Nexus. Use esta skill sempre que o orquestrador precisar decompor uma tarefa complexa em estágios gerenciáveis com delegação a sub-agents.

## Quando Usar Esta Skill

- Tarefas que envolvem múltiplas áreas (código + segurança + testes + docs)
- Features novas que precisam passar por todo o ciclo de desenvolvimento
- Mudanças que exigem auditoria de segurança e validação de qualidade
- Qualquer tarefa que o usuário peça para executar o pipeline completo

## Quando NÃO Usar Esta Skill

- Perguntas simples ou consultas que não exigem implementação
- Correções rápidas de bugs (use o fluxo direto)
- Tarefas puramente de investigação/leitura de código

## Pipeline de 6 Estágios (SPEC + 5 originais)

### Sub-estágio 0: SPEC (Geração de Spec)

**Objetivo:** Produzir um documento de spec formal (.spec.md) antes de qualquer planejamento ou implementação.

**Atividades:**
1. **Verifique indexação CBM: se o repositório não estiver indexado, execute `index_repository` (fast mode, timeout 30s). Se falhar, continue com fallback glob/grep.**
2. Use o comando `/spec-gen` para gerar a spec a partir dos requisitos do usuário
3. **Consulte `@cbm-agent` via `task` para `get_architecture` e enriqueça a seção de Contexto da spec com módulos, entry points e dependências reais do projeto**
4. Valide a spec com a tool `spec-validator`
5. Salve em `docs/spec/<feature-name>.spec.md`
6. Apresente a spec ao usuário para aprovação ANTES de prosseguir
7. Se o usuário aprovar, mude o status para "approved" e vá para PLAN
8. Se o usuário solicitar mudanças, ajuste a spec e repita a validação

**Entregável:** `docs/spec/<feature-name>.spec.md` aprovado pelo usuário.

**Critérios (Spec Driven Development):**
- [ ] Spec contém pelo menos 1 REQ-ID
- [ ] Cada REQ-ID tem pelo menos 2 CTs (happy path + error)
- [ ] Frontmatter YAML completo (title, status, version, author)
- [ ] spec-validator retorna status "valid"
- [ ] Usuário aprovou explicitamente a spec
- [ ] Spec revisada por @spec-reviewer antes da aprovação

**Fluxo SDD (Spec Driven Development) referência:**
```
[Usuário] → Requisito → /spec-gen → docs/spec/<feature>.spec.md → @spec-reviewer → Aprovação
```

**Exemplo de mensagem de commit com SDD:**
```
feat: implement monthly report endpoint

Implements: REQ-001, REQ-002
Relates: NFR-001
Spec: docs/spec/monthly-report.spec.md
```

**Requirements Coverage Check:**
```bash
# Extrair REQ-IDs da spec:
grep -oP 'REQ-\d{3}' docs/spec/<feature>.spec.md | sort -u
# Extrair REQ-IDs referenciados nos testes:
grep -oP 'REQ-\d{3}' src/**/__tests__/**/*.test.ts | sort -u
# Comparar: os que faltam são gaps
```

### Estágio 1: PLAN

**Objetivo:** Transformar o requisito em um plano acionável.

**Atividades:**
1. Receba a descrição da tarefa do usuário
2. Use `question` para esclarecer ambiguidades:
   - Qual é o escopo exato?
   - Quais são os critérios de aceitação?
   - Há preferências de implementação?
3. **Use `task` com `@cbm-agent` para `search_graph` (descobrir funções/classes existentes) e `trace_call_path` (mapear dependências e impacto)**
4. Decomponha em tarefas atômicas mapeadas aos estágios do pipeline
5. **Inclua seção de "Arquivos Afetados" no plano baseada nos achados do CBM**
6. Identifique sub-agents necessários para cada estágio
7. Apresente o plano ao usuário e aguarde aprovação

**Entregável:** Plano estruturado aprovado pelo usuário.

### Estágio 2: ANALYZE

**Objetivo:** Analisar o código existente e identificar riscos antes de implementar.

**Atividades:**
1. Use `task` com `@cbm-agent` para análise estrutural:
   - `get_architecture` — visão geral da arquitetura (linguagens, pacotes, hotspots)
   - `search_graph` — encontrar funções/classes/rotas afetadas
   - `trace_call_path` — rastrear dependências e impacto
2. Use `glob` e `grep` para mapear arquivos existentes relacionados (fallback se CBM offline)
3. Use `read` para entender código existente que será modificado
4. Se houver dados sensíveis: use `task` com `@security-secret-auditor`
5. Se for mudança arquitetural: use skill `project-review`
6. Documente descobertas relevantes, consolidando achados do CBM com as auditorias

**Sub-agents recomendados:**
- `@security-secret-auditor` — auditoria de segurança
- Skill `project-review` — revisão arquitetural

**Entregável:** Relatório de análise com riscos identificados.

### Estágio 3: BUILD

**Objetivo:** Implementar as mudanças conforme o plano aprovado.

**Atividades:**
1. Siga o plano do Estágio 1
2. Use `read`/`write`/`edit` para modificar arquivos
3. Use `glob`/`grep` para localizar referências
4. **Use `@cbm-agent` com `get_code_snippet` para consultar código existente (fallback: glob/grep)**
5. Execute builds intermediários (`bash`) para verificar
6. Faça commits parciais como checkpoint

**Ferramentas:** `read`, `write`, `edit`, `glob`, `grep`, `bash`, `task` com `@cbm-agent`

**Entregável:** Código implementado com commits checkpoint.

### Estágio 4: REVIEW

**Objetivo:** Validar qualidade, segurança e funcionamento correto.

**Atividades:**
1. Use `bash` para executar linters: `npm run lint`, `npx tsc --noEmit`
2. Use `task` com `@quality-assurance-analyst` para testes
3. **Use `@cbm-agent` com `detect_changes` para validar que o diff cobre exatamente o escopo planejado (blast radius). Se não houver git history, pule sem falha.**
4. Verifique cobertura se aplicável
5. Reporte falhas ao usuário e aguarde decisão
6. Corrija problemas aprovados

**Sub-agents recomendados:**
- `@quality-assurance-analyst` — testes unitários, integração, cobertura
- `@cbm-agent` — `detect_changes` para validação de blast radius (opcional)

**Entregável:** Relatório de qualidade com status dos checks.

**Validação SDD (se spec existir):**
7. Se uma spec existe em `docs/spec/` para esta feature:
   - Extraia os REQ-IDs da spec
   - Verifique se os testes cobrem todos os REQ-IDs (requirements coverage)
   - Reporte requisitos sem testes como falha de qualidade
   - Se a spec tem status "approved" mas testes falham, bloqueie o pipeline

### Estágio 5: DOCUMENT

**Objetivo:** Documentar as mudanças para manutenção futura.

**Atividades:**
1. Use `task` com `@docs-architect` para documentar:
   - Novas APIs (Swagger/OpenAPI)
   - Mudanças arquiteturais (diagramas Mermaid)
   - Instruções de uso
2. **Use `@cbm-agent` com `manage_adr` para criar Architecture Decision Records das decisões tomadas (se CBM offline, pule sem falha)**
3. Atualize `AGENTS.md` se necessário (contexto do projeto)
4. Execute `/commit-&-docs` para commit final com docs

**Sub-agents recomendados:**
- `@docs-architect` — documentação técnica
- `@cbm-agent` — `manage_adr` para ADRs (opcional)

**Entregável:** Documentação atualizada + commit final.

## Ferramentas e Permissões

- **Permitidas:** `read`, `write`, `edit`, `glob`, `grep`, `bash`, `question`, `task`, `webfetch`, `websearch`, `nexus-log`, `nexus-memory`, `nexus-handoff`
- **Restrições:** use `question` antes de `write` em arquivos críticos; sempre peça aprovação para mudanças destrutivas

## Memória e Observabilidade

### Auto-Observação
O plugin Nexus registra automaticamente:
- Chamadas de ferramentas write/edit/bash em `.opencode/memory/observations/`
- Handoffs automáticos durante compactação de sessão
- Logs estruturados em `.opencode/logs/`

### Consulta de Memória
Use a skill `mem-search` para consultar sessões anteriores:
1. `nexus-memory({ action: "search", query: "termo", scope: "observations" })` — índice compacto
2. `nexus-memory({ action: "load", key: "...", scope: "observations" })` — detalhes completos
3. `nexus-handoff({ action: "apply", handoffId: "..." })` — retomar contexto

## Critérios de Qualidade

- [ ] Plano aprovado pelo usuário antes de implementar
- [ ] Análise de segurança executada para dados sensíveis
- [ ] Linters e type checking sem erros
- [ ] Testes passando (ou falhas documentadas e aprovadas)
- [ ] Documentação atualizada
- [ ] Commits descritivos e atômicos
- [ ] Memória consultada se a tarefa for continuação de trabalho anterior

## Fluxo de Iteração

Se em qualquer estágio for identificado um problema que exija volta ao estágio anterior:

```
DOCUMENT → REVIEW → BUILD → ANALYZE → PLAN → SPEC
          ↑        ↑         ↑          ↑      ↑
          └────────┴─────────┴──────────┴──────┘
```

Exemplo: se nos testes (REVIEW) um problema arquitetural for descoberto, volte ao ANALYZE ou BUILD. Se o requisito mudar, volte ao PLAN.
