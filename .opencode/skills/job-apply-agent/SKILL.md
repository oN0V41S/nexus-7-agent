---
name: job-apply-agent
description: Pipeline de busca multi-plataforma, análise de compatibilidade, consolidação de currículos em Knowledge Base .md, geração contextualizada de materiais, aplicação semiautomática e rastreamento de candidaturas.
---

# Job Apply Agent Skill

## Descrição
Skill para o pipeline de Job Application Workflow. Consome ferramentas MCP (Chrome DevTools, Playwright, Notion), modelos locais (Ollama) e scripts Python para executar o ciclo completo de candidatura a vagas.

**Spec de referência:** `docs/spec/job-application-workflow.spec.md`

---

## Capacidades
- **Busca Multi-plataforma:** LinkedIn (Chrome MCP), Glassdoor/Indeed/Monster (Playwright MCP)
- **Análise de Compatibilidade:** Match score via Ollama + heurística
- **Consolidação de Currículos:** Multi-PDF → Knowledge Base .md completa + DOCX ATS
- **Geração Contextualizada:** Currículo adaptado (Markdown → DOCX) + carta de apresentação (TXT)
- **Aplicação Semiautomática:** Revisão humana + submissão via MCPs
- **Desduplicação e Rastreamento:** Notion/JSONL + histórico

---

## Quando Usar Esta Skill
- O usuário quer buscar vagas em múltiplas plataformas (LinkedIn, Glassdoor, Indeed, Monster)
- O usuário precisa analisar compatibilidade entre currículo e vagas (match score)
- O usuário quer consolidar PDFs de currículo em Knowledge Base .md (fonte de verdade)
- O usuário precisa gerar currículo adaptado + carta de apresentação para uma vaga específica
- O usuário quer aplicar para vagas com revisão humana
- O usuário precisa rastrear histórico de candidaturas

## Quando NÃO Usar Esta Skill
- O usuário quer navegar na web em geral (use agent-browser ou playwright-agent)
- O usuário quer apenas extrair texto de PDF sem contexto de currículo (use ferramenta apropriada)
- O usuário quer gerenciar documentos Google Workspace (use google-workspace-agent)

---

## Comandos

| Comando | Descrição | Template |
|---------|-----------|----------|
| `/job-search [termo] [local] [filtros]` | Busca vagas em múltiplas plataformas | `commands/search.md` |
| `/job-analyze [vaga_id \| --all]` | Calcula match score (0-100%) e gaps | `commands/analyze.md` |
| `/job-consolidate [pdfs]` | Consolida PDFs em DOCX ATS + PDF + profile.json + KB | `commands/consolidate.md` |
| `/job-kb [pdfs] [--json] [--docx] [--output]` | Gera Knowledge Base .md completa do currículo | `commands/kb.md` |
| `/job-adapt [vaga_id]` | Gera currículo adaptado (MD + DOCX) + carta (TXT) | `commands/adapt.md` |
| `/job-apply [vaga_id \| --batch N]` | Executa aplicação com aprovação humana | `commands/apply.md` |
| `/job-track [ação] [args]` | Gerencia histórico de candidaturas | `commands/track.md` |

---

## Regras de Armazenamento

### 📍 Localização Única — `data/job-apply-agent/`

**TODOS os arquivos gerados pelo pipeline devem ser salvos em `data/job-apply-agent/`.**

| Artefato | Localização | Gerado por |
|----------|-------------|------------|
| Knowledge Base (.md) | `data/job-apply-agent/<slug>-kb-<YYYY-MM-DD>.md` | `/job-kb`, `/job-consolidate` |
| Currículo adaptado (MD + DOCX) | `data/job-apply-agent/<vaga_id>/resume_adapted.{md,docx}` | `/job-adapt` |
| Carta de apresentação (TXT) | `data/job-apply-agent/<vaga_id>/cover_letter.txt` | `/job-adapt` |
| DOCX ATS | `data/job-apply-agent/<slug>-ats-<YYYY-MM-DD>.docx` | `/job-consolidate` |
| Perfil estruturado | `data/job-apply-agent/<slug>-profile.json` | `/job-consolidate`, `/job-kb --json` |

> **Regra:** Se o diretório não existir, criá-lo automaticamente. Se o código atual salvar em outro local (ex: `~/.job-apply-agent/`), mover o arquivo para `data/job-apply-agent/` ao final da execução.

---

## Fluxo de Dados (Pipeline)

```
PDF(s)
  │
  ├── /job-consolidate → profile.json + resume_ats.docx
  │         │
  │         └── profile.json ──────────────────────────────────┐
  │                                                            │
  ├── /job-kb → data/job-apply-agent/<slug>-kb-<data>.md       │
  │               (fonte de verdade para currículos)            │
  │                                                            │
  /job-search → search_results.json                            │
       │                                                       │
       ▼                                                       │
  /job-analyze → analyzed_results.json (match score 0-100%)    │
       │                                                       │
       ▼                                                       ▼
  /job-adapt [vaga_id] → resume_adapted.md ──→ resume_adapted.docx
       │                      (Markdown)    MD→DOCX  (DOCX final)
       │
       ├── cover_letter.txt
       │
       ▼
  /job-apply [vaga_id] → applied.jsonl (ou skipped.jsonl)
       │
       ▼
  /job-track → listagem | export CSV/JSON | update status
```

### Dependências entre Comandos
- `/job-analyze` requer: `profile.json` + `search_results.json`
- `/job-adapt` requer: `profile.json` + `analyzed_results.json`
- `/job-apply` requer: materiais de `/job-adapt` + aprovação humana
- `/job-consolidate` e `/job-kb` são independentes (só precisam de PDFs)

---

## Estrutura do Pacote

```
src/job_apply_agent/
├── __init__.py          # Versão do pacote
├── __main__.py          # Entry point python -m
├── main.py              # CLI dispatch + cmd_kb()
├── config.py            # Configurações (paths, env vars, rate limiting)
├── search.py            # Busca multi-plataforma
├── analyzer.py          # Match score via Ollama/heurística
├── consolidator.py      # PDF → KB.md + DOCX ATS
├── generator.py         # Currículo adaptado (MD → DOCX) + carta (TXT)
├── applicator.py        # Aplicação semiautomática
├── tracker.py           # Rastreamento e exportação
├── deduplicator.py      # Prevenção de duplicatas
└── __tests__/           # Suite de testes (54+ testes)
```

Wrapper de execução: `run_job_agent.py` (ajusta PYTHONPATH e executa via `python -m src.job_apply_agent`)

---

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `OLLAMA_URL` | `http://localhost:11434` | URL do servidor Ollama |
| `OLLAMA_MODEL` | `llama3.1:8b` | Modelo para análise/generação |
| `OPENAI_API_KEY` | — | Fallback OpenAI (opcional) |
| `CLAUDE_API_KEY` | — | Fallback Anthropic (opcional) |
| `JOB_MAX_REQS_PER_MIN` | `10` | Rate limiting por plataforma de busca |

**Chrome isolado:** perfil em `/tmp/job-profile` (porta 9222)

---

## Dependências

```bash
# Python
pip install -r src/job_apply_agent/requirements.txt
# python-docx, PyMuPDF, fpdf2, httpx

# Ollama (local)
ollama serve && ollama pull llama3.1:8b

# MCPs (via opencode.json)
# Chrome DevTools MCP: sessão autenticada LinkedIn
# Playwright MCP: automação headless Glassdoor/Indeed/Monster
# Notion MCP: tracking (opcional)
```

---

## Critérios de Qualidade

### Para Knowledge Base .md
- [ ] Preserva TODO o conteúdo original — nada é omitido, resumido ou inventado
- [ ] Seções organizadas: Contato, Resumo, Experiência, Formação, Habilidades, Idiomas, Certificações, Projetos
- [ ] Seções opcionais só aparecem se existirem no original
- [ ] Nome do arquivo segue padrão `<slug>-kb-<YYYY-MM-DD>.md`
- [ ] Salvo em `data/job-apply-agent/`
- [ ] **Sanity check** pós-parsing: se Habilidades > 20 linhas contendo datas/empresas → alerta
- [ ] **Detecção de multi-curriculo**: nome completo em maiúsculo repetido → quebrar em docs separados
- [ ] **Cobertura de emoji**: cabeçalhos como 📌 RESUMO, 🛠️ COMPETÊNCIAS, 💼 EXPERIÊNCIA reconhecidos

### Para profile.json
- [ ] Contém ao menos: skills, experience, education
- [ ] Skills extraídas como lista de strings normalizadas
- [ ] Experiência e formação preservadas em texto contínuo

### Para DOCX ATS (consolidate) e DOCX de currículo adaptado (adapt)
- [ ] Fonte Calibri 10.5pt, margens 0.7in
- [ ] Layout linear (sem colunas, sem tabelas complexas)
- [ ] Máximo 1 página

### Para Markdown de currículo adaptado
- [ ] `# Nome` centralizado, `## Seções` em UPPERCASE, `### Sub-seções` com itálico
- [ ] `**bold**` para cargos, cursos e nomes de projetos
- [ ] `[texto](url)` para hyperlinks (GitHub, LinkedIn)
- [ ] `- ` para bullet points de responsabilidades e skills
- [ ] Seções decididas dinamicamente por `_build_section_list()`

### Para TXT de carta de apresentação
- [ ] UTF-8, texto plano sem formatação
- [ ] Contém: dados do candidato, data, referência da vaga, corpo, despedida

### Para Match Score
- [ ] Calculado via Ollama com fallback heurístico automático
- [ ] Score 0-100% com gaps e strengths identificados

### Para Aplicação
- [ ] Sempre requer aprovação humana antes da submissão
- [ ] Candidaturas duplicadas detectadas e puladas
- [ ] Rate limiting respeitado (10 req/min por plataforma)

---

## Pipeline de Geração — Markdown → DOCX

O pipeline de geração de currículo adaptado segue 3 etapas:

```
profile.json + job (analyzed_results.json)
        │
        ▼
┌─────────────────────────────┐
│  _build_section_list()      │  ← Decide quais seções incluir
│  (compara perfil vs vaga)   │     (sempre: summary, skills, exp, edu)
└─────────────────────────────┘  │  (condicional: languages, certs, projects, links)
        │                        │
        ▼                        ▼
┌─────────────────────────────┐
│  _build_resume_markdown()   │  ← Gera Markdown com formatação rica
│  (template orientado)       │     # Nome, ## Seções, ### Sub, **bold**
└─────────────────────────────┘  │  [links](url), - bullets, | contato
        │                        │
        ▼                        ▼
┌─────────────────────────────┐
│  _md_to_docx()              │  ← Converte MD → DOCX (python-docx)
│  (parser de Markdown)       │     H1 centrado, H2 uppercase, H3 itálico
└─────────────────────────────┘  │  bullets reais, hyperlinks clicáveis
        │                        │
        ▼                        ▼
  resume_adapted.md  ──────►  resume_adapted.docx
  (editável, versionável)      (formato final para envio)
```

### Funcionalidades do parser MD→DOCX
- `# Heading 1` → Nome centralizado, bold, Calibri 14pt
- `## Heading 2` → Seção em UPPERCASE, bold, Calibri 11pt
- `### Heading 3` → Sub-seção com **bold** para destaque + itálico geral
- `**texto**` → Negrito inline (funciona dentro de headings e bullets)
- `[texto](url)` → Hyperlink azul sublinhado
- `- item` → Bullet point real com recuo
- `item1 | item2 | item3` → Linha de contato com separadores

### Seções inteligentes (`_build_section_list`)
A função `_build_section_list(profile, job)` decide dinamicamente quais seções incluir:

| Seção | Sempre? | Condição |
|-------|---------|----------|
| Resumo Profissional | ✅ Sempre | — |
| Habilidades Técnicas | ✅ Sempre | — |
| Experiência Profissional | ✅ Sempre | — |
| Formação Acadêmica | ✅ Sempre | — |
| Idiomas | ❌ | Se `profile.languages` existe |
| Certificações | ❌ | Se `profile.certifications` existe |
| Projetos | ❌ | Se `profile.projects` existe |
| Links (GitHub/LinkedIn) | ❌ | Se perfil tem `github`/`linkedin`/`portfolio` |

---

## Lições Aprendidas (v1.0.0 → v1.3.0)

### Parser de PDF — Limitações Conhecidas
Baseado em auditoria real com PDF de 6 páginas contendo 2 versões de currículo:

| Problema | Impacto | Prioridade |
|----------|---------|------------|
| **Parser ingênuo** (`_guess_section` usa `startswith`) | Conteúdo cai na seção errada | 🔴 Alta |
| **Sem suporte a emoji** em cabeçalhos | Currículos modernos não são parseados | 🔴 Alta |
| **Sem detecção de multi-curriculo** | PDF com 2 currículos vira blob único | 🔴 Alta |
| **Sem sanity check pós-parsing** | Seção Habilidades vira catch-all de tudo | 🟡 Média |
| **Linhas quebradas por largura do PDF** | "Trabalho em / Equipe" vira 2 entradas | 🟡 Média |
| **Typos de OCR preservados** | GItHub, Equípes, Privacidede, Postgress | 🟢 Baixa |

### Recomendações de Melhoria (Pipeline Backlog)
1. **Parser baseado em LLM (Ollama)** para estruturação: texto bruto → JSON
2. **Detecção de multi-curriculo**: se nome completo aparece 2x → split
3. **Regex para cabeçalhos**: `r"[\U0001F300-\U0001FAFF]\s*([A-ZÁ-Ú\s]{5,})"`
4. **Junção de linhas quebradas** antes do parsing
5. **Validação de sanity check** pós-parsing
6. **Normalização ortográfica** por mini-dicionário

### Gatilho de Reparo
Se `/job-kb` produzir uma KB onde:
- Seção Habilidades tem > 20 linhas **E** contém datas/empresas
- Conteúdo de experiência aparece dentro de Habilidades
- nome completo aparece mais de 1x no corpo (fora do cabeçalho)

→ **Disparar revisão manual** + registrar no log como `quality:fail`
→ Considerar reprocessar com flags `--repair` (tenta re-parse)

### Formato de Saída — MD → DOCX (v1.4.0)
- **Currículo adaptado:** Gerado primeiro em **Markdown** (`.md`) com formatação rica, depois convertido para **DOCX** (`.docx`)
  - Markdown intermediário permite edição manual e versionamento
  - DOCX final com formatação profissional: Calibri, seções hierárquicas, bullets, hyperlinks
  - Seções são decididas dinamicamente comparando perfil vs. vaga
- **Carta de apresentação:** TXT (UTF-8 texto plano) com data automática
- **Motivação:** Markdown oferece controle total sobre formatação antes da conversão para DOCX; PDF com fpdf2 gerava aparência inconsistente
- **Parser MD→DOCX** suporta: `#`, `##`, `###`, `**bold**`, `[links](url)`, `- bullets`, linhas de contato

---

## Segurança
- Usa perfil Chrome isolado (`--user-data-dir=/tmp/job-profile`)
- Nunca armazena senhas — reusa sessões existentes via Chrome DevTools MCP
- Ollama como padrão (fallback opcional para APIs cloud com env vars)
- Input sanitization contra prompt injection

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 1.0.0 | 2026-06-16 | Nexus Orquestrador | Criação — regras de armazenamento KB, pipeline, qualidade |
| 1.1.0 | 2026-06-16 | Nexus Orquestrador | Adicionado sanity checks, lições aprendidas, limitações do parser, detecção de multi-curriculo, suporte a emoji |
| 1.2.0 | 2026-06-16 | Nexus Orquestrador | Regra unificada: TODOS os artefatos salvos em `data/job-apply-agent/` |
| 1.3.0 | 2026-06-17 | Nexus Orquestrador | Currículo DOCX em vez de PDF (python-docx); Carta TXT em vez de PDF; removido fpdf2 da geração principal |
| 1.4.0 | 2026-06-17 | Nexus Orquestrador | **Markdown-first pipeline**: currículo gerado em MD → convertido para DOCX; seções dinâmicas via `_build_section_list`; parser MD→DOCX com suporte a headers, bold, hyperlinks, bullets; `_add_hyperlink` com fallback seguro; `generator.py` v3.0.0 |

## Notion Tracking

A página de Tracking de Candidaturas no Notion está em:
- **URL fixa:** `https://app.notion.com/p/rafaelnovais/Tracking-de-Candidaturas-3823da06f61381fcbd75d7cc2fb46985`
- **Page ID:** `3823da06-f613-81fc-bd75-d7cc2fb46985`
- **Workspace:** "Notion de Rafael Novais"

Sempre consolidar/atualizar o tracking NESTA página específica. Adicionar blocos de conteúdo (parágrafos, bulleted lists) com: ID da vaga, empresa, cargo, score, status, plataforma, prazo, URL.
