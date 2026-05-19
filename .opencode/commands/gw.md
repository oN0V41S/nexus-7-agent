---
description: "Executa operações no Google Workspace (Drive, Docs, Sheets, Gmail). Delega ao @google-workspace-agent."
agent: google-workspace-agent
subtask: true
---

Execute uma operação no Google Workspace usando os argumentos fornecidos em `$ARGUMENTS`.

## Modos de Uso

### Drive
```
/gw drive list
/gw drive search "relatório mensal"
/gw drive read 1abc123def456
/gw drive create "notas.md" "# Notas da reunião\n\n- Item 1\n- Item 2"
/gw drive upload "dados.csv" "nome,email\nJoao,joao@email.com"
/gw drive delete 1abc123def456 --confirm
```

### Docs
```
/gw docs create "Relatório Q1" "Resumo do trimestre..."
/gw docs read 1abc123def456
/gw docs append 1abc123def456 "\n\nAtualização: ..."
```

### Sheets
```
/gw sheets create "Vendas 2026" "Produto,Quantidade,Valor"
/gw sheets append 1abc123def456 [["Camiseta","10","50.00"],["Calça","5","80.00"]]
/gw sheets read 1abc123def456 "A1:C100"
```

### Gmail
```
/gw gmail search "from:cliente subject:pedido"
/gw gmail send "joao@email.com" "Relatório Q1" "Segue o relatório..."
/gw gmail thread 1abc123def456
```

## Fluxo

1. Interprete o comando e identifique o serviço (drive, docs, sheets, gmail)
2. Mapeie para a tool MCP correspondente
3. Execute via MCP server local
4. Apresente os resultados formatados

## MCP Server

O servidor MCP está em: `/workspaces/nexus-7-agent/.opencode/mcp/google-workspace/server.mjs`

Para testar uma tool diretamente:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"drive_list","arguments":{"pageSize":5}}}' | timeout 15 node /workspaces/nexus-7-agent/.opencode/mcp/google-workspace/server.mjs 2>/dev/null
```

## Exemplos

**Comando:** `/gw drive list`
**Resposta:** Lista dos 10 arquivos mais recentes do Drive com nome, tipo, data e link.

**Comando:** `/gw docs create "Meeting Notes" "Discussão sobre..."`
**Resposta:** Documento criado com link para edição.

**Comando:** `/gw gmail search "is:unread"`
**Resposta:** Lista dos 5 emails não lidos mais recentes.
