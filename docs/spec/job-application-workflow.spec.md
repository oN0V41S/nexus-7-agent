---
title: "Job Application Workflow"
status: "approved"
author: "Nexus Orquestrador"
created: "2026-05-14"
updated: "2026-05-14"
version: "0.5.0"
---

# Job Application Workflow — Spec

## 1. Visão Geral

**Problema:** Profissionais de TI gastam em média 11h/semana procurando e aplicando para vagas manualmente. O processo envolve buscar em múltiplas plataformas (LinkedIn, Glassdoor, Indeed, Monster), analisar descrições, adaptar currículo para cada vaga e preencher formulários repetitivos. Não existe um pipeline integrado e semiautomático que unifique busca → análise → adaptação de currículo → aplicação.

**Usuário alvo:** Profissionais de TI (desenvolvedores, engenheiros de software, devops, etc.) buscando recolocação ou transição de carreira.

**Contexto:** Este é um workflow autônomo do ecossistema Nexus 7 Agent, implementado como um pipeline Harness que orquestra agentes especializados + ferramentas de automação de browser (Playwright MCP + Chrome DevTools MCP). O sistema opera em modo semiautomático: sugere vagas e adaptações de currículo, e o usuário aprova antes de aplicar.

**Plataformas-alvo:** LinkedIn, Glassdoor, Indeed, Monster (expansível para outras).

---

## 2. Requisitos Funcionais

### REQ-001: Configuração do Chrome DevTools MCP para autenticação em plataformas

**Descrição:** O sistema deve configurar e conectar o Chrome DevTools MCP server para permitir que o agente use o navegador Chrome real do usuário (com sessões ativas) em vez de um navegador headless/sandbox. Isso permite reutilizar logins existentes do LinkedIn, Glassdoor e demais plataformas sem jamais armazenar ou gerenciar senhas.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Chrome DevTools MCP adicionado ao `opencode.json` com `--autoConnect`
- [ ] Agente detecta se o Chrome está rodando com a porta de depuração
- [ ] Se Chrome não estiver rodando, agente instrui o usuário a iniciá-lo
- [ ] Ferramentas do Chrome MCP (`chrome_debugger_*`) disponíveis no OpenCode
- [ ] LinkedIn acessado via Chrome MCP — sessão do usuário reutilizada, sem novo login
- [ ] Se sessão expirar, agente PAUSA e solicita login manual ao usuário
- [ ] Nenhuma senha é armazenada, logada ou transmitida pelo agente

**Casos de Teste:**
- `CT-001.1`: Chrome rodando com `--remote-debugging-port=9222` → MCP conecta e tools aparecem
- `CT-001.2`: Chrome NÃO está rodando → agente exibe instruções para iniciar com flag de debug
- `CT-001.3`: LinkedIn acessado via Chrome MCP → usuário já aparece logado (sessão reutilizada)
- `CT-001.4`: Sessão do LinkedIn expira durante uso → agente para e solicita login manual

---

### REQ-002: Busca de vagas em múltiplas plataformas

**Descrição:** O sistema deve permitir buscar vagas de emprego simultaneamente em LinkedIn, Glassdoor, Indeed e Monster, usando Chrome DevTools MCP (para LinkedIn, que requer autenticação) e Playwright MCP (para demais plataformas). Deve aceitar termos de busca, localização e filtros (tipo de vaga, senioridade, data de publicação).

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Campo de entrada para termo de busca (ex: "Frontend Engineer")
- [ ] Campo de entrada para localização (ex: "São Paulo, Brazil")
- [ ] Filtros: tipo de contrato (CLT [Brasil], PJ [Brasil], remote, full-time, contract), senioridade (junior, pleno, senior), data de publicação (24h, 7d, 30d)
- [ ] Extração de: título, empresa, local, descrição, URL de candidatura, data de publicação
- [ ] LinkedIn buscado via Chrome DevTools MCP (sessão autenticada do usuário)
- [ ] Glassdoor, Indeed, Monster buscados via Playwright MCP (headless)
- [ ] Resultados consolidados em lista única com origem identificada
- [ ] Controle de rate limiting para evitar bloqueio das plataformas

**Casos de Teste:**
- `CT-002.1`: Busca "Frontend Engineer" em São Paulo → resultados de múltiplas plataformas
- `CT-002.2`: Busca sem resultados → mensagem clara "Nenhuma vaga encontrada"
- `CT-002.3`: LinkedIn bloqueia scraping → fallback com captura de erro e log
- `CT-002.4`: Filtro por "últimas 24h" → apenas vagas recentes retornadas

---

### REQ-003: Análise de compatibilidade e match score

**Descrição:** O sistema deve analisar a descrição de cada vaga contra o currículo do usuário e calcular um score de compatibilidade (0-100%) usando IA local (Ollama) ou API configurável.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Extrair requisitos técnicos e soft skills da descrição da vaga
- [ ] Comparar com perfil/currículo do usuário (skills, experiência, formação)
- [ ] Calcular match score percentual
- [ ] Destacar gaps (skills que o usuário não possui)
- [ ] Destacar pontos fortes (skills onde o usuário é fortemente qualificado)
- [ ] Sugerir ordem de prioridade das vagas baseada no match score

**Casos de Teste:**
- `CT-003.1`: Vaga com 80%+ match → destacada como "alta compatibilidade"
- `CT-003.2`: Vaga com < 40% match → marcada como "baixa compatibilidade"
- `CT-003.3`: Currículo vazio/sem dados → erro tratado com orientação ao usuário
- `CT-003.4`: Ollama indisponível → fallback para keyword matching heurístico funciona sem erro
- `CT-003.5`: Vaga em inglês com requisitos técnicos → match calculado corretamente (i18n)
- `CT-003.6`: Vaga com 0 skills em comum com o perfil → match = 0%, sem erro

---

### REQ-004: Consolidação de múltiplos PDFs de currículo em DOCX ATS de 1 página

**Descrição:** O sistema deve receber múltiplos arquivos PDF contendo diferentes versões/adaptações do currículo de uma mesma pessoa, analisar o melhor conteúdo de cada um, e consolidar em um único documento DOCX de exatamente 1 página, em formato otimizado para ATS (Applicant Tracking System).

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Aceitar N arquivos PDF como entrada (mínimo 1, sem limite superior)
- [ ] Extrair o conteúdo textual de cada PDF via parse (PyMuPDF/fitz ou similar)
- [ ] Detectar que os PDFs pertencem à mesma pessoa (nome, email, telefone consistentes)
- [ ] Mesclar conteúdo: para cada seção (experiência, skills, educação), selecionar a melhor versão entre os PDFs
- [ ] Resolver contradições: se um PDF diz "2022-2025" e outro diz "2023-2025", usar o mais recente ou sinalizar para revisão humana
- [ ] Consolidar skills: união de skills mencionadas em todos os PDFs (sem duplicatas), com poda por relevância quando necessário
- [ ] Gerar documento DOCX com exatamente 1 página de comprimento
- [ ] Formato ATS-ready:
  - [ ] Sem colunas, sem tabelas complexas, sem imagens/gráficos
  - [ ] Fonte padrão (Calibri 10pt-12pt corpo, 14pt-16pt nomes/títulos)
  - [ ] Margens 2,54cm (1 polegada) ou superior
  - [ ] Seções padrão ATS: Contato → Resumo → Experiência → Educação → Skills → Certificações
  - [ ] Sem cabeçalho/rodapé que confunda parsers
  - [ ] Datas em formato padronizado (Mês/AAAA)
- [ ] Preservar verdades factuais — NÃO inventar skills, cargos ou períodos
- [ ] Salvar arquivo .docx e uma cópia em PDF para visualização

**Casos de Teste:**
- `CT-004.1`: 3 PDFs da mesma pessoa com ênfases diferentes → DOCX consolidado com o melhor de cada
- `CT-004.2`: PDFs com datas contraditórias (ex: empresa X termina 2024 vs 2025) → sinalizado para revisão
- `CT-004.3`: PDFs de pessoas diferentes → erro "documentos não correspondem à mesma pessoa"
- `CT-004.4`: Conteúdo excede 1 página → IA comprime/prioriza conteúdo mantendo informações essenciais
- `CT-004.5`: DOCX gerado → verificado programaticamente via python-docx: (a) `paragraphs` count consistente com 1 página, (b) fontes = Calibri 11pt, (c) margins = 2.54cm, (d) zero tables, zero images

#### Plano Detalhado — Consolidação de Currículos

```
┌─────────────────────────────────────────────────────────────────┐
│           Multi-PDF → DOCX ATS Consolidated                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ENTRADA: múltiplos PDFs da mesma pessoa                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │currículo │  │currículo │  │currículo │  ...                    │
│  │-react.pdf│  │-devops   │  │-fullstack│                       │
│  └─────┬────┘  └────┬─────┘  └────┬─────┘                       │
│        │            │              │                              │
│        ▼            ▼              ▼                              │
│  ┌──────────────────────────────────────────┐                    │
│  │  PASSO 1: Extração individual (PyMuPDF)   │                   │
│  │  Cada PDF → texto bruto                    │                    │
│  │                                          │                    │
│  │  PASSO 2: Parse IA → structured chunks    │                   │
│  │  PDF-1: profile_1.json                    │                    │
│  │  PDF-2: profile_2.json                    │                    │
│  │  PDF-3: profile_3.json                    │                    │
│  └──────────────────────────────────────────┘                    │
│                      │                                            │
│                      ▼                                            │
│  ┌──────────────────────────────────────────┐                    │
│  │  PASSO 3: Merge & Conflict Resolution    │                   │
│  │                                          │                    │
│  │  Skills:     React ∪ Node ∪ Docker ∪ AWS │                    │
│  │              (união c/ poda: skills em   │                    │
│  │               ≥2 PDFs são prioritárias)  │                    │
│  │                                          │                    │
│  │  Experiência: melhor descrição de cada   │                    │
│  │              empresa entre os PDFs       │                    │
│  │              (critério: mais completa)   │                    │
│  │                                          │                    │
│  │  Contradição: datas conflitantes →       │                    │
│  │  usa a mais recente OU flag humano      │                    │
│  └──────────────────────────────────────────┘                    │
│                      │                                            │
│                      ▼                                            │
│  ┌──────────────────────────────────────────┐                    │
│  │  PASSO 4: Geração DOCX ATS 1 página      │                   │
│  │                                          │                    │
│  │  python-docx → currículo-consolidado.docx │                    │
│  │  python-docx → currículo-consolidado.pdf │                    │
│  │                                          │                    │
│  │  Layout:                                  │                    │
│  │  ┌──────────────────────────────┐        │                    │
│  │  │ NOME completo               │        │                    │
│  │  │ email | tel | LinkedIn      │        │                    │
│  │  │──────────────────────────────│        │                    │
│  │  │ RESUMO PROFISSIONAL         │        │                    │
│  │  │ 1-2 linhas concisas         │        │                    │
│  │  │──────────────────────────────│        │                    │
│  │  │ EXPERIÊNCIA                 │        │                    │
│  │  │ Empresa | Cargo | Período   │        │                    │
│  │  │ • bullet conciso            │        │                    │
│  │  │ • bullet conciso            │        │                    │
│  │  │──────────────────────────────│        │                    │
│  │  │ EDUCAÇÃO                    │        │                    │
│  │  │──────────────────────────────│        │                    │
│  │  │ SKILLS                      │        │                    │
│  │  │ React • Node • AWS • Docker │        │                    │
│  │  └──────────────────────────────┘        │                    │
│  └──────────────────────────────────────────┘                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Requisitos do DOCX ATS (1 página):**

| Requisito | Especificação |
|-----------|--------------|
| **Páginas** | Exatamente 1 (uma) — se conteúdo exceder, IA deve comprimir/priorizar |
| **Formato** | .docx (Office Open XML) via python-docx |
| **Fonte** | Calibri 11pt corpo, 14pt nome, 12pt títulos de seção |
| **Margens** | 2,54cm (1 polegada) nos 4 lados |
| **Espaçamento** | Simples ou 1,15 entre linhas |
| **Seções** | Contato → Resumo → Experiência → Educação → Skills → Certificações (opcional) |
| **Colunas** | Zero — layout linear obrigatório |
| **Tabelas** | Apenas se forem detectáveis por ATS (evitar layout tables) |
| **Cores/Gráficos** | Proibido — apenas preto no branco |
| **Imagens** | Proibido — ATS não lê imagens |
| **Cabeçalho/Rodapé** | Vazio — parsers ATS podem ignorar |
| **Datas** | Mês/AAAA padronizado (ex: "Mar/2022 - Jun/2025") |
| **Bullets** | • (símbolo) ou - (hífen) — ambos são ATS-safe |

#### Regras de Prioridade — Compressão para 1 Página

Quando o conteúdo consolidado exceder 1 página, o sistema aplica a seguinte ordem de prioridade (do que nunca é cortado ao que é cortado primeiro):

| Prioridade | Seção | Regra |
|:----------:|-------|-------|
| 1 (nunca cortar) | **Contato** | Nome, email, telefone, LinkedIn — sempre preservados |
| 2 | **Skills** | Skills aparecendo em ≥ 2 PDFs de entrada são prioritárias. Skills singulares podem ser removidas se necessário |
| 3 | **Experiência — últ. 5 anos** | Experiências dos últimos 5 anos são preservadas integralmente |
| 4 | **Experiência — anteriores** | Experiências > 5 anos podem ter bullets reduzidos (máx 2 por cargo) |
| 5 | **Resumo profissional** | Reduzido para 1 linha se necessário |
| 6 (cortar primeiro) | **Educação/Certificações** | Certificações menos relevantes removidas; educação truncada para instituição + curso + ano |

---

### REQ-005: Geração contextualizada de currículo e carta de apresentação

**Descrição:** O sistema deve gerar uma versão adaptada do currículo e uma carta de apresentação personalizada para cada vaga, ajustando ênfase em skills relevantes com base na descrição da vaga.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Consumir o `profile.json` gerado na etapa de consolidação (REQ-004) — não re-parsear o DOCX
- [ ] Se `profile.json` não existir (execução standalone), extrair perfil do DOCX/PDF uma única vez
- [ ] Para cada vaga, adaptar seção de "skills" priorizando tecnologias mencionadas na descrição
- [ ] Para cada vaga, reordenar/re-ênfase bullet points de experiências anteriores para destacar entregas relevantes
- [ ] Gerar carta de apresentação de 3-4 parágrafos contextualizada com a vaga
- [ ] **Voice Linting**: IA avalia a qualidade da prosa da carta; se for genérica ou de baixa qualidade, o sistema descarta e gera novamente
- [ ] Preservar verdades factuais — IA NÃO inventa skills ou experiências
- [ ] Salvar currículo adaptado + carta como PDF (via fpdf2)
- [ ] Revisão humana obrigatória antes da aplicação (modo semiautomático)

**Casos de Teste:**
- `CT-005.1`: Vaga de React + Node → currículo enfatiza experiências React/Node
- `CT-005.2`: Vaga de DevOps → currículo enfatiza CI/CD, Docker, Kubernetes
- `CT-005.3`: Geração de carta genérica/ruim → Voice Linting detecta e força re-geração
- `CT-005.4`: Verificação de verdades-factuais: IA não inventa skills/experiências

#### Plano Detalhado — Alteração de Currículos

O processo de adaptação de currículo segue 4 passos, baseado nos padrões do `auto-apply-template` e `job-apply-plugin`:

```
┌─────────────────────────────────────────────────────────────┐
│                   Profile-First Approach                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  PASSO 1: Extração Única                                      │
│  ┌──────────────────────────────────────┐                    │
│  │ PDF/DOCX/TXT ──► profile.json         │                    │
│  │   • Dados pessoais (nome, email, etc) │                    │
│  │   • Histórico profissional            │                    │
│  │   • Educação e certificações          │                    │
│  │   • Skills técnicas e ferramentas     │                    │
│  │   • Idiomas                          │                    │
│  │   • Links (LinkedIn, GitHub, portfolio)│                    │
│  └──────────────────────────────────────┘                    │
│                         │                                      │
│  PASSO 2: Análise da Vaga                                    │
│  ┌──────────────────────────────────────┐                    │
│  │ Descrição da vaga → parse IA         │                    │
│  │   • Skills obrigatórias vs desejáveis │                    │
│  │   • Stack tecnológica mencionada      │                    │
│  │   • Senioridade esperada             │                    │
│  │   • Palavras-chave para ATS          │                    │
│  └──────────────────────────────────────┘                    │
│                         │                                      │
│  PASSO 3: Adaptação Contextual                               │
│  ┌──────────────────────────────────────┐                    │
│  │ profile.json + análise → diff        │                    │
│  │                                      │                    │
│  │ Skills:   [React, Node, AWS]         │                    │
│  │ Vaga:     [React, TS, AWS, Docker]   │                    │
│  │                                    │                    │
│  │ Resultado:                          │                    │
│  │  ✓ Destacar React + AWS (match)     │                    │
│  │  ✓ Adicionar TS se consta no perfil │                    │
│  │  ✓ Mencionar Docker se tiver exp    │                    │
│  │  ✗ NÃO inventar Kubernetes          │                    │
│  └──────────────────────────────────────┘                    │
│                         │                                      │
│  PASSO 4: Geração + Revisão Humana                           │
│  ┌──────────────────────────────────────┐                    │
│  │ Output por vaga:                      │                    │
│  │   • currículo-adaptado-[vaga].pdf    │                    │
│  │   • carta-[vaga].pdf                 │                    │
│  │                                      │                    │
│  │ Fluxo: GERAR → REVISAR → APROVAR →   │                    │
│  │         APLICAR                      │                    │
│  └──────────────────────────────────────┘                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Regras de Adaptação:**

| O quê | Regra |
|-------|-------|
| **Skills** | Reordenar para priorizar as mencionadas na vaga. Remover skills irrelevantes. NUNCA adicionar skills que o usuário não tem. |
| **Experiências** | Re-ênfase nos bullet points: destacar entregas que usam a stack da vaga. Manter verdades factuais. |
| **Carta** | 3-4 parágrafos: (1) abertura com entusiasmo pela empresa, (2) conexão entre experiência do candidato e requisitos da vaga, (3) contribuições relevantes, (4) fechamento educado. |
| **Formato** | PDF gerado localmente via Python (fpdf2). Zero chamadas de API para renderização. |
| **Segurança** | Perfil base `profile.json` nunca sai da máquina. Currículos adaptados são temporários e descartados após aprovação/rejeição. |

---

### REQ-006: Aplicação semiautomática com aprovação humana

**Descrição:** O sistema deve apresentar ao usuário um resumo das vagas ranqueadas por match score com as versões adaptadas do currículo e carta para cada uma. O usuário revisa e aprova (ou rejeita) cada candidatura antes do sistema executar a aplicação via Chrome DevTools MCP (LinkedIn) ou Playwright MCP (demais plataformas).

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Painel com lista de vagas ranqueadas por match score
- [ ] Para cada vaga: exibir descrição original + currículo adaptado + carta gerada
- [ ] Ações por vaga: "Aprovar", "Rejeitar", "Editar antes de aplicar"
- [ ] Ação em lote: "Aprovar todas com score > X%"
- [ ] LinkedIn Easy Apply submetido via Chrome DevTools MCP (sessão autenticada)
- [ ] Demais plataformas/ATS submetidos via Playwright MCP
- [ ] Suporte a múltiplos tipos de ATS: LinkedIn Easy Apply, Greenhouse, Workday, Ashby, Lever
- [ ] Confirmação de submissão bem-sucedida (ou falha) registrada em log
- [ ] Desduplicação: não aplicar 2x para mesma vaga

**Casos de Teste:**
- `CT-006.1`: Aprovar vaga individual → submissão executada com sucesso
- `CT-006.2`: Rejeitar vaga → vaga movida para lista de "descartadas"
- `CT-006.3`: Aprovar lote de 5 vagas → 5 submissões em sequência
- `CT-006.4`: Falha na submissão (CAPTCHA) → log de erro + notificação ao usuário
- `CT-006.5`: Tentar aplicar 2x mesma vaga → bloqueado por desduplicação

---

### REQ-007: Desduplicação de candidaturas

**Descrição:** O sistema deve impedir candidaturas duplicadas para a mesma empresa/vaga, consultando um estado compartilhado (Notion ou JSONL local) antes de cada submissão.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Antes de aplicar, consultar Notion DB ou `applied.jsonl` local
- [ ] Se empresa + vaga já constar como "Applied", bloquear submissão
- [ ] Registrar tentativa de candidatura duplicada em `skipped.jsonl` com motivo "Duplicate"
- [ ] Sincronizar estado de desduplicação entre agentes paralelos (LinkedIn vs Glassdoor)

**Casos de Teste:**
- `CT-007.1`: Tentar aplicar para vaga já registrada no Notion → bloqueado
- `CT-007.2`: Tentar aplicar para vaga nova → submissão permitida
- `CT-007.3`: Dois agentes paralelos tentam aplicar para mesma vaga → segundo agente bloqueado pelo primeiro

---

### REQ-008: Rastreamento e relatório de candidaturas

**Descrição:** O sistema deve manter um histórico completo de todas as candidaturas: data, plataforma, empresa, vaga, status (enviada, erro, entrevista, rejeitada, aceita), e permitir exportação.

**Prioridade:** Média

**Critérios de Aceitação:**
- [ ] Registro automático de cada candidatura submetida com timestamp no Notion
- [ ] Status tracking: submitted, error, interview, rejected, accepted
- [ ] Atualização manual de status pelo usuário no Notion
- [ ] Visualização em tabela com filtros por plataforma/status/data
- [ ] Exportação para CSV/JSON

**Casos de Teste:**
- `CT-008.1`: Submeter candidatura → registro criado no Notion com status "submitted"
- `CT-008.2`: Usuário marca "interview" no Notion → status atualizado no sistema
- `CT-008.3`: Exportar CSV → arquivo válido com todas as colunas

---

## 3. Requisitos Não-Funcionais

### NFR-001: Performance — Busca de vagas

**Descrição:** A busca de vagas em múltiplas plataformas deve ser concluída em menos de 5 minutos para até 50 resultados por plataforma.
**Métrica:** Tempo total de busca (início da navegação até resultados consolidados) < 300s.
**Prioridade:** Alta
**Casos de Teste:**
- `CT-NFR-001.1`: Busca em 3 plataformas com ≤ 50 resultados cada → concluída em < 300s
- `CT-NFR-001.2`: Busca em 1 plataforma com 0 resultados → concluída em < 60s

---

### NFR-002: Privacidade e segurança de dados

**Descrição:** Currículos, dados pessoais e sessões de navegador não devem ser armazenados fora do ambiente local. Nenhuma senha é gerenciada pelo agente — apenas sessões reutilizadas via Chrome DevTools MCP.
**Métrica:** Auditoria de segurança: 0 segredos expostos (via `@security-secret-auditor`). Dados de sessão armazenados apenas localmente.
**Prioridade:** Alta
**Casos de Teste:**
- `CT-NFR-002.1`: Auditoria via `@security-secret-auditor` → 0 segredos expostos no código
- `CT-NFR-002.2`: Verificar que `profile.json` e sessões Chrome estão apenas em disco local → nenhum dado enviado a rede externa

---

### NFR-003: Robustez — Rate limiting e retry

**Descrição:** O sistema deve implementar controle de taxa (rate limiting) e retry com backoff exponencial para evitar bloqueios nas plataformas-alvo.
**Métrica:** Zero bloqueios permanentes por excesso de requisições durante operação normal (máx 10 req/min por plataforma).
**Prioridade:** Alta
**Casos de Teste:**
- `CT-NFR-003.1`: 15 requisições em 1 minuto para mesma plataforma → rate limiting bloqueia as 5 excedentes
- `CT-NFR-003.2`: Requisição falha por rate limit → retry com backoff exponencial em 5s, 25s, 125s...

---

### NFR-004: Extensibilidade — Novas plataformas

**Descrição:** O sistema deve permitir adicionar novas plataformas de vagas com mínimo esforço de código, através de configuração declarativa (playbook/script por plataforma).
**Métrica:** Tempo para adicionar nova plataforma < 2h de desenvolvimento.
**Prioridade:** Média
**Casos de Teste:**
- `CT-NFR-004.1`: Adicionar playbook para nova plataforma (ex: AngelList) → sistema busca na nova plataforma sem modificar código core
- `CT-NFR-004.2`: Playbook com formato inválido → erro claro de validação

---

### NFR-005: Disponibilidade — Modo offline/fallback

**Descrição:** O sistema deve funcionar mesmo sem conexão com APIs de IA externas, utilizando modelo local (Ollama) como fallback.
**Métrica:** Capacidade de operar 100% offline após configuração inicial.
**Prioridade:** Média
**Casos de Teste:**
- `CT-NFR-005.1`: API OpenAI configurada mas indisponível → fallback para Ollama local sem perda de funcionalidade
- `CT-NFR-005.2`: Nenhum modelo de IA disponível (nem Ollama) → operação contínua com regras heurísticas (keyword matching)

---

## 4. Referências Técnicas — Análise de Projetos Similares

### 4.1 auto-apply-template (yunbinbae)

| Atributo | Detalhe |
|----------|---------|
| **URL** | https://github.com/yunbinbae/auto-apply-template |
| **Stack** | Claude Code CLI + Playwright MCP + Notion MCP + Python (fpdf2) |
| **Licença** | MIT |
| **Custo** | US$ 0 (apenas assinatura Claude Max) |

#### Arquitetura

```
Terminal 1                        Terminal 2
/auto-apply (LinkedIn)            /auto-apply-gi (Glassdoor + Indeed)
       |                                  |
       +----------> Notion DB <-----------+
                   (dedup + tracker)
```

**Dois agentes Claude Code paralelos**, cada um com sua própria instância isolada do Playwright MCP (via `--isolated`). Compartilham um banco de dados Notion para desduplicação.

#### Tecnologias e Aplicação

| Tecnologia | Função no Projeto |
|------------|------------------|
| **Claude Code CLI** | Agente de IA que orquestra navegação, decisões e submissões |
| **Playwright MCP** | Automação de browser: navegação, clique, preenchimento de formulários, upload de arquivos |
| **Notion MCP** | Banco de dados compartilhado para tracking de candidaturas e desduplicação |
| **Python fpdf2** | Renderização local de cartas de apresentação em PDF (custo zero de API) |
| **CLAUDE.md** | Arquivo de configuração com identidade, histórico profissional, regras de preenchimento |
| **profile.json** | Perfil estruturado do candidato (dados pessoais, experiência, educação, skills) |

#### Fluxo de Execução

1. Agente lê configuração (CLAUDE.md + profile.json + RULES.md)
2. Consulta Notion para obter lista de empresas já aplicadas (dedup)
3. Playwright MCP abre navegador e navega até a plataforma de vagas
4. Aplica filtros (keywords, localização, senioridade, recency)
5. Para cada vaga elegível: gera carta de apresentação contextualizada via LLM
6. Preenche formulários multi-passo automaticamente
7. Faz upload do currículo PDF nos campos de arquivo do ATS
8. Registra submissão em Notion + `applied.jsonl` local

#### Plataformas Suportadas

- LinkedIn Easy Apply
- Glassdoor
- Indeed
- ATS externos: Greenhouse, Lever, Workday, Ashby, iCIMS, Taleo, SmartRecruiters

#### Limitações

- ~15-20 candidaturas/agente/dia (limite de uso do Claude Max)
- LinkedIn pode sinalizar contas com aplicações muito rápidas
- CAPTCHA e SMS verification são bloqueios não contornáveis (log como skip)
- Requer Node.js 18+ e macOS (Linux funcional, Windows não testado)

---

### 4.2 job-apply-plugin (neonwatty)

| Atributo | Detalhe |
|----------|---------|
| **URL** | https://github.com/neonwatty/job-apply-plugin |
| **Stack** | Claude Code CLI + Chrome MCP + Playwright MCP |
| **Licença** | MIT |
| **Instalação** | `claude plugin marketplace add neonwatty/job-apply-plugin` |

#### Arquitetura

```
Claude Code CLI
     |
     ├── Chrome MCP ──────────> LinkedIn (sessão autenticada)
     │       (navegação, login)
     │
     └── Playwright MCP ──────> Greenhouse, Ashby, Lever, Workday
             (form filling, file upload, iframes)
```

**Dual-tool architecture**: usa **Chrome MCP** para sites que exigem sessão autenticada (LinkedIn) e **Playwright MCP** para preenchimento de formulários e upload em ATS. Ambos os servidores MCP convivem na mesma sessão.

#### Tecnologias e Aplicação

| Tecnologia | Função |
|------------|--------|
| **Chrome MCP** (Claude in Chrome) | Navegação em sites autenticados — reusa sessão do navegador do usuário |
| **Playwright MCP** | Preenchimento de formulários, upload de arquivos, interação com iframes |
| **Claude Code CLI** | Agente principal com dois comandos: `/job-apply` e `/job-search` |

#### Funcionalidades

- **`/job-apply`**: Extrai perfil de currículo (PDF, DOCX, TXT) uma única vez, armazena em `~/.claude-job-profile.json`, e preenche formulários automaticamente quando recebe uma URL de vaga
- **`/job-search`**: Busca no LinkedIn com sugestão inteligente de keywords extraídas do currículo; identifica conexões de 1º grau e hiring managers; resultados salvos em `~/.claude-job-searches/`

#### Diferenciais

- **Segurança explícita**: nunca submete sem confirmação humana
- **Nunca gerencia senhas**: se login for necessário, o agente para e aguarda o usuário
- **Nunca cria contas**: o usuário deve criar contas manualmente
- **Mapeamento inteligente de campos**: casa perfil do usuário com campos do formulário automaticamente

#### Plataformas Suportadas

- LinkedIn Easy Apply (via Chrome MCP)
- Greenhouse, Ashby, Lever, Rippling, Workday (via Playwright MCP)

---

### 4.3 browser-use (browser-use)

| Atributo | Detalhe |
|----------|---------|
| **URL** | https://github.com/browser-use/browser-use |
| **Stars** | 30k+ |
| **Stack** | Python + Playwright + LLM (ChatBrowserUse, OpenAI, Claude, Gemini) |
| **Licença** | MIT |

#### Arquitetura

```
Agent (LLM) ──> Browser Context ──> Playwright ──> Web
     │
     └── Tools (custom actions)
```

Framework generalista de browser automation para AI agents. Não é específico para job applications, mas inclui exemplo funcional `apply_to_job.py`.

#### Tecnologias e Aplicação

| Tecnologia | Função |
|------------|--------|
| **Python + Playwright** | Automação de browser headless |
| **ChatBrowserUse** | Modelo proprietário otimizado para browser automation (US$ 0.20/1M input tokens) |
| **LLM Agnostic** | Suporta OpenAI, Claude, Gemini, Ollama |
| **CLI interativo** | `browser-use open/state/click/type/screenshot` para iteração rápida |
| **Claude Code Skill** | Skill oficial para Claude Code |

#### Diferenciais

- **Otimizado para tarefas de browser**: modelo próprio (`bu-30b-a3b-preview`) 3-5x mais rápido que LLMs genéricos
- **Stealth browsers**: versão cloud com proxy rotation e resolução de CAPTCHA
- **Persistência de sessão**: reuso de perfil Chrome com logins salvos
- **Custom tools**: API para estender o agente com ações customizadas
- **30k+ stars**: comunidade ativa e ecossistema maduro

---

### 4.4 jobber (sentient-engineering)

| Atributo | Detalhe |
|----------|---------|
| **URL** | https://github.com/sentient-engineering/jobber |
| **Stack** | Python + Playwright + OpenAI + LangChain + LangSmith |
| **Licença** | — |

#### Arquitetura

Duas implementações:
1. **jobber** (vanilla): multi-agent conversation entre planner + browser agent
2. **jobber_fsm** (finite state machine): escalável, dependente de structured output da OpenAI

#### Tecnologias e Aplicação

- Chrome em modo debug (`--remote-debugging-port=9222`) para reuso de sessão
- OpenAI Structured Outputs para garantir formato consistente nas respostas
- LangSmith para tracing e observabilidade
- `user_preferences.txt` para configurar preferências de busca
- Resume upload via browser controlado

---

### 4.5 Comparativo

| Critério | auto-apply-template | job-apply-plugin | browser-use | jobber |
|----------|---------------------|-----------------|-------------|--------|
| **Motor de IA** | Claude Code | Claude Code | Multi-LLM | OpenAI |
| **Custo operacional** | US$ 0 (c/ Max) | US$ 0 (c/ Max) | US$ 0.20/1M tok | API OpenAI |
| **Playwright MCP** | ✅ Nativo | ✅ Dual (Chrome+Play) | ✅ Nativo | ⚠️ Chrome raw |
| **Chrome MCP (auth)** | ❌ | ✅ Chrome MCP | ✅ real_browser.py | ⚠️ Raw CDP |
| **Tracking** | Notion + JSONL | JSON local | — | — |
| **Geração de carta** | ✅ LLM + fpdf2 | — | — | — |
| **Match score** | — | — | — | — |
| **Multi-plataforma** | LI+GD+IN+ATS | LI+Green+ATS | Genérico | LI |
| **Modo semiautom.** | ✅ | ✅ | — | ✅ |
| **Desduplicação** | ✅ Notion | — | — | — |
| **Segurança (senhas)** | Nunca armazena | Nunca armazena | — | — |

---

## 5. Padrões de Arquitetura Identificados

### Dual-Agent Pattern (auto-apply-template)
Dois agentes rodando em paralelo, cada um especializado em um conjunto de plataformas, compartilhando estado via DB central.

### Dual-MCP Pattern (job-apply-plugin)
Dois MCP servers diferentes no mesmo agente: Chrome para sites autenticados, Playwright para formulários públicos.

### Profile-First Setup (auto-apply-template, job-apply-plugin)
Extrair perfil do currículo uma única vez, armazenar localmente, reutilizar em todas as candidaturas. Evita reprocessamento.

---

## 6. Metodologia de Desenvolvimento (Meta-requisitos)

### Pipeline Harness Nexus

O desenvolvimento deste workflow segue o pipeline de 6 estágios do Nexus (SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT).

**Critérios de Aceitação:**
- [ ] Cada estágio do pipeline mapeado para uma fase do workflow
- [ ] Uso de `nexus-log` para observabilidade de cada etapa
- [ ] Uso de `nexus-memory` para persistir estado entre execuções
- [ ] Uso de `nexus-handoff` para retomada de contexto em sessões longas
- [ ] Cada REQ-ID mapeado e referenciado em commits

**Casos de Teste:**
- `CT-META.1`: Executar workflow completo do pipeline → todos os 6 estágios concluídos
- `CT-META.2`: Interromper e retomar via nexus-handoff → estado preservado
- `CT-META.3`: Logs de cada estágio registrados em `.opencode/logs/`
- `CT-META.4`: Estágio SPEC sem spec aprovada → pipeline bloqueia com notificação

---

## 7. Arquitetura Proposta (Visão Geral)

```
                        ┌──────────────────────────────────────────┐
                        │      Nexus Orquestrador (Harness)        │
                        │      Pipeline: 6 estágios SDD            │
                        │      + nexus-memory + nexus-log          │
                        └──────────────────────────────────────────┘
                                          │
           ┌──────────────────────────────┼──────────────────────────────┐
           ▼                              ▼                              ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│   REQ-001: Setup    │     │  Busca + Análise    │     │  Consolidação + Geração │
│   Chrome DevTools   │     │  (REQ-002/003)      │     │  + Aplicação          │
│   MCP               │     │                     │     │  (REQ-004/005/006/007/008)│
│   MCP               │     │                     │     │                      │
│                     │     │  LinkedIn: Chrome   │     │  Ollama/LLM + fpdf2  │
│  opencode.json      │     │  MCP (logado)       │     │  + Chrome DevTools   │
│  + chrome-devtools  │     │  GD/IN/MO: Playwr.  │     │  MCP + Playwright    │
│  + user login       │     │  MCP (headless)     │     │                      │
└─────────────────────┘     └──────────┬──────────┘     └──────────┬───────────┘
                                       │                           │
                                       ▼                           ▼
                              ┌──────────────────┐      ┌─────────────────────┐
                              │ LI │ GD │ IN │ MO│      │ LI EZ │ GH │ WD    │
                              │  (scraping)      │      │  (submissão)        │
                              └──────────────────┘      └─────────────────────┘
```

## 7. Dependências

- **Chrome DevTools MCP** (`npx chrome-devtools-mcp@latest --autoConnect`) — Sessão autenticada do Chrome para LinkedIn
- **Playwright MCP** (`@playwright/mcp@latest`) — Automação de navegador headless para demais plataformas
- **Ollama** (ou OpenAI/Claude API) — IA para análise de compatibilidade e geração de carta
- **Nexus Pipeline Harness** — Orquestração dos 6 estágios
- **Agentes Nexus:** @explorer, @fixer, @librarian, @security-secret-auditor, @quality-assurance-analyst
- **Ferramentas Nexus:** nexus-log, nexus-memory, nexus-handoff
- **Python** (fpdf2 + python-docx + PyMuPDF) — Geração de PDFs, DOCX e parse de currículos

## 8. Questões em Aberto

- [ ] Qual modelo de IA local (Ollama) será usado para análise de compatibilidade? (Recomendado: llama3 8B+ ou qwen2.5)
- [ ] Lidar com CAPTCHA: pular vaga e logar, ou notificar usuário para resolver manualmente?
- [ ] O currículo base final (consolidado) deve ser o DOCX de 1 página ou manter também versão em PDF?
- [ ] Qual estratégia de armazenamento para currículos adaptados? Apenas em memória durante a sessão ou persistentes?
- [ ] Usar browser-use como alternativa ao Playwright MCP puro? (30k+ stars, exemplo `apply_to_job.py`)

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 0.1.0 | 2026-05-14 | Nexus Orquestrador | Criação inicial |
| 0.2.0 | 2026-05-14 | Nexus Orquestrador | Remove REQ-001 original; renumera; adiciona análise técnica de projetos |
| 0.3.0 | 2026-05-14 | Nexus Orquestrador | Adiciona REQ-001 (Chrome DevTools MCP); renumera REQs e CTs; expande REQ-005 com plano detalhado de alteração de currículos; esclarece dual-MCP (Chrome + Playwright) |
| 0.4.0 | 2026-05-14 | Nexus Orquestrador | Adiciona REQ-004 (consolidação multi-PDF → DOCX ATS 1 página); renumera REQ-005→008; adiciona python-docx + PyMuPDF como dependências |
| 0.5.0 | 2026-05-14 | Nexus Orquestrador | Revisão @spec-reviewer: adiciona CTs para NFR-001→005 (10 CTs); edge cases REQ-003 (+3 CTs); regras de prioridade 1-página; corrige fluxo profile.json REQ-004→005; move REQ-008 para Metodologia; esclarece CLT/PJ; CT-004.5 com critérios objetivos |
