---
name: spec-driven-dev
description: "Skill de Spec Driven Development para o ecossistema Nexus. Guia o fluxo completo de spec-first: geração, revisão, implementação referenciada e validação de cobertura de requisitos."
---

# Spec Driven Development Skill

Define o fluxo de Spec Driven Development no ecossistema Nexus. Use esta skill sempre que for iniciar um novo desenvolvimento que deve seguir o princípio de "spec first, code second".

## Quando Usar Esta Skill

- Iniciar uma nova feature ou módulo
- Fazer mudanças que afetam múltiplos componentes
- Qualquer tarefa que o orquestrador inicia via `/pipeline`
- Quando o usuário explicitamente pede SDD

## Quando NÃO Usar Esta Skill

- Correções rápidas de bugs (use fluxo direto, mas considere criar spec se o bug for complexo)
- Refatorações sem mudança de comportamento
- Tarefas puramente de investigação

## Fluxo SDD

### Fase 1: SPEC

```
[Usuário] → Requisito → /spec-gen → docs/spec/<feature>.spec.md → @spec-reviewer → Aprovação
```

1. Receba o requisito do usuário
2. Use `/spec-gen` para produzir `docs/spec/<feature>.spec.md`
3. O spec-gen usa `question` para preencher lacunas
4. Valide com `spec-validator filePath=docs/spec/<arquivo>`
5. Se válido, submeta ao `@spec-reviewer` para revisão
6. Apresente ao usuário para aprovação final
7. Mude status para "approved" no frontmatter

### Fase 2: PLAN

```
docs/spec/<feature>.spec.md → Decomposição em tarefas → Plano com REQ-IDs
```

1. Leia a spec aprovada
2. Para cada REQ-ID, crie uma tarefa de implementação
3. Para cada NFR-ID, crie uma tarefa de verificação
4. Ordene tarefas por dependências entre REQs
5. Cada commit deve referenciar REQ-IDs implementados

### Fase 3: IMPLEMENT

```
Tarefa com REQ-ID → Implementação → Teste → Commit com REQ-ID
```

1. Implemente o código para cada REQ-ID
2. Escreva testes que validam os CTs da spec
3. Nomeie testes referenciando CT-IDs: `describe('REQ-001: ...')`
4. Commit com mensagem contendo `Implements: REQ-001, REQ-002`

### Fase 4: VERIFY

```
Código + Testes → Requirements Coverage → Validação contra spec
```

1. Execute todos os testes
2. Extraia REQ-IDs referenciados nos testes (via `describe('REQ-NNN:`)
3. Compare com REQ-IDs da spec: cobertura = reqs testados / reqs totais
4. Se cobertura < 100%, reporte quais REQs faltam
5. Atualize status da spec para "implemented"

### Fase 5: DOCUMENT

```
Spec atualizada → Documentação derivada → Commit final
```

1. Atualize a spec com informações de implementação (se necessário)
2. Gere documentação referenciando REQ-IDs
3. Commit final com `/commit-&-docs`

## Exemplo de Mensagem de Commit

```
feat: implement monthly report endpoint

Implements: REQ-001, REQ-002
Relates: NFR-001
Spec: docs/spec/monthly-report.spec.md
```

## Verificação de Requirements Coverage

Para verificar se todos os requisitos foram implementados:

```bash
# Extrair REQ-IDs da spec:
grep -oP 'REQ-\d{3}' docs/spec/<feature>.spec.md | sort -u

# Extrair REQ-IDs referenciados nos testes:
grep -oP 'REQ-\d{3}' src/**/__tests__/**/*.test.ts | sort -u

# Comparar: os que faltam são gaps
```

## Critérios de Qualidade

- [ ] Spec gerada antes de qualquer código
- [ ] Spec revisada por @spec-reviewer
- [ ] Spec aprovada pelo usuário
- [ ] Cada REQ-ID tem testes correspondentes
- [ ] Commits referenciam REQ-IDs
- [ ] Requirements coverage = 100%
- [ ] Spec atualizada ao final (status = implemented)
