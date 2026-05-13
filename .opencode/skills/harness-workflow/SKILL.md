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
1. Use o comando `/spec-gen` para gerar a spec a partir dos requisitos do usuário
2. Valide a spec com a tool `spec-validator`
3. Salve em `docs/spec/<feature-name>.spec.md`
4. Apresente a spec ao usuário para aprovação ANTES de prosseguir
5. Se o usuário aprovar, mude o status para "approved" e vá para PLAN
6. Se o usuário solicitar mudanças, ajuste a spec e repita a validação

**Entregável:** `docs/spec/<feature-name>.spec.md` aprovado pelo usuário.

**Critérios:**
- [ ] Spec contém pelo menos 1 REQ-ID
- [ ] Cada REQ-ID tem pelo menos 2 CTs (happy path + error)
- [ ] Frontmatter YAML completo (title, status, version, author)
- [ ] spec-validator retorna status "valid"
- [ ] Usuário aprovou explicitamente a spec

### Estágio 1: PLAN

**Objetivo:** Transformar o requisito em um plano acionável.

**Atividades:**
1. Receba a descrição da tarefa do usuário
2. Use `question` para esclarecer ambiguidades:
   - Qual é o escopo exato?
   - Quais são os critérios de aceitação?
   - Há preferências de implementação?
3. Decomponha em tarefas atômicas mapeadas aos estágios do pipeline
4. Identifique sub-agents necessários para cada estágio
5. Apresente o plano ao usuário e aguarde aprovação

**Entregável:** Plano estruturado aprovado pelo usuário.

### Estágio 2: ANALYZE

**Objetivo:** Analisar o código existente e identificar riscos antes de implementar.

**Atividades:**
1. Use `glob` e `grep` para mapear arquivos existentes relacionados
2. Use `read` para entender código existente que será modificado
3. Se houver dados sensíveis: use `task` com `@security-secret-auditor`
4. Se for mudança arquitetural: use skill `project-review`
5. Documente descobertas relevantes

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
4. Execute builds intermediários (`bash`) para verificar
5. Faça commits parciais como checkpoint

**Ferramentas:** `read`, `write`, `edit`, `glob`, `grep`, `bash`

**Entregável:** Código implementado com commits checkpoint.

### Estágio 4: REVIEW

**Objetivo:** Validar qualidade, segurança e funcionamento correto.

**Atividades:**
1. Use `bash` para executar linters: `npm run lint`, `npx tsc --noEmit`
2. Use `task` com `@quality-assurance-analyst` para testes
3. Verifique cobertura se aplicável
4. Reporte falhas ao usuário e aguarde decisão
5. Corrija problemas aprovados

**Sub-agents recomendados:**
- `@quality-assurance-analyst` — testes unitários, integração, cobertura

**Entregável:** Relatório de qualidade com status dos checks.

**Validação SDD (se spec existir):**
6. Se uma spec existe em `docs/spec/` para esta feature:
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
2. Atualize `AGENTS.md` se necessário (contexto do projeto)
3. Execute `/commit-&-docs` para commit final com docs

**Sub-agents recomendados:**
- `@docs-architect` — documentação técnica

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
