Inicia o pipeline harness de 5 estágios (PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT) para a tarefa descrita.

Use este comando quando o orquestrador precisar iniciar um ciclo completo do pipeline ou quando uma tarefa complexa exigir múltiplos estágios.

## Fluxo

1. Carregue a skill `harness-workflow`
2. Execute o Estágio 1 (PLAN): entenda o requisito, faça perguntas, crie o plano
3. Apresente o plano ao usuário para aprovação
4. Execute estágios seguintes conforme o plano aprovado
5. Use question a cada transição de estágio se precisar de input do usuário

## Exemplos

/pipeline Adicione um novo endpoint de extrato mensal com autenticação e testes
/pipeline Corrija o bug de cálculo de juros e adicione logging
/pipeline Refatore o módulo de notificações para usar filas assíncronas
