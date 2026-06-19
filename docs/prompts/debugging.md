---
version: "1.0.0"
date: "2026-06-19"
author: "nexus-7-agent"
model: "deepseek-v4-flash-free"
max_tokens: 450
---

# Template: Debugging

## Instruções de Uso

Forneça apenas o erro e contexto necessário — evite colar stack traces completos.
Liste hipóteses em ordem de probabilidade.
O deepseek-v4-flash responde melhor a diagnósticos estruturados.

---

## Prompt Template

```
ERRO: {{MENSAGEM_ERRO}}
ONDE: {{ARQUIVO}}:{{LINHA}} ou {{COMANDO}}

CONTEXTO:
- O que foi feito: {{ACAO_ANTERIOR}}
- Esperado: {{COMPORTAMENTO_ESPERADO}}
- Obtido: {{COMPORTAMENTO_OBTIDO}}

HIPOTESES:
1. {{HIPOTESE_1}}
2. {{HIPOTESE_2}}

VERIFICAR:
- {{VERIFICACAO_1}}
- {{VERIFICACAO_2}}

SAIDA: Diagnóstico + correção ou próximo passo.
```

## Variáveis Obrigatórias

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{MENSAGEM_ERRO}}` | Mensagem de erro ou comportamento | TypeError: cannot read property 'id' |
| `{{ARQUIVO}}` | Arquivo onde ocorre o erro | src/tools/nexus-memory.ts |
| `{{LINHA}}` | Linha aproximada (opcional) | 42 |
| `{{COMANDO}}` | Comando que falhou (se aplicável) | npm run build |
| `{{ACAO_ANTERIOR}}` | O que o usuário tentou fazer | Adicionar validação de input |
| `{{COMPORTAMENTO_ESPERADO}}` | O que deveria acontecer | Salvar e retornar true |
| `{{COMPORTAMENTO_OBTIDO}}` | O que aconteceu de fato | Erro: undefined is not a function |
| `{{HIPOTESE_1}}` | Causa mais provável | Função await não está sendo usada |
| `{{HIPOTESE_2}}` | Causa alternativa | Parâmetro null em produção |
| `{{VERIFICACAO_1}}` | Ação de verificação sugerida | Logar input antes da chamada |
| `{{VERIFICACAO_2}}` | Segunda verificação | Rodar com --verbose |

## Exemplo Aplicado

```
ERRO: Handoff não é aplicado ao retomar sessão
ONDE: src/tools/nexus-handoff.ts:67

CONTEXTO:
- O que foi feito: Criar handoff com nexus-handoff create
- Esperado: nexus-handoff apply restaura contexto
- Obtido: "Handoff não encontrado"

HIPOTESES:
1. Arquivo salvo em path incorreto
2. ID do handoff não está sendo passado corretamente

VERIFICAR:
- Listar arquivos em .opencode/memory/handoffs/
- Conferir se apply recebe o handoffId correto

SAIDA: Diagnóstico + correção ou próximo passo.
```
