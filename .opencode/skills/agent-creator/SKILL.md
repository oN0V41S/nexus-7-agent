---
name: agent-creator
description: Meta-agente que cria outros agentes. Recebe descrição em linguagem natural e gera definição de agente + skill + registro.
---

# Agent Creator Skill

Meta-agente do ecossistema Nexus. Recebe uma descrição em linguagem natural de um novo agente e orquestra a criação completa: desde a entrevista de requisitos até o registro no catálogo.

## Quando Usar Esta Skill

- O usuário diz "crie um agente que..." ou "preciso de um agente para..."
- Necessidade de um agente especializado que ainda não existe no ecossistema
- Quer escalar o ecossistema com novos sub-agents
- Precisa de um revisor/especialista para uma tecnologia específica

## Quando NÃO Usar Esta Skill

- O agente já existe (verifique em AGENTS.md)
- A tarefa é simples e não requer um agente dedicado
- O usuário está apenas explorando o ecossistema

## Workflow de Criação

### Fase 1: ENTREVISTA (Análise de Requisitos)

Use `question` para coletar as informações necessárias. Faça perguntas uma de cada vez:

#### Informações obrigatórias:

1. **Nome do agente** — Nome curto em inglês, lowercase com hífens (ex: `python-lint-reviewer`)
2. **Propósito** — Uma frase sobre o que o agente faz
3. **Modo** — `primary` (agente principal) ou `subagent` (delegável)
4. **Ferramentas necessárias** — Quais ferramentas o agente precisa (read, write, edit, bash, glob, grep, etc.)
5. **Permissões** — `allow`, `deny`, ou `ask` para cada ferramenta

#### Informações opcionais:

6. **Skills dependentes** — Outras skills que o agente deve conhecer
7. **Modelo LLM** — Modelo específico (default: claude-sonnet-4-5)
8. **Tags/Categoria** — Para organização no catálogo
9. **Exemplos de uso** — Casos de uso específicos

### Fase 2: GERAÇÃO (Criação dos Arquivos)

Use os templates para gerar os arquivos:

#### 2a. Gerar `.opencode/agents/<agent-name>.md`

```markdown
---
description: "<propósito>"
mode: <mode>
---

## <Agent Name>

<Propósito completo e contexto de atuação>

## Especialidade

<Lista de capacidades específicas>

## Quando Usar

<Quando o agente deve ser invocado>

## Quando NÃO Usar

<Quando evitar usar este agente>

## Ferramentas e Permissões

<Lista detalhada de ferramentas e regras de permissão>

## Critérios de Qualidade

<Checklist de qualidade>
```

#### 2b. Gerar `.opencode/skills/<skill-name>/SKILL.md`

Se o agente requer uma skill dedicada:

```markdown
---
name: <skill-name>
description: "<descrição>"
---

# <Skill Title> Skill

<Propósito da skill e contexto>

## Quando Usar Esta Skill

<Lista de situações>

## Workflow

<Passos do workflow>

## Ferramentas e Permissões

<Lista de ferramentas>

## Critérios de Qualidade

<Checklist>
```

#### 2c. Atualizar `opencode.json`

Adicionar entrada no `agent` e `permission`:

```json
"agent": {
  "<agent-name>": {
    "description": "<descrição>",
    "mode": "<mode>",
    "permission": {
      "<tool>": "<allow|deny|ask>"
    }
  }
}
```

#### 2d. Atualizar `AGENTS.md`

Adicionar linha na tabela de agentes:
```markdown
| `@<agent-name>` | <mode> | <descrição> |
```

Adicionar skill na tabela de skills (se aplicável).

### Fase 3: VALIDAÇÃO

Verifique cada item:

- [ ] Frontmatter YAML válido (description e mode presentes)
- [ ] Mode é `primary`, `subagent`, ou `all`
- [ ] Arquivo salvo em `.opencode/agents/<agent-name>.md`
- [ ] Skill salva em `.opencode/skills/<skill-name>/SKILL.md` (se aplicável)
- [ ] `opencode.json` atualizado com entrada no agent e permissões
- [ ] `AGENTS.md` atualizado com nova linha na tabela
- [ ] Commands atualizados (se o agente tiver comandos próprios)

### Fase 4: REGISTRO E COMMIT

1. Faça commit dos novos arquivos:
   ```bash
   git add .opencode/agents/<agent-name>.md .opencode/skills/<skill-name>/ AGENTS.md opencode.json
   git commit -m "feat: add <agent-name> agent - <propósito resumido>"
   ```

2. Apresente resumo ao usuário:
   ```
   ✅ Agente @<agent-name> criado com sucesso!
   
   📄 .opencode/agents/<agent-name>.md
   📄 .opencode/skills/<skill-name>/SKILL.md
   📄 AGENTS.md (atualizado)
   📄 opencode.json (atualizado)
   
   Para usar: task("<descrição>", "@<agent-name>")
   Ou via comando: /<comando> <args> (se configurado)
   ```

## Exemplo de Sessão

```
Usuário: "Crie um agente para revisar código Python com foco em PEP8"

1. [ENTREVISTA] Nome: "python-lint-reviewer"
   Propósito: "Revisão de código Python focando em PEP8, type hints e boas práticas"
   Modo: subagent
   Ferramentas: read, glob, grep, bash
   Permissões: edit=deny, write=deny (somente leitura)

2. [GERAÇÃO] Arquivos criados:
   - .opencode/agents/python-lint-reviewer.md
   - .opencode/skills/python-lint-review/SKILL.md

3. [VALIDAÇÃO] Frontmatter OK, permissões OK, referências OK

4. [REGISTRO] opencode.json + AGENTS.md atualizados

✅ Agente @python-lint-reviewer criado!
```

## Ferramentas Utilizadas

- `question` — entrevistar o usuário
- `read` — ler templates e arquivos existentes
- `write` — criar novos arquivos de agente/skill
- `edit` — modificar AGENTS.md e opencode.json
- `glob`/`grep` — verificar existência de agentes similares
- `bash` — git add/commit

## Critérios de Qualidade do Agente Criado

- [ ] Nome consistente (lowercase, hífens, sem espaços)
- [ ] Descrição clara do propósito (uma frase)
- [ ] Mode definido corretamente
- [ ] Ferramentas e permissões apropriadas ao escopo
- [ ] Instruções detalhadas no corpo do agente
- [ ] Skill com workflow, exemplos e critérios de qualidade (se aplicável)
- [ ] opencode.json e AGENTS.md consistentes
