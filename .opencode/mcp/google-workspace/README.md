# Google Workspace MCP - Guia de Configuração

## Pré-requisitos

- Conta Google (Gmail)
- Projeto no Google Cloud Console
- Node.js v18+

## Passo 1: Configurar APIs no Google Cloud Console

### 1.1 Acessar o Console

1. Acesse: https://console.cloud.google.com
2. Selecione o projeto **nexus-7-agent** no seletor superior

### 1.2 Habilitar APIs

Acesse cada link e clique em **"Habilitar"**:

| API | Link direto |
|-----|-------------|
| Google Drive API | https://console.cloud.google.com/apis/library/drive.googleapis.com |
| Google Docs API | https://console.cloud.google.com/apis/library/docs.googleapis.com |
| Google Sheets API | https://console.cloud.google.com/apis/library/sheets.googleapis.com |
| Gmail API | https://console.cloud.google.com/apis/library/gmail.googleapis.com |
| Google OAuth2 API | https://console.cloud.google.com/apis/library/oauth2.googleapis.com |

### 1.3 Configurar Tela de Consentimento OAuth

1. Acesse: https://console.cloud.google.com/apis/credentials/consent
2. Selecione **"Externo"** como tipo de usuário
3. Preencha:
   - **Nome do app**: `Google Workspace MCP`
   - **E-mail de suporte**: seu e-mail
4. Na seção **Escopos**, adicione:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
5. Na seção **Usuários de teste**, adicione seu e-mail Google
6. Clique em **"Salvar e Continuar"**

### 1.4 Criar Credenciais OAuth 2.0

1. Acesse: https://console.cloud.google.com/apis/credentials
2. Clique em **"+ Criar Credenciais"** → **"ID do Cliente OAuth"**
3. Tipo de aplicativo: **"Aplicativo para Computador"**
4. Nome: `Google Workspace MCP`
5. Clique em **"Criar"**
6. **IMPORTANTE**: Baixe o JSON clicando em **"Fazer download dos dados do cliente"**
7. Salve o arquivo (você vai colá-lo no próximo passo)

> **Nota**: O script usa `http://localhost:3000/callback` como redirect URI automaticamente. Não é necessário configurar URIs de redirecionamento manualmente.

## Passo 2: Configurar no OpenCode

### 2.1 Copiar Credenciais

Execute no terminal:

```bash
cd .opencode/mcp/google-workspace
node auth.mjs --setup
```

Quando solicitado, **cole o conteúdo JSON** que você baixou do Google Cloud.

### 2.2 Autorizar

Execute:

```bash
node auth.mjs --authorize
```

1. O navegador abrirá automaticamente
2. Faça login com sua conta Google
3. Autorize o acesso
4. Copie o **código de autorização**
5. Cole no terminal

### 2.3 Verificar

Execute:

```bash
node auth.mjs --verify
```

Deve mostrar sua conta Google e confirmar que a conexão funciona.

## Passo 3: Testar no OpenCode

Reinicie o OpenCode e use os comandos:

```
/gw          → Lista arquivos do Drive
/gw docs     → Cria documento
/gw sheets   → Cria planilha
/gw gmail    → Busca e-mails
```

## Troubleshooting

### Erro "Credenciais não encontradas"
- Execute `node auth.mjs --setup` e cole o JSON

### Erro "Token expirado"
- Execute `node auth.mjs --refresh`

### Erro "Acesso negado"
- Verifique se seu e-mail está na lista de usuários de teste
- Verifique se as APIs estão habilitadas
- Verifique os escopos na tela de consentimento

### Erro "Redirect URI mismatch"
- O tipo de aplicativo deve ser **"Aplicativo para Computador"**, não "Web"
- O script gera um redirect URI automático (`http://localhost`)

## Estrutura de Arquivos

```
~/.config/google-workspace-mcp/
├── credentials.json    # Credenciais OAuth (do Google Cloud)
└── tokens.json         # Tokens de acesso (gerado pelo auth.mjs)
```

## Tools Disponíveis

| Tool | Descrição |
|------|-----------|
| `gdrive_list_files` | Lista arquivos no Drive |
| `gdrive_search` | Busca arquivos por nome |
| `gdrive_read_file` | Lê conteúdo de arquivo |
| `gdrive_create_file` | Cria arquivo de texto |
| `gdrive_upload_file` | Upload de arquivo local |
| `gdrive_delete_file` | Move para lixeira |
| `gdrive_export` | Exporta como PDF/DOCX/TXT |
| `gdocs_create` | Cria documento Google Docs |
| `gdocs_read` | Lê documento |
| `gdocs_update` | Atualiza documento |
| `gsheets_create` | Cria planilha |
| `gsheets_read` | Lê dados da planilha |
| `gsheets_write` | Escreve dados na planilha |
| `gmail_search` | Busca e-mails |
| `gmail_read` | Lê e-mail |
| `gmail_send` | Envia e-mail |
| `gmail_labels` | Lista labels |
