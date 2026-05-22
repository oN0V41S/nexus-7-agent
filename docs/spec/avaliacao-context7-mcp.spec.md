---
title: "Avaliação do MCP Context7 — Subutilização e Impacto em Contexto"
status: "draft"
author: "Orquestrador Nexus"
created: "2026-05-21"
updated: "2026-05-21"
version: "0.2.0"
status: "implemented"
---

# Avaliação do MCP Context7 — Subutilização e Impacto em Contexto — Spec

## 1. Visão Geral

**Problema:** O servidor MCP Context7 está referenciado na configuração de presets (`oh-my-opencode-slim.json`) como uma ferramenta disponível exclusivamente para o agente `librarian`, mas nunca foi instalado como servidor MCP real, não possui agente Nexus correspondente, não é referenciado em skills ou comandos, e seu propósito (busca de documentação externa de bibliotecas) pode estar causando inflação desnecessária de contexto MCP sem benefício real.

**Usuário alvo:** Desenvolvedores mantendo o ecossistema Nexus 7 Agent.

**Contexto:** O preset `nexus-hybrid` no `oh-my-opencode-slim.json` define `"mcps": ["*", "!context7"]` para o orchestrator (excluindo-o), mas `"mcps": ["websearch", "context7", "grep_app"]` para o librarian. Isso sugere que Context7 foi planejado como ferramenta de documentação externa para o librarian, mas nunca foi materializado. O binário `ctx7` não está instalado, o pacote `@upstash/context7-mcp` não está presente, e nenhuma skill ou comando Nexus o referencia.

---

## 2. Requisitos Funcionais

### REQ-001: Mapear completamente a configuração do Context7

**Descrição:** Documentar todas as referências ao Context7 no ecossistema Nexus, incluindo configurações em presets, variáveis de ambiente, credenciais, e qualquer código que o referencie.

**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Todas as referências a Context7 no workspace são catalogadas
- [ ] Configurações em `oh-my-opencode-slim.json` são documentadas
- [ ] Presença/ausência de credenciais (API keys) é verificada
- [ ] Presença/ausência do binário `ctx7` é verificada
- [ ] Presença/ausência de pacotes npm é verificada

**Casos de Teste:**
- `CT-001.1`: Verificar que o relatório lista todos os arquivos com referências a Context7 em formato de tabela (Arquivo, Linha, Conteúdo, Tipo)
- `CT-001.2`: Verificar que o relatório documenta o status de instalação (não instalado)

---

### REQ-002: Mapear ferramentas MCP expostas pelo Context7

**Descrição:** Identificar quantas e quais ferramentas MCP o Context7 expõe, e avaliar se há sobreposição com ferramentas existentes (especialmente `webfetch`, `grep_app`, `websearch`).

**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Lista de ferramentas Context7 documentada (resolve-library-id, query-docs)
- [ ] Avaliação de sobreposição com ferramentas existentes
- [ ] Análise de valor incremental que Context7 traria

**Casos de Teste:**
- `CT-002.1`: Verificar documentação das 2 ferramentas Context7
- `CT-002.2`: Verificar matriz de sobreposição com webfetch/websearch/grep_app

---

### REQ-003: Avaliar impacto de contexto MCP

**Descrição:** Medir o impacto real que ativar o Context7 teria no tamanho do contexto MCP, comparando com o custo de mantê-lo como configuração fantasma.

**Prioridade:** Média
**Critérios de Aceitação:**
- [ ] Tamanho estimado das tool definitions do Context7 é documentado
- [ ] Comparação com o custo atual (apenas no preset, sem instalação) é feita
- [ ] Recomendação clara: ativar, remover, ou manter como está

**Casos de Teste:**
- `CT-003.1`: Verificar que o relatório inclui recomendação com justificativa
- `CT-003.2`: Verificar que o relatório documenta o tamanho estimado das tool definitions do Context7 e compara com o custo de mantê-lo como configuração fantasma

---

> **Nota sobre REQ-004 e REQ-005:** Estes requisitos são **mutuamente exclusivos** — apenas UM deve ser implementado, com base na recomendação do REQ-003. Se REQ-005 for recomendado, sua prioridade deve ser reavaliada para Média ou Alta.

### REQ-004: (Se recomendado) Remover referências fantasma do Context7

**Descrição:** Se a análise concluir que Context7 não agrega valor, remover todas as referências a ele nos presets do `oh-my-opencode-slim.json`.

**Prioridade:** Média
**Critérios de Aceitação (se aplicável):**
- [ ] `"context7"` removido das listas `mcps` nos presets
- [ ] Nenhuma referência residual a Context7 nos arquivos de configuração
- [ ] Backup da configuração original é preservado

**Casos de Teste:**
- `CT-004.1`: Verificar que `oh-my-opencode-slim.json` não contém "context7"
- `CT-004.2`: Verificar que os presets continuam válidos (json schema)

---

### REQ-005: (Se recomendado) Instalar e ativar Context7

**Descrição:** Se a análise concluir que Context7 agrega valor (especialmente para o agente librarian), instalar o servidor MCP, criar agente Nexus correspondente, e integrar ao workflow.

**Prioridade:** Baixa
**Critérios de Aceitação (se aplicável):**
- [ ] `@upstash/context7-mcp` instalado
- [ ] `ctx7` CLI funcional
- [ ] Servidor MCP configurado em `opencode.json`
- [ ] Agente `@context7-agent` ou `@librarian` atualizado
- [ ] Skill ou comando Nexus criado para usar Context7

**Casos de Teste:**
- `CT-005.1`: Verificar que `ctx7` CLI retorna ajuda sem erro
- `CT-005.2`: Verificar que MCP server está listado em `opencode.json`
- `CT-005.3`: Verificar que agente consegue chamar `query-docs`

---

## 3. Requisitos Não-Funcionais

### NFR-001: Análise baseada em evidências

**Descrição:** Todas as recomendações devem ser baseadas em evidências do código e configuração, não suposições.
**Métrica:** Cada recomendação deve referenciar arquivos e linhas específicos.
**Prioridade:** Alta
**Casos de Teste:**
- `CT-NFR-001.1`: Verificar que cada recomendação no relatório referencia arquivo:linha específicos

---

### NFR-002: Não quebrar configuração existente

**Descrição:** Qualquer mudança nos presets deve preservar a validade do JSON e não afetar outros MCPs configurados.
**Métrica:** `jq . oh-my-opencode-slim.json` não falha após mudanças.
**Prioridade:** Alta
**Casos de Teste:**
- `CT-NFR-002.1`: Executar `jq .` no JSON modificado e confirmar saída sem erros

---

## 4. Entregáveis

O principal entregável desta spec é um **relatório de análise** em markdown, salvo em `docs/analysis/context7-assessment.md`, contendo:
- Tabela completa de referências a Context7 (arquivo, linha, conteúdo, tipo)
- Lista de ferramentas MCP expostas
- Matriz de sobreposição com ferramentas existentes
- Análise de impacto de contexto
- Recomendação final (ativar, remover, ou manter)
- Justificativa baseada em evidências

## 5. Dependências

- `oh-my-opencode-slim.json` — arquivo de presets (fora do workspace, em ~/.config/opencode/)
- Potencialmente: `opencode.json` — se REQ-005 for recomendado
- Potencialmente: `@upstash/context7-mcp` — pacote npm (se REQ-005)

## 6. Questões em Aberto

- O Context7 requer API key? (provavelmente sim — OAuth via `npx ctx7 setup`)
- Há budget/custo para chamadas externas de API?
- O librarian sequer existe como agente Nexus? (não há `.opencode/agents/librarian.md`)
- Context7 é um candidato a entrar na tool list do `@librarian` — mas o `@librarian` não está formalmente definido como agente Nexus

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 0.1.0 | 2026-05-21 | Orquestrador Nexus | Criação inicial |
| 0.2.0 | 2026-05-21 | Orquestrador Nexus | Adicionado CT-003.2, CTs NFR, nota de exclusividade REQ-004/005, especificado formato do relatório |
