---
description: Cria um novo agente para o ecossistema Nexus. Recebe descrição e gera definição + skill + registro.
---

Use a skill `agent-creator` para criar um novo agente no ecossistema Nexus.

$ARGUMENTS

Siga o workflow completo:
1. **ENTREVISTA** — Use `question` para coletar nome, propósito, modo, ferramentas e permissões
2. **GERAÇÃO** — Crie `.opencode/agents/<name>.md` e `.opencode/skills/<name>/SKILL.md` (se necessário)
3. **VALIDAÇÃO** — Verifique frontmatter, permissões e referências
4. **REGISTRO** — Atualize `opencode.json` e `AGENTS.md`

Ao final, apresente o resumo dos arquivos criados e ofereça commit.
