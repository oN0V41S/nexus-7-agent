---
version: "1.0.0"
date: "2026-06-19"
author: "nexus-7-agent"
model: "deepseek-v4-flash-free"
max_tokens: 400
---

# Template: Execução de Tarefa

## Instruções de Uso

Use este template para delegar tarefas a sub-agents.
Estruture em passos atômicos — cada passo deve ser autocontido.
Defina critérios de saída claros para validação.

---

## Prompt Template

```
OBJETIVO: {{OBJETIVO}}

PASSOS:
1. {{PASSO_1}}
2. {{PASSO_2}}
3. {{PASSO_3}}

VALIDAÇÃO:
- {{CRITERIO_1}}
- {{CRITERIO_2}}

ARQUIVOS:
- {{ARQUIVO_1}}
- {{ARQUIVO_2}}

SAIDA: {{SAIDA_ESPERADA}}
```

## Variáveis Obrigatórias

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{OBJETIVO}}` | Resultado final desejado | Criar skill de memória |
| `{{PASSO_1}}` | Primeira ação atômica | Criar diretório skills/mem/ |
| `{{PASSO_2}}` | Segunda ação atômica | Escrever SKILL.md |
| `{{PASSO_3}}` | Terceira ação atômica | Registrar em AGENTS.md |
| `{{CRITERIO_1}}` | Primeiro critério de sucesso | Arquivo existe e é válido |
| `{{CRITERIO_2}}` | Segundo critério de sucesso | Registro atualizado |
| `{{ARQUIVO_1}}` | Arquivo principal a modificar | .opencode/skills/mem/SKILL.md |
| `{{ARQUIVO_2}}` | Arquivo secundário | AGENTS.md |
| `{{SAIDA_ESPERADA}}` | Formato da resposta | "Concluído: 3 arquivos criados" |

## Exemplo Aplicado

```
OBJETIVO: Criar skill mem-search para consulta de memória persistente

PASSOS:
1. Criar .opencode/skills/mem-search/SKILL.md com instruções
2. Adicionar seção "mem-search" em AGENTS.md > Skills do Ecossistema
3. Validar que skill está disponível via skill tool

VALIDAÇÃO:
- SKILL.md existe e contém variáveis documentadas
- AGENTS.md atualizado com descrição

ARQUIVOS:
- .opencode/skills/mem-search/SKILL.md
- AGENTS.md

SAIDA: "Skill mem-search criada e registrada"
```
