---
title: "CRON News → Notion — Blog de Notícias Personalizado"
status: "approved"
author: "Nexus Orchestrator"
created: "2026-06-19"
updated: "2026-06-19"
version: "0.1.0"
---

# CRON News → Notion — Spec

## 1. Visão Geral

**Problema:** Não existe um consumo diário e estruturado de notícias personalizadas com curadoria automática. O usuário precisa de um resumo matinal de notícias com seções customizadas, publicado diretamente no Notion.

**Usuário alvo:** O próprio usuário (consumidor individual de notícias).

**Contexto:** O projeto Nexus 7 Agent já possui integração com **Gemini API** (via `GEMINI_API_KEY` no `.env`), **GitHub Actions** (workflow existente em `.github/workflows/opencode.yml`) e **TypeScript** como linguagem principal. O script rodará no **GitHub Actions** e usará a **Notion REST API** diretamente via `fetch` nativo do Node 18+, sem dependência do ecossistema OpenCode. Database será criado no **workspace raiz** do Notion.

**Stack definida:**
- **Orquestração:** GitHub Actions (cron schedule, `06:06 BRT`)
- **Linguagem:** TypeScript (Node 18+, `ts-node`)
- **AI:** Gemini REST API via `fetch` nativo (`GEMINI_API_KEY`)
- **Fontes:** **NewsAPI.org** (API key gratuita, 100 reqs/dia, categorias pré-definidas)
- **Destino:** **Notion REST API** direta via `fetch` nativo (`NOTION_TOKEN`)
- **Idioma:** Português (BR)
- **Config:** `.env` (desenvolvimento local) + GitHub Secrets (produção)

---

## 2. Requisitos Funcionais

### REQ-001: Workflow CRON Diário no GitHub Actions

**Descrição:** Criar um workflow YML no GitHub Actions que dispare automaticamente todos os dias às 06:06 BRT (horário de Brasília) para executar o script de geração de notícias.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Workflow configurado em `.github/workflows/news-cron.yml`
- [ ] Schedule cron: `6 9 * * *` → 06:06 BRT (UTC-3)
- [ ] Workflow faz checkout do repositório e roda `npx ts-node scripts/news-cron.ts`
- [ ] Secrets configurados: `GEMINI_API_KEY`, `NOTION_TOKEN`, `NEWSAPI_KEY`
- [ ] Suporte a `workflow_dispatch` para execução manual
- [ ] Logs de execução disponíveis na aba Actions do GitHub

**Casos de Teste:**
- `CT-001.1`: `workflow_dispatch` completa com exit code 0 e página é criada no Notion
- `CT-001.2`: Secrets estão disponíveis e configurados corretamente (GitHub Secrets)
- `CT-001.3`: Em caso de falha, o workflow falha com exit code não-zero

---

### REQ-002: Script de Coleta de Notícias via NewsAPI.org

**Descrição:** Criar script TypeScript (`scripts/news-cron.ts`) que coleta as principais notícias do dia usando a API do NewsAPI.org, em português (BR), organizadas por categoria.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Script faz requisições à NewsAPI.org para cada categoria
- [ ] Parâmetros: `language=pt`, `sortBy=popularity`
- [ ] Coleta ao menos 3 notícias por categoria
- [ ] Usa `fetch` nativo do Node 18+ para requisições HTTP
- [ ] Estrutura os dados em formato tipado: `{ title, description, source, url, category }[]`
- [ ] Tratamento de rate limit e erros da API
- [ ] API key lida de variável de ambiente (`NEWSAPI_KEY`)

**Casos de Teste:**
- `CT-002.1`: Retorna array de objetos com `{title, description, source, url, category}` não vazios para todas as categorias
- `CT-002.2`: Tratamento de erro quando NewsAPI falha (timeout, rate limit, API key inválida)
- `CT-002.3`: Pelo menos 3 artigos por categoria são retornados

---

### REQ-003: Geração de Resumo com Gemini API

**Descrição:** Para cada categoria de notícias, gerar um resumo personalizado em português usando a Gemini REST API, com tom editorial consistente e adaptado para leitura matinal.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Gemini REST API é chamada com prompt estruturado para cada categoria
- [ ] Resumo tem formato de newsletter com bullet points e contexto em pt-BR
- [ ] Seções "🌎 Mundo" e "🇧🇷 Brasil" têm destaque (mais conteúdo)
- [ ] Seção "🚀 Minha Carreira" foca em tecnologia, carreiras, IA
- [ ] Seção "🌞 Notícias Boas" é a última da página (apenas histórias positivas)
- [ ] API key (`GEMINI_API_KEY`) lida de variável de ambiente
- [ ] Fallback para texto plano se API falhar

**Casos de Teste:**
- `CT-003.1`: Chamada à Gemini retorna resumo estruturado com todas as seções em pt-BR
- `CT-003.2`: Tratamento de erro 429 (rate limit) com retry exponencial
- `CT-003.3`: Fallback funciona quando API key está inválida ou ausente

---

### REQ-004: Publicação no Notion via REST API

**Descrição:** Criar um Database no Notion no workspace raiz chamado "📰 Meu News Personalizado" e publicar cada edição diária como uma página filha com estrutura de seções em toggles, usando a **Notion REST API** diretamente via `fetch`.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Database "📰 Meu News Personalizado" é criado via Notion REST API no workspace raiz
- [ ] Propriedades do Database: Data (date), Título (title), Categoria (multi-select), Status (select)
- [ ] Cada execução cria uma nova página diária no database
- [ ] Conteúdo é organizado em toggles com emojis por seção
- [ ] Ordem das seções: 🌎 Mundo → 🇧🇷 Brasil → 💼 Negócios → 🤖 Tecnologia → 🚀 Carreira → ⚽ Esporte → 💊 Saúde → 🌞 Notícias Boas
- [ ] Respeita limite de 100 blocos por chamada à API do Notion
- [ ] Rate limit respeitado (~3 req/s) com throttle

**Casos de Teste:**
- `CT-004.1`: Database é criado via API com propriedades corretas
- `CT-004.2`: Página diária é criada com todas as 8 seções em toggles
- `CT-004.3`: Se página do dia já existe, atualiza em vez de duplicar
- `CT-004.4`: Quando `NOTION_TOKEN` é inválido, script loga erro e falha com exit code 1

---

### REQ-005: Configuração de Ambiente e Secrets

**Descrição:** Configurar todas as variáveis de ambiente necessárias para o funcionamento do CRON job, tanto localmente quanto no GitHub Actions.

**Prioridade:** Média

**Critérios de Aceitação:**
- [ ] `NOTION_TOKEN` configurado no `.env` e GitHub Secrets ✅
- [ ] `NEWSAPI_KEY` configurado no `.env` e GitHub Secrets ✅
- [ ] `GEMINI_API_KEY` já existe no `.env` e adicionada ao GitHub Secrets
- [ ] Script valida todas as variáveis obrigatórias no startup
- [ ] Script pode rodar localmente com `npx ts-node scripts/news-cron.ts`

**Casos de Teste:**
- `CT-005.1`: Script detecta presença de todas as variáveis obrigatórias e loga sucesso
- `CT-005.2`: Mensagem de erro clara com instruções quando variável está ausente
- `CT-005.3`: GitHub Actions tem todos os 3 secrets configurados

---

### REQ-006: Tratamento de Erros e Resiliência

**Descrição:** Implementar sistema de logging estruturado e resiliência para falhas parciais no pipeline de notícias.

**Prioridade:** Média

**Critérios de Aceitação:**
- [ ] Logs estruturados com nível (info, warn, error) e timestamp em cada etapa
- [ ] Falha em uma categoria não interrompe as demais (processamento isolado)
- [ ] Falha total na coleta ou API encerra com exit code não-zero
- [ ] Rate limiting respeitado: Gemini API e Notion API
- [ ] Retry com backoff para chamadas de API (máx 3 tentativas)

**Casos de Teste:**
- `CT-006.1`: Falha simulada em uma categoria não quebra as outras
- `CT-006.2`: Logs são escritos com formato `[timestamp] [LEVEL] mensagem`
- `CT-006.3`: Retry é acionado em caso de erro 429/503 e recupera após 2 tentativas

---

## 3. Requisitos Não-Funcionais

### NFR-001: Tempo de Execução
**Descrição:** O script completo (coleta → resumo → publicação) deve executar em menos de 5 minutos.
**Métrica:** Tempo total do workflow no GitHub Actions.
**Prioridade:** Média

### NFR-002: Custo de API
**Descrição:** Uso otimizado das APIs — no máximo 1 chamada Gemini por categoria (~8/dia) e 1 chamada NewsAPI por categoria (~8/dia), respeitando limites gratuitos.
**Métrica:** Número de chamadas de API por execução.
**Prioridade:** Baixa

### NFR-003: Segurança
**Descrição:** Nenhuma chave de API (Gemini, Notion, NewsAPI) deve estar hardcoded. Todas lidas de variáveis de ambiente. Logs não devem expor secrets.
**Métrica:** Ausência de strings de API key no código fonte. Secrets mascarados em logs.
**Prioridade:** Alta

---

## 4. Dependências

### Internas
- `scripts/` — diretório onde o script `news-cron.ts` será criado
- `.env` — armazena `GEMINI_API_KEY`, `NOTION_TOKEN`, `NEWSAPI_KEY` (todas configuradas)
- `tsconfig.json` — TypeScript configurado para ES2022 (Node 18+)
- `package.json` — dependências npm

### Externas
- **Notion REST API:** `NOTION_TOKEN` configurado no `.env` ✅
- **Gemini REST API:** `GEMINI_API_KEY` configurada no `.env` ✅
- **NewsAPI.org:** `NEWSAPI_KEY` configurada no `.env` ✅
- **GitHub Actions:** Runtime para cron + secrets (pendente configurar)

### Pacotes npm
- Nenhum pacote extra necessário — usaremos `fetch` nativo do Node 18+ para todas as chamadas HTTP
- TypeScript já configurado com `ts-node` para execução

---

## 5. Decisões Tomadas

- [x] **Notion REST API direta** (via `fetch`) em vez de MCP tools do OpenCode
- [x] **NewsAPI.org** como fonte de notícias (gratuita, 100 reqs/dia)
- [x] **Database no workspace raiz** do Notion
- [x] **Idioma português (BR)** para notícias e resumos
- [x] **Seção 🌞 Notícias Boas** ao final da página
- [x] **Zero dependências npm extras** — apenas `fetch` nativo
- [x] **Três secrets** no .env: `GEMINI_API_KEY`, `NOTION_TOKEN`, `NEWSAPI_KEY`

---

## 6. Questões em Aberto

- [ ] Deseja cache local para evitar refetch no mesmo dia (ex: evitar execuções duplicadas)?

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 0.1.0 | 2026-06-19 | Nexus Orchestrator | Criação inicial |
