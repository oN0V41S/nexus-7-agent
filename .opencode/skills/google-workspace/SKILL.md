---
name: google-workspace
description: "Acessar e manipular Google Workspace (Drive, Docs, Sheets, Gmail) via MCP server local com OAuth 2.0. Cria, lê, edita e gerencia documentos no ecossistema Google."
---

# Google Workspace Skill

Skill para usar o MCP server local `google-workspace` para interagir com o ecossistema Google Workspace. Fornece **15 ferramentas MCP** para Drive, Docs, Sheets e Gmail, com autenticação OAuth 2.0 e refresh automático de tokens.

## Quando Usar Esta Skill

- Criar documentos, planilhas ou relatórios no Google Workspace
- Ler conteúdo de arquivos do Drive ou Docs
- Enviar emails ou buscar mensagens no Gmail
- Manipular dados em planilhas do Google Sheets
- Salvar resultados de análise em documentos compartilhados
- Automatizar fluxos de trabalho com documentos Google

## Quando NÃO Usar Esta Skill

- Para operações de arquivo local (use ferramentas built-in do OpenCode)
- Para tarefas que não envolvem Google Workspace
- Quando o token OAuth expirou e não há refresh (re-autenticar primeiro)

---

## 📚 Referência Rápida — 15 MCP Tools

### Google Drive (6 tools)

| Tool | Descrição | Parâmetros | Exemplo |
|------|-----------|------------|---------|
| `drive_list` | Listar arquivos | `pageSize`: número, `query`: string para filtro | `drive_list({pageSize: 5})` |
| `drive_read` | Ler conteúdo por ID | `fileId`: string | `drive_read({fileId: "1abc..."})` |
| `drive_create` | Criar arquivo | `name`: string, `content`: string, `mimeType`: string | `drive_create({name: "notas.md", content: "# Notas"})` |
| `drive_upload` | Upload de conteúdo | `name`: string, `content`: string, `mimeType`: string | `drive_upload({name: "dados.csv", content: "a,b\n1,2"})` |
| `drive_search` | Buscar por nome | `query`: string | `drive_search({query: "relatório"})` |
| `drive_delete` | Deletar arquivo | `fileId`: string, `confirm`: boolean | `drive_delete({fileId: "1abc...", confirm: true})` |

### Google Docs (3 tools)

| Tool | Descrição | Parâmetros | Exemplo |
|------|-----------|------------|---------|
| `docs_create` | Criar documento | `title`: string, `content`: string (opcional) | `docs_create({title: "Relatório", content: "Resumo..."})` |
| `docs_read` | Ler documento | `documentId`: string | `docs_read({documentId: "1abc..."})` |
| `docs_append` | Adicionar texto | `documentId`: string, `text`: string | `docs_append({documentId: "1abc...", text: "\nAtualização"})` |

### Google Sheets (3 tools)

| Tool | Descrição | Parâmetros | Exemplo |
|------|-----------|------------|---------|
| `sheets_create` | Criar planilha | `title`: string, `headers`: string[] (opcional) | `sheets_create({title: "Vendas", headers: ["Produto","Qtd"]})` |
| `sheets_append` | Adicionar linhas | `spreadsheetId`: string, `rows`: string[][] | `sheets_append({spreadsheetId: "1abc...", rows: [["A","1"]]})` |
| `sheets_read` | Ler planilha | `spreadsheetId`: string, `range`: string | `sheets_read({spreadsheetId: "1abc...", range: "A1:C100"})` |

### Gmail (3 tools)

| Tool | Descrição | Parâmetros | Exemplo |
|------|-----------|------------|---------|
| `gmail_search` | Buscar emails | `query`: string, `maxResults`: number | `gmail_search({query: "is:unread", maxResults: 5})` |
| `gmail_send` | Enviar email | `to`: string, `subject`: string, `body`: string | `gmail_send({to: "a@b.com", subject: "Oi", body: "Texto"})` |
| `gmail_get_thread` | Ler thread | `threadId`: string | `gmail_get_thread({threadId: "1abc..."})` |

---

## 🏗️ Workflows de Uso

### Workflow 1: Criar e Compartilhar Documento

```json
// 1. Criar o documento
docs_create({ title: "Meeting Notes", content: "Pauta da reunião..." })
// → documentId, webViewLink

// 2. Opcional: verificar no Drive
drive_list({ pageSize: 5 })

// 3. Compartilhar o link com o usuário
// → "Documento criado: https://docs.google.com/document/d/..."

```

### Workflow 2: Ler Documento Existente

```json
// 1. Encontrar o arquivo pelo nome
drive_search({ query: "relatório mensal" })
// → results[0].id

// 2. Ler o documento
docs_read({ documentId: "<id>" })
// → title, content

// 3. Processar o conteúdo retornado
```

### Workflow 3: Criar Planilha com Dados

```json
// 1. Criar a planilha com headers
sheets_create({ title: "Vendas 2026", headers: ["Produto", "Quantidade", "Valor"] })
// → spreadsheetId, webViewLink

// 2. Adicionar linhas de dados
sheets_append({
  spreadsheetId: "<id>",
  rows: [["Camiseta", "10", "50.00"], ["Calça", "5", "80.00"]]
})

// 3. Compartilhar link
// → "Planilha criada: https://docs.google.com/spreadsheets/d/..."
```

### Workflow 4: Buscar e Responder Emails

```json
// 1. Buscar emails com query Gmail
gmail_search({ query: "from:cliente subject:pedido" })
// → messages[].id, messages[].threadId

// 2. Ler a conversa completa
gmail_get_thread({ threadId: "<threadId>" })
// → messages[] com from, subject, body

// 3. Responder
gmail_send({ to: "cliente@email.com", subject: "Re: Pedido", body: "Segue atualização..." })
```

---

## 🧠 Padrões e Boas Práticas

### ✅ Recomendado

**Buscar antes de ler:**
```
drive_search → drive_read/docs_read
```
Sempre use `drive_search` para encontrar o fileId correto antes de ler documentos.

**Confirmação em deleção:**
```
drive_delete(fileId, confirm: true)
```
`drive_delete` requer `confirm: true` — nunca pular essa etapa.

**Headers em planilhas:**
```json
sheets_create({ title: "...", headers: ["Col1", "Col2"] })
```
Use headers descritivos em planilhas para facilitar a leitura.

**Compartilhar links:**
Após criar Docs/Sheets, sempre retorne o `webViewLink` para o usuário acessar.

### ❌ Antipadrões

- ❌ Tentar `drive_delete` sem `confirm: true` → erro
- ❌ Passar `fileId` como query string em `drive_read`
- ❌ Esquecer de tratar refresh token expirado (server renova automático, mas se falhar, re-autenticar)
- ❌ Enviar emails sem formatação profissional

---

## 🔧 MCP Server

O servidor MCP está em:

```
.opencode/mcp/google-workspace/server.mjs
```

Credenciais OAuth:

```
~/.config/nexus-google-mcp/credentials.json  — Client ID/Secret
~/.config/nexus-google-mcp/token.json        — Token + refresh token
```

Para testar uma tool diretamente via CLI:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"drive_list","arguments":{"pageSize":5}}}' | timeout 15 node .opencode/mcp/google-workspace/server.mjs 2>/dev/null
```

## 🔗 Integração com o Harness Nexus

| Estágio | Uso do Google Workspace |
|---------|------------------------|
| **SPEC** | Salvar specs em Google Docs para compartilhamento |
| **DOCUMENT** | Criar documentação em Docs, planilhas de métricas em Sheets |
| **REVIEW** | Enviar relatórios de review por email via Gmail |
| **BUILD** | Salvar logs de build em arquivos do Drive |

Use com `/gw` ou delegando ao `@google-workspace-agent`.

## Critérios de Qualidade

- [ ] Sempre usar `drive_search` antes de `drive_read` para encontrar o ID correto
- [ ] Confirmar antes de `drive_delete` (requer `confirm: true`)
- [ ] Manter mensagens de email profissionais e bem formatadas
- [ ] Usar headers descritivos em planilhas criadas
- [ ] Compartilhar links `webViewLink` após criar documentos
- [ ] Tratar erro 401 (token expirado sem refresh) e instruir re-autenticação
