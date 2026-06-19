---
version: "1.0.0"
date: "2026-06-19"
author: "nexus-7-agent"
model: "deepseek-v4-flash-free"
max_tokens: 400
---

# Template: Revisão de Código

## Instruções de Uso

Forneça apenas o trecho relevante — não o arquivo inteiro.
Especifique os padrões esperados para que o modelo possa comparar.
O deepseek-v4-flash funciona melhor com checklists explícitos.

---

## Prompt Template

```
ARQUIVO: {{ARQUIVO}}
TRECHO:
```{{LINGUAGEM}}
{{TRECHO_CODIGO}}
```

PADRÕES ESPERADOS:
- {{PADRAO_1}}
- {{PADRAO_2}}

CHECKLIST:
- [ ] {{CHECK_1}}
- [ ] {{CHECK_2}}
- [ ] {{CHECK_3}}

CONTEXTO: {{CONTEXTO_PROJETO}}

SAIDA: Lista de issues encontradas + sugestões de correção.
```

## Variáveis Obrigatórias

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{ARQUIVO}}` | Arquivo sendo revisado | src/agents/orchestrator.ts |
| `{{LINGUAGEM}}` | Linguagem do código | typescript |
| `{{TRECHO_CODIGO}}` | Trecho relevante (máx 50 linhas) | (código) |
| `{{PADRAO_1}}` | Primeiro padrão a verificar | Uso de typed errors |
| `{{PADRAO_2}}` | Segundo padrão a verificar | Logs via nexus-log |
| `{{CHECK_1}}` | Item do checklist | Tratamento de erros presente |
| `{{CHECK_2}}` | Item do checklist | Types definidos |
| `{{CHECK_3}}` | Item do checklist | Sem secrets hardcoded |
| `{{CONTEXTO_PROJETO}}` | Contexto do ecossistema | Harness Nexus, sub-agents |

## Checklist Padrão Nexus

Use estes checks como base — adicione específicos do contexto:

- [ ] Tratamento de erros (try/catch ou error boundaries)
- [ ] Logs estruturados (nexus-log com level e category)
- [ ] Sem segredos ou chaves hardcoded
- [ ] Tipagem explícita (sem `any`)
- [ ] Compatibilidade com sub-agents existentes
- [ ] Variáveis de ambiente não expostas

## Exemplo Aplicado

```
ARQUIVO: src/tools/nexus-memory.ts
TRECHO:
```typescript
export async function save(key: string, value: string) {
  await db.put(key, value);
  return true;
}
```

PADRÕES ESPERADOS:
- Uso de nexus-log para eventos
- Validação de input

CHECKLIST:
- [ ] Validação de parâmetros
- [ ] Log de operação
- [ ] Tratamento de erro do banco

CONTEXTO: Custom tool do harness Nexus 7 Agent

SAIDA: Lista de issues + sugestões.
```
