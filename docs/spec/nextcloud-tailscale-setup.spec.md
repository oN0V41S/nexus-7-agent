---
title: "Setup NextCloud + Tailscale"
status: "review"
author: "Nexus Orquestrador"
created: "2026-07-15"
updated: "2026-07-15"
version: "0.2.0"
---

# Setup NextCloud + Tailscale — Spec

## 1. Visão Geral

**Problema:** O usuário precisa acessar arquivos do servidor remoto de forma visual (browser/app) no iOS e Windows, sem depender apenas de SSH/terminal. Além disso, deseja sincronizar pastas, compartilhar arquivos, editar documentos online e gerenciar calendário/contatos.

**Usuário alvo:** Pessoa física com acesso pessoal ao servidor via Tailscale.

**Contexto:** O servidor já possui Tailscale configurado e funcionando. O NextCloud será adicionado como serviço Docker para prover interface web de armazenamento, sync, colaboração e PIM (Personal Information Management).

---

## 2. Requisitos Funcionais

### REQ-001: Deploy do NextCloud via Docker

**Descrição:** O sistema deve provisionar NextCloud + MariaDB (ou SQLite) via Docker Compose no servidor Linux.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Docker Compose criado com serviço `nextcloud` e `db` (ou SQLite)
- [ ] Containers sobem sem erros (`docker compose up -d`)
- [ ] NextCloud acessível via `http://localhost:<porta>` no servidor
- [ ] Admin user e senha definidos via variáveis de ambiente
- [ ] Diretórios de dados persistidos via volumes Docker
**Casos de Teste:**
- `CT-001.1`: Executar `docker compose up -d` → containers rodando, NextCloud acessível
- `CT-001.2`: Reiniciar servidor → containers sobem automaticamente (restart: unless-stopped)
- `CT-001.3`: Senha do admin errada → login falha com mensagem de erro

### REQ-002: Acesso via Tailscale com HTTPS

**Descrição:** O NextCloud deve ser acessível de qualquer dispositivo na rede Tailscale via HTTPS, utilizando certificados automático do Tailscale.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] NextCloud acessível via `https://novaiskr-z450la.tail9bbcad.ts.net` no browser
- [ ] Certificado HTTPS válido (emitido pelo Tailscale ACME)
- [ ] Acesso funciona no iOS (Safari/Chrome) e Windows (Chrome/Edge)
- [ ] NEXTCLOUD_TRUSTED_DOMAINS configurado com `novaiskr-z450la.tail9bbcad.ts.net`
**Casos de Teste:**
- `CT-002.1`: Acessar `https://novaiskr-z450la.tail9bbcad.ts.net` → página de login do NextCloud exibida
- `CT-002.2`: Acessar via IP direto (fora do Tailscale) → conexão recusada
- `CT-002.3`: Certificado emitido automaticamente pelo Tailscale → válido no browser

### REQ-003: Upload e Download de Arquivos

**Descrição:** O usuário deve conseguir subir e baixar arquivos via interface web do NextCloud.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Botão "Upload" na interface web funciona para arquivos individuais
- [ ] Drag-and-drop de arquivos funciona no browser
- [ ] Download de arquivos individuais e pastas (ZIP) funciona
- [ ] Progresso de upload exibido na interface
**Casos de Teste:**
- `CT-003.1`: Upload de arquivo PDF (5MB) → arquivo aparece na listagem
- `CT-003.2`: Upload de múltiplos arquivos (50MB total) → todos aparecem na listagem
- `CT-003.3`: Download de arquivo → arquivo salvo localmente com conteúdo correto
- `CT-003.4`: Upload de arquivo com nome duplicado → prompt "substituir ou manter ambos"

### REQ-004: Sync de Pastas (Windows)

**Descrição:** O NextCloud Desktop Client deve sincronizar pastas específicas do Windows com o servidor.
**Prioridade:** Média
**Critérios de Aceitação:**
- [ ] NextCloud Desktop Client instalado no Windows
- [ ] Pasta selecionada para sync configurada no cliente
- [ ] Arquivos modificados localmente são enviados ao servidor automaticamente
- [ ] Arquivos modificados no servidor são baixados localmente automaticamente
- [ ] Conflitos de edição resolvidos com sufixo de data/hora
**Casos de Teste:**
- `CT-004.1`: Criar arquivo na pasta sync → arquivo aparece no servidor em <30s
- `CT-004.2`: Editar arquivo no servidor → arquivo atualizado localmente em <30s
- `CT-004.3`: Editar mesmo arquivo local e remotamente → conflito gerado com ambos os arquivos preservados
- `CT-004.4`: Desconectar da internet → fila de sync pendente, retoma ao reconectar

### REQ-005: Compartilhamento de Links Públicos

**Descrição:** O usuário deve gerar links públicos para compartilhar arquivos e pastas com terceiros.
**Prioridade:** Média
**Critérios de Aceitação:**
- [ ] Opção "Compartilhar" em cada arquivo/pasta
- [ ] Link público gerado com token aleatório
- [ ] Opção de definir senha de proteção no link
- [ ] Opção de definir data de expiração do link
- [ ] Opção de definir limite de downloads
**Casos de Teste:**
- `CT-005.1`: Gerar link público → arquivo acessível via URL sem login
- `CT-005.2`: Link com senha → solicitada senha antes de baixar
- `CT-005.3`: Link expirado → mensagem "link expirado" exibida
- `CT-005.4`: Limite de downloads atingido → mensagem "limite excedido"

### REQ-006: Editor Online (OnlyOffice)

**Descrição:** O usuário deve editar documentos Word, Excel e PowerPoint diretamente no browser via integração com OnlyOffice.
**Prioridade:** Média
**Critérios de Aceitação:**
- [ ] OnlyOffice Document Server rodando como container Docker
- [ ] Integração com NextCloud configurada (app OnlyOffice)
- [ ] Documentos .docx, .xlsx, .pptx abrem no editor ao clicar
- [ ] Edições são salvas automaticamente no NextCloud
- [ ] Múltiplos usuários podem editar simultaneamente (colaboração)
**Casos de Teste:**
- `CT-006.1`: Clicar em arquivo .docx → OnlyOffice abre com conteúdo correto
- `CT-006.2`: Editar e salvar → alterações refletidas no NextCloud
- `CT-006.3`: Dois usuários editando mesmo documento → mudanças visíveis em tempo real
- `CT-006.4`: OnlyOffice offline → mensagem de erro amigável, não corrompe arquivo

### REQ-007: Calendário e Contatos (CalDAV/CardDAV)

**Descrição:** O NextCloud deve prover serviços CalDAV (calendário) e CardDAV (contatos) para sincronização com dispositivos.
**Prioridade:** Baixa
**Critérios de Aceitação:**
- [ ] App Calendário do NextCloud funcional
- [ ] App Contatos do NextCloud funcional
- [ ] Calendários e contatos sincronizam com iPhone (via app CalDAV/CarDAV ou configuração nativa)
- [ ] Calendários e contatos sincronizam com Windows (via Outlook ou app nativo)
**Casos de Teste:**
- `CT-007.1`: Criar evento no calendário NextCloud → aparece no iPhone
- `CT-007.2`: Criar contato no NextCloud → aparece no iPhone
- `CT-007.3`: Criar evento no iPhone → aparece no calendário NextCloud
- `CT-007.4`: Deletar contato no NextCloud → removido do iPhone

### REQ-008: App Mobile (iOS)

**Descrição:** O usuário deve acessar e gerenciar arquivos do NextCloud via app oficial no iOS.
**Prioridade:** Média
**Critérios de Aceitação:**
- [ ] App NextCloud instalado da App Store
- [ ] Login funcional via URL do servidor Tailscale
- [ ] Navegação de arquivos e pastas funciona
- [ ] Upload de fotos/vídeos do iPhone funciona
- [ ] Sync automático de câmera configurável
**Casos de Teste:**
- `CT-008.1`: Abrir app → tela de login exibida
- `CT-008.2`: Login com credenciais corretas → listagem de arquivos exibida
- `CT-008.3`: Upload de foto → foto aparece no servidor
- `CT-008.4`: Ativar sync de câmera → fotos sobem automaticamente

---

## 3. Requisitos Não-Funcionais

### NFR-001: Performance

**Descrição:** O NextCloud deve responder em menos de 3 segundos para operações de listagem e upload de arquivos pequenos (<10MB).
**Métrica:** Tempo de resposta HTTP < 3000ms no P95 para operações de UI.
**Prioridade:** Alta

### NFR-002: Disponibilidade

**Descrição:** O NextCloud deve estar disponível 24/7, reiniciando automaticamente em caso de falha.
**Métrica:** Uptime > 99% (exceto manutenção programada). Containers com `restart: unless-stopped`.
**Prioridade:** Alta

### NFR-003: Segurança

**Descrição:** O acesso ao NextCloud deve ser protegido por HTTPS (via Tailscale) e autenticação obrigatória.
**Métrica:** Zero acesso sem autenticação. Certificado HTTPS válido. Senhas com mínimo 12 caracteres.
**Prioridade:** Alta

### NFR-004: Persistência de Dados

**Descrição:** Todos os dados do NextCloud (arquivos, bancos de dados, configurações) devem ser persistidos em volumes Docker, sobrevivendo a reinicializações dos containers.
**Métrica:** Dados íntegros após restart dos containers. Volume mappings configurados para diretórios persistentes.
**Prioridade:** Alta

### NFR-005: Uso de Recursos

**Descrição:** O NextCloud + OnlyOffice não devem consumir mais de 2GB de RAM total no servidor.
**Métrica:** Uso de memória RAM < 2GB (NextCloud + DB + OnlyOffice).
**Prioridade:** Média

---

## 4. Dependências

- **Docker + Docker Compose** — deve estar instalado no servidor
- **Tailscale** — deve estar configurado e funcionando no servidor
- **Certificados Tailscale** — Tailscale ACME deve estar habilitado para HTTPS automático
- **Domínio Tailscale** — `novaiskr-z450la.tail9bbcad.ts.net`
- **App NextCloud iOS** — disponível na App Store
- **NextCloud Desktop Client** — disponível para Windows
- **OnlyOffice Document Server** — container Docker adicional

---

## 5. Questões em Aberto (resolvidas)

| Questão | Resposta |
|---------|----------|
| Hostname Tailscale | `novaiskr-z450la.tail9bbcad.ts.net` |
| Docker instalado? | Sim |
| Sync de fotos | Manual (upload pelo app) |
| Backup automático | Não |

---

## 6. Stack Tecnológica

| Componente | Tecnologia | Porta |
|------------|-----------|-------|
| NextCloud | Docker (nextcloud:stable) | 80 → 80 |
| Banco de Dados | SQLite (nativo do NextCloud) | - |
| Editor Online | OnlyOffice Document Server | 8080 → 8080 |
| Acesso Remoto | Tailscale (HTTPS automático) | 443 (externo) |
| Sync Desktop | NextCloud Desktop Client | - |
| Sync Mobile | NextCloud App (iOS) | - |

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 0.1.0 | 2026-07-15 | Nexus Orquestrador | Criação inicial |
| 0.2.0 | 2026-07-15 | Nexus Orquestrador | Resolvidas questões em aberto, atualizado hostname Tailscale |
