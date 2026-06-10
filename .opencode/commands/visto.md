---
description: "Automação no Visto DAM — login, busca, filtros, permissões. Delega ao @playwright-agent."
agent: playwright-agent
subtask: true
---

Execute uma operação no Visto DAM usando os argumentos fornecidos em `$ARGUMENTS`.

## Modos de Uso

### Session Management
```
/visto login          → Executa login completo (requer 2FA manual)
/visto session        → Verifica se sessão ainda é válida
```

### Busca e Navegação
```
/visto search "OP_FA_Ciclo12-26_0076.jpg"  → Busca imagem no DAM
/visto open "OP_FA_Ciclo12-26_0076.jpg"    → Busca e abre detalhes da imagem
```

### Filtros
```
/visto filter status "Ativos"              → Filtra por status
/visto filter status "Ativos" --open "image.jpg" → Filtra e abre imagem
```

### Permissões
```
/visto permissions "image.jpg"             → Aba de permissões da imagem
/visto permissions add "image.jpg" "Natura Liberado Sim" "Retocado Sim" → Adiciona permissões
```

### Clonagem de Licenças
```
/visto clone "PE_Ciclo12-26_1015" "PE_Ciclo12-26_1016"  → Pipeline completo: extrair + adicionar
/visto extract "PE_Ciclo12-26_1015"                      → Apenas extrair licenças para JSON
```

## Fluxo

1. Interprete o comando e identifique a operação
2. Verifique sessão com `visto-login.mjs verify` (se inválida, execute login)
3. Execute a operação via Playwright MCP
4. Apresente resultados com screenshots se aplicável

## Scripts Base

| Script | Função | Execução |
|--------|--------|----------|
| `visto-login.mjs` | Gerenciamento de sessão (login/verify) | `node .playwright-mcp/visto-login.mjs` |
| `extrair-licencas.mjs` | Extrai licenças da imagem → JSON | `node .playwright-mcp/extrair-licencas.mjs <imagem>` |
| `adicionar-licencas.mjs` | Lê JSON e adiciona licenças via modal | `node .playwright-mcp/adicionar-licencas.mjs <json> <imagem>` |
| `visto-clonagem-licenca.mjs` | **Orquestrador**: session → extract → add → validate | `node .playwright-mcp/visto-clonagem-licenca.mjs <antiga> <nova>` |
| `visto-select-verify-confirm.mjs` | Automação de permissões (referência) | — |

### Dados

- **Sessão:** `.playwright-mcp/.visto-session.json` (não commitar)
- **Licenças extraídas:** `data/licencas/licencas-{imagem}-{timestamp}.json`
- **Relatório de clonagem:** `data/licencas/relatorio-{antiga}-{nova}-{timestamp}.json`
- **Logs harness:** `.opencode/logs/visto-pipeline-{YYYY-MM-DD}.log`
- **Screenshots:** `.playwright-mcp/.visto-*.png`

## Skill Relacionada

Carregue a skill `visto-automation` para padrões de interação (react-select, modais, etc).

## Exemplos

**Comando:** `/visto session`
**Resposta:** "Sessão válida" ou "Sessão expirada — execute /visto login"

**Comando:** `/visto search "OP_FA_Ciclo12-26_0076.jpg"`
**Resposta:** Lista de resultados da busca com thumbnails.

**Comando:** `/visto permissions add "image.jpg" "Natura Liberado Sim" "Retocado Sim"`
**Resposta:** "Permissões adicionadas com sucesso" + screenshot da confirmação.

**Comando:** `/visto extract "PE_Ciclo12-26_1015"`
**Resposta:** JSON com licenças extraídas salvo em `data/licencas/`.

**Comando:** `/visto clone "FOT-CST-PER-FEM-ILIA-CICLO-11-2026-125968" "PE_Ciclo12-26_1002"`
**Resposta:** Pipeline completo com validação formatada:

```
[1] [Direito de Uso de Imagem], [28/05/2026 - 28/05/2031], [Argentina], [Comercial, Institucional], [Aplicativos Natura, Casa Natura, Catálogo... (+3)]
[2] [Contrato de Direito de Uso de Imagem Internacional], [...], [...], [...], [...]
...
✅ CLONAGEM CONCLUÍDA COM SUCESSO!
```

## Artefatos

| Após comando | Artefato | Local |
|---|---|---|
| `/visto extract` | JSON com licenças | `data/licencas/licencas-{imagem}-*.json` |
| `/visto clone` | Relatório + logs + sumário | `data/licencas/relatorio-*.json` + `.opencode/logs/visto-pipeline-*.log` |
