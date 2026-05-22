# Avaliação do MCP Context7 — Relatório de Análise

> **Spec:** `docs/spec/avaliacao-context7-mcp.spec.md`
> **Data:** 2026-05-21
> **Status:** Concluído

---

## 1. Mapeamento de Referências (REQ-001)

### Tabela Completa de Referências

| Arquivo | Linha | Conteúdo | Tipo |
|---------|-------|----------|------|
| `oh-my-opencode-slim.json` (openai.orchestrator) | 9 | `"mcps": ["*", "!context7"]` | Config — exclusão |
| `oh-my-opencode-slim.json` (openai.librarian) | 21 | `"mcps": ["websearch", "context7", "grep_app"]` | Config — inclusão |
| `oh-my-opencode-slim.json` (opencode-go.orchestrator) | 46 | `"mcps": ["*", "!context7"]` | Config — exclusão |
| `oh-my-opencode-slim.json` (opencode-go.librarian) | 63 | `"mcps": ["websearch", "context7", "grep_app"]` | Config — inclusão |
| `oh-my-opencode-slim.json` (nexus-hybrid.orchestrator) | 93 | `"mcps": ["*", "!context7"]` | Config — exclusão |
| `oh-my-opencode-slim.json` (nexus-hybrid.librarian) | 123 | `"mcps": ["websearch", "context7", "grep_app"]` | Config — inclusão |

### Status de Instalação

| Item | Status |
|------|--------|
| Pacote npm `@upstash/context7-mcp` | ❌ Não instalado |
| Binário `ctx7` CLI | ❌ Não disponível |
| Servidor MCP em `opencode.json` | ❌ Não configurado |
| Agente Nexus para Context7 | ❌ Não existe |
| Skills ou comandos Nexus usando Context7 | ❌ Nenhum |
| Credenciais / API key | ❌ Não configuradas |

---

## 2. Ferramentas MCP Expostas (REQ-002)

O Context7 expõe **2 ferramentas**:

| Ferramenta | Parâmetros | Finalidade |
|---|---|---|
| `resolve-library-id` | `query` (req), `libraryName` (req) | Resolve nome de lib para ID interno |
| `query-docs` | `libraryId` (req), `query` (req) | Busca documentação curada para uma library |

### Matriz de Sobreposição

| Ferramenta Nexus | Sobreposição com Context7 | Diferença |
|---|---|---|
| `websearch` | Média — ambos buscam info externa | websearch é geral; Context7 é específico para docs de libs |
| `webfetch` | Baixa — webfetch busca URL específica | Context7 resolve e consulta docs estruturadas |
| `grep_app` | Nenhuma — grep_app busca código no GitHub | Propósito totalmente diferente |

**Valor incremental do Context7:** Fornece documentação curada e versionada de bibliotecas, sem necessidade de navegar por páginas web. Útil para o agente `@librarian` quando precisa de docs atualizadas de dependências do projeto.

---

## 3. Impacto de Contexto (REQ-003)

### Tamanho das Tool Definitions

- `resolve-library-id`: ~500 bytes (2 parâmetros string)
- `query-docs`: ~500 bytes (2 parâmetros string)
- **Total: ~1 KB** adicionado ao contexto MCP

### Custo Atual vs Custo se Instalado

| Cenário | Impacto | Detalhes |
|---------|---------|----------|
| **Atual (phantom)** | Zero | Config nos presets, sem servidor MCP rodando |
| **Se instalado** | ~1 KB / tool list | Apenas quando o agente `librarian` estiver ativo |
| **Se excluído dos presets** | Zero | Remove ruído de configuração |

### Análise

Context7 é uma config **fantasma**: ocupa 0 de contexto real pois nunca foi instalado. As referências nos presets são apenas intenção de configuração — o servidor MCP em si nunca foi materializado. O custo de mantê-lo nos presets é **0 em runtime**, mas adiciona ruído de configuração (~6 linhas JSON espalhadas por 3 presets).

---

## 4. Recomendação Final

### Decisão: **REMOVER referências fantasma (REQ-004)**

**Justificativa:**

1. **Nunca foi instalado** — o pacote npm, o binário CLI e a config MCP nunca foram materializados. É pura configuração residual.
2. **Nenhum uso** — zero agentes, skills, comandos ou fluxos Nexus referenciam Context7.
3. **Sobreposição funcional** — `websearch` + `webfetch` + `grep_app` cobrem o mesmo caso de uso com ferramentas já instaladas e funcionais.
4. **Custo de ativação** — exigiria instalação npm, configuração de API key (OAuth), criação de agente Nexus, e integração em skills/ comandos. Esse esforço não se justifica dado o valor incremental marginal.
5. **Ruído de configuração** — manter referências fantasma em 3 presets confunde desenvolvedores que tentam entender o ecossistema.

### Ações Tomadas

- [x] Relatório gerado em `docs/analysis/context7-assessment.md`
- [x] Referências `"context7"` removidas dos 3 presets em `oh-my-opencode-slim.json`
- [x] Referências `"!context7"` removidas dos orchestrators (não é mais necessário excluir algo que não existe)
- [x] Backup da config original preservado

---

## 5. Questões em Aberto

- Se no futuro o `@librarian` for formalmente definido como agente Nexus e houver demanda por docs curadas de libs, Context7 pode ser reavaliado.
- Alternativas mais leves: websearch com prompt específico para docs de libs cobre o mesmo caso sem dependência externa.

---

## Apêndice: Comandos Executados

```bash
# Backup do original
cp ~/.config/opencode/oh-my-opencode-slim.json ~/.config/opencode/oh-my-opencode-slim.json.bak

# Remover referências a context7 (confirmado sem "context7" restante)
grep -c "context7" ~/.config/opencode/oh-my-opencode-slim.json
# Resultado: 0
```
