Gera um documento de spec formal (.spec.md) no diretório `docs/spec/` seguindo o formato Spec Driven Development do Nexus.

## Fluxo

1. Use `question` para coletar TODAS as informações abaixo (se não fornecidas no prompt):
   - Título da feature
   - Problema que resolve
   - Usuário alvo
   - Requisitos funcionais (pelo menos 1)
   - Requisitos não-funcionais (se houver)
   - Critérios de aceitação por requisito
   - Casos de teste por requisito (pelo menos 1 CT por REQ)

2. Use a ferramenta `spec-validator` para validar o spec gerado.

3. Salve em `docs/spec/<feature-name-slug>.spec.md`

4. Informe ao usuário:
   - Caminho do arquivo gerado
   - Quantidade de REQs, NFRs e CTs
   - Status da validação

## Modelo de Spec (use o template em docs/spec/TEMPLATE.spec.md)

Toda spec DEVE conter:

### Frontmatter (YAML)
```yaml
---
title: "Nome da Feature"
status: "draft"
author: "Nexus Orquestrador"
created: "2026-05-13"
updated: "2026-05-13"
version: "0.1.0"
---
```

### Requisitos Funcionais (REQ-NNN)
Cada requisito DEVE ter:
- ID: REQ-001, REQ-002, etc.
- Descrição clara
- Prioridade (alta, media, baixa)
- Critérios de aceitação (lista de condições)
- Casos de teste (CT-NNN.N):
  - CT-001.1: Caminho feliz
  - CT-001.2: Cenário de erro
  - CT-001.3: Edge case (se aplicável)

### Requisitos Não-Funcionais (NFR-NNN)
Cada NFR DEVE ter:
- ID: NFR-001, etc.
- Descrição
- Métrica de medição
- Prioridade

### Validação
Sempre execute ao final:
```
Use tool: spec-validator filePath=docs/spec/<arquivo>.spec.md
```

Se houver erros de validação, corrija antes de entregar ao usuário.
