---
description: Planeja uma feature ou tarefa usando o pipeline harness. Decompõe requisitos em plano de implementação.
agent: orchestrator
subtask: true
---

Crie um plano detalhado para a seguinte demanda, seguindo o pipeline harness de 6 estágios (SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT).

$ARGUMENTS

## Estrutura do Plano

1. **Estágio 0: SPEC** — Spec formal em docs/spec/, REQ-IDs, critérios de aceitação
2. **Estágio 1: PLAN** — Decomposição de REQ-IDs em tarefas, dependências
3. **Estágio 2: ANALYZE** — Arquivos a analisar, riscos de segurança, impacto arquitetural
4. **Estágio 3: BUILD** — Arquivos a modificar/criar, ordem de implementação
5. **Estágio 4: REVIEW** — Testes necessários, validação de cobertura de requisitos
6. **Estágio 5: DOCUMENT** — Documentação a atualizar

Use `question` se informações essenciais estiverem faltando (escopo, prazo, preferências técnicas).
Apresente o plano ao usuário e aguarde aprovação antes de executar.
