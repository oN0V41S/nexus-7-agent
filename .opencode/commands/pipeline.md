Inicia o pipeline harness de 6 estágios (SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT) para a tarefa descrita, começando pela geração de spec formal.

Use este comando quando o orquestrador precisar iniciar um ciclo completo do pipeline ou quando uma tarefa complexa exigir múltiplos estágios.

## Fluxo

1. Carregue a skill `harness-workflow`
2. Execute o Sub-estágio 0 (SPEC): use `/spec-gen` para gerar spec formal
3. Execute o Estágio 1 (PLAN): use a spec aprovada para criar o plano
4. Apresente o plano ao usuário para aprovação
5. Execute estágios seguintes conforme o plano aprovado
6. Use question a cada transição de estágio se precisar de input do usuário

## Exemplos

/pipeline Adicione um novo endpoint de extrato mensal com autenticação e testes (gera spec automática)
/pipeline Corrija o bug de cálculo de juros e adicione logging (especifique REQ-IDs afetados)
/pipeline Refatore o módulo de notificações para usar filas assíncronas
