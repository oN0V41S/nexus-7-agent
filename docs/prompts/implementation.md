---
version: "1.0.0"
date: "2026-06-19"
author: "nexus-7-agent"
model: "deepseek-v4-flash-free"
max_tokens: 500
---

# Template: Implementação de Código

## Instruções de Uso

Substitua as variáveis `{{VARIAVEL}}` pelos valores reais antes de enviar ao modelo.
Mantenha o contexto mínimo — o deepseek-v4-flash opera melhor com prompts enxutos.
Inclua apenas o código relevante, não o arquivo inteiro.

---

## Prompt Template

```
CONTEXTO: {{PROJETO}} - {{COMPONENTE}}
TAREFA: {{ACAO}} em {{ARQUIVO}}

CÓDIGO ATUAL:
```{{LINGUAGEM}}
{{CODIGO_ATUAL}}
```

REQUISITOS:
1. {{REQUISITO_1}}
2. {{REQUISITO_2}}

RESTRICOES:
- Manter compatibilidade com {{COMPATIBILIDADE}}
- Seguir padrão: {{PADRAO}}
- Não alterar: {{NAO_ALTERAR}}

SAIDA: Apenas o código modificado. Sem explicações.
```

## Variáveis Obrigatórias

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{PROJETO}}` | Nome do projeto | nexus-7-agent |
| `{{COMPONENTE}}` | Módulo ou feature | orchestrator |
| `{{ACAO}}` | Tipo de alteração | refatorar, adicionar, corrigir |
| `{{ARQUIVO}}` | Path do arquivo | src/agents/orchestrator.ts |
| `{{LINGUAGEM}}` | Linguagem/ts do código | typescript |
| `{{CODIGO_ATUAL}}` | Trecho relevante do código | (máx 30 linhas) |
| `{{REQUISITO_1}}` | Primeiro requisito | aceitar payload JSON |
| `{{REQUISITO_2}}` | Segundo requisito | logar erros via nexus-log |
| `{{COMPATIBILIDADE}}` | Restrição de compatibilidade | API v2 |
| `{{PADRAO}}` | Padrão a seguir | SOLID, Clean Architecture |
| `{{NAO_ALTERAR}}` | Parte intocável | interface pública |

## Exemplo Aplicado

```
CONTEXTO: nexus-7-agent - custom tools
TAREFA: adicionar validação em src/tools/nexus-memory.ts

CÓDIGO ATUAL:
```typescript
export async function save(key: string, value: string) {
  await db.put(key, value);
}
```

REQUISITOS:
1. Validar key não-vazia
2. Limitar value a 10KB

RESTRICOES:
- Manter compatibilidade com interface existente
- Não alterar assinatura da função

SAIDA: Apenas o código modificado.
```
