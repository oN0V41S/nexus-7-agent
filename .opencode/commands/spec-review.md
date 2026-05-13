---
description: "Revisa um documento de spec (.spec.md) quanto a completude, consistência e testabilidade"
agent: spec-reviewer
subtask: true
---

Revise o documento de spec em `$ARGUMENTS` seguindo o workflow do agente @spec-reviewer.

## Estrutura do Relatório

Retorne:

### Sumário
- Arquivo revisado
- Status geral (✅ Aprovada | ⚠️ Ajustes | ❌ Rejeitada)
- Total de REQs, NFRs, CTs encontrados

### Issues por Severidade

**Critical** (bloqueante):
- Frontmatter inválido/incompleto
- REQ sem CTs
- CT referencia REQ inexistente

**Major** (deve corrigir):
- REQ sem critérios de aceitação
- NFR sem métrica
- Prioridade não definida

**Minor** (sugestão):
- Apenas 1 CT por REQ (mínimo recomendado: 2)
- Descrições muito curtas

### Recomendação
- ✅ Approved: sem issues críticas ou major
- ⚠️ Changes Requested: issues major presentes
- ❌ Rejected: issues críticas presentes
