# Como configurar Redirect URI no Google Cloud (Interface 2026)

## Passo a passo visual

### 1. Acesse a página de Clients
URL: **https://console.developers.google.com/auth/clients**

### 2. Encontre seu Client ID
Na lista de OAuth Clients, clique no nome do seu cliente (o que você criou como "Aplicativo para Computador" ou "Desktop App")

### 3. Role para baixo até "Authorized redirect URIs"
Na página de detalhes do cliente, você verá seções como:
- **Client ID** (campo somente leitura)
- **Client secret** (com botão "Add Secret" ou mostra os últimos 4 caracteres)
- **Application type** (Desktop app, Web application, etc.)
- **Authorized redirect URIs** ← ESTA É A SEÇÃO QUE PROCURAMOS

### 4. Adicione o URI
1. Clique no botão **"+ ADD URI"** ou **"ADD REDIRECT URI"**
2. No campo que aparece, digite exatamente:
   ```
   http://localhost:3000/callback
   ```
3. Clique em **"SAVE"** ou **"SAVE CHANGES"** no final da página

### 5. Aguarde a propagação
⏳ Pode levar de **5 minutos a algumas horas** para as mudanças fazerem efeito.

---

## Solução alternativa: Use "Desktop App" em vez de "Web Application"

Se você criou o cliente como **"Web Application"**, a seção de redirect URIs aparece logo abaixo de "Authorized JavaScript origins".

Se você criou como **"Desktop App"** (recomendado para nosso caso), o Google **não exige** configurar redirect URIs manualmente — ele usa `http://localhost` automaticamente.

### Para verificar qual tipo você criou:
1. Na página de detalhes do cliente, procure **"Application type"**
2. Se for **"Desktop app"**, não precisa configurar nada — o script já funciona
3. Se for **"Web application"**, siga os passos 3-4 acima

---

## Verificação rápida

Após salvar, execute:

```bash
cd .opencode/mcp/google-workspace
node auth.mjs --authorize
```

Se aparecer:
```
🔗 Servidor local rodando na porta 3000
🌐 Abrindo navegador para autorização...
```

✅ Funcionou! O navegador abrirá e você autorizará.

Se aparecer erro `redirect_uri_mismatch`:
- Verifique se o URI está exatamente como `http://localhost:3000/callback`
- Aguarde alguns minutos e tente novamente
- Confirme que o tipo de aplicativo é "Desktop app" OU que o redirect URI está configurado

---

## Troubleshooting

### "Não encontro a seção Authorized redirect URIs"
- Certifique-se de estar na **página de detalhes** do cliente (clique no nome na lista)
- A seção está no final da página, abaixo de "Client secret"

### "A página não carrega"
- Tente URL alternativa: https://console.cloud.google.com/apis/credentials
- Clique no seu Client ID na lista

### "Erro 400: redirect_uri_mismatch"
- O URI configurado não corresponde ao usado pelo script
- Verifique se é exatamente `http://localhost:3000/callback` (com `/callback` no final)
- Confirme se não há espaços ou caracteres extras

### "Erro 400: invalid_request"
- O cliente pode estar como "Web application" mas sem redirect URI configurado
- Mude para "Desktop app" OU configure o redirect URI
