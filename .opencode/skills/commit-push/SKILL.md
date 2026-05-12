---
name: commit-push
description: Formaliza o fluxo de commit com documentação e push, integrado ao comando /commit-&-docs do ecossistema Nexus.
---

# Commit & Push Skill

Habilita o fluxo completo de versionamento: verificar estado, preparar commit, documentar mudanças, commitar e fazer push.

## Quando Usar Esta Skill

- Ao finalizar uma tarefa do pipeline (estágio BUILD ou DOCUMENT)
- Quando o usuário solicitar um commit explícito
- Após atualizações de documentação que precisam ser versionadas
- Para fazer checkpoint de progresso durante implementações longas

## Quando NÃO Usar Esta Skill

- Durante análise ou planejamento (sem código para commitar)
- Em tarefas puramente exploratórias sem alterações

## Workflow de Commit e Push

### Fase 1: Verificação de Estado

1. Execute `git status` para verificar modified e untracked files
2. Execute `git diff --stat` para entender a dimensão das mudanças
3. Analise se as mudanças envolvem documentação (arquivos `.md`, `docs/`)
4. Verifique se há secrets ou arquivos sensíveis no staged (`.env`, `credentials.json`)

### Fase 2: Preparação da Mensagem

1. Analise o diff para entender o "porquê" da mudança (não apenas o "o quê")
2. Siga o padrão de commits do repositório:
   - Commits descritivos e atômicos (uma feature/correção por commit)
   - Linguagem: Português (padrão do projeto) ou Inglês (consistente com histórico)
3. Formato recomendado:
   ```
   <tipo>: <descrição concisa>

   <corpo opcional com detalhes>
   ```

### Fase 3: Atualização de Documentação (se aplicável)

Se as alterações feitas concluírem ou mudarem o estado de alguma tarefa na documentação:
1. Atualize `AGENTS.md` se o escopo do projeto mudou
2. Atualize skills, agentes ou comandos se foram modificados
3. Atualize `README.md` se necessário
4. Use o comando `/commit-&-docs` que automatiza este fluxo

### Fase 4: Commit

```bash
git add <arquivos-relevantes>
git commit -m "<mensagem descritiva>"
```

### Fase 5: Push (se autorizado)

Após o commit bem-sucedido:
1. Verifique se o remote está configurado: `git remote -v`
2. Confirme com o usuário antes de fazer push
3. Execute: `git push`

## Comando Relacionado

Use `/commit-&-docs` para o fluxo simplificado:
- Se houver mudanças na documentação → atualiza docs + commit
- Se não → apenas commit

## Critérios de Qualidade

- [ ] Verificou se há secrets antes de staging
- [ ] Mensagem de commit descritiva (explica o "porquê")
- [ ] Commits atômicos (não misturar features não relacionadas)
- [ ] Documentação atualizada se houve mudança de escopo
- [ ] Push confirmado com o usuário
- [ ] `git status` após commit mostra working tree limpo
