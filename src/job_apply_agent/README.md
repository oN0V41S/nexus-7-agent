# Job Application Workflow

Workflow autônomo do ecossistema Nexus 7 Agent para automação do processo de candidatura a vagas de emprego. Implementa o pipeline completo: busca → análise → consolidação → geração → aplicação → rastreamento.

## Visão Geral

O Job Application Workflow resolve o problema de profissionais de TI gastarem tempo excessivo (em média 11h/semana) procurando e aplicando para vagas manualmente. O sistema opera em modo semiautomático: sugere vagas e adaptações de currículo, e o usuário aprova antes de aplicar.

### Arquitetura do Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    Pipeline de 6 Estágios                        │
├─────────────────────────────────────────────────────────────────┤
│  SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Módulos do Workflow                          │
├─────────────────────────────────────────────────────────────────┤
│  search.py     → Busca multi-plataforma (LinkedIn, Glassdoor,  │
│                 Indeed, Monster)                                │
│  analyzer.py   → Análise de compatibilidade e match score      │
│  consolidator.py→ Consolidação de PDFs em DOCX ATS 1 página    │
│  generator.py  → Geração contextualizada de currículo + carta  │
│  applicator.py → Aplicação semiautomática com aprovação        │
│  tracker.py    → Rastreamento e exportação de candidaturas      │
│  deduplicator.py→ Prevenção de candidaturas duplicadas          │
│  config.py     → Configurações e gerenciamento de estado        │
└─────────────────────────────────────────────────────────────────┘
```

## Requisitos

### Dependências Python

```bash
pip install -r requirements.txt
```

Principais dependências:
- `httpx` — Requisições HTTP para Ollama
- `fitz` (PyMuPDF) — Extração de texto de PDFs
- `python-docx` — Geração de documentos DOCX
- `fpdf2` — Geração de PDFs

### Dependências Externas

- **Ollama** (opcional) — Modelo local para análise de compatibilidade e geração de conteúdo
  ```bash
  ollama serve
  ollama pull llama3.1:8b
  ```
- **Chrome DevTools MCP** — Sessão autenticada para LinkedIn (opcional)
- **Playwright MCP** — Automação headless para demais plataformas (opcional)

### Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `OLLAMA_URL` | `http://localhost:11434` | URL do servidor Ollama |
| `OLLAMA_MODEL` | `llama3.1:8b` | Modelo Ollama para análise |
| `OPENAI_API_KEY` | — | Chave API OpenAI (fallback) |
| `CLAUDE_API_KEY` | — | Chave API Claude (fallback) |
| `JOB_MAX_REQS_PER_MIN` | `10` | Rate limiting por plataforma |

## Instalação

1. Clone o repositório:
   ```bash
   cd /workspaces/nexus-7-agent
   ```

2. Instale as dependências:
   ```bash
   pip install -r src/job_apply_agent/requirements.txt
   ```

3. Configure as variáveis de ambiente (opcional):
   ```bash
   export OLLAMA_MODEL="llama3.1:8b"
   export JOB_MAX_REQS_PER_MIN=10
   ```

4. Verifique a instalação:
   ```bash
   python -m src.job_apply_agent.main --help
   ```

## Uso

### Executar via Módulo

```bash
python -m src.job_apply_agent.main <comando> [args]
```

### Comandos Disponíveis

#### 1. Consolidar Currículo (REQ-004)

Consolida múltiplos PDFs de currículo em um DOCX ATS de 1 página.

```bash
python -m src.job_apply_agent.main consolidate cv1.pdf cv2.pdf cv3.pdf
```

**Saída:**
- `~/.job-apply-agent/profile.json` — Perfil estruturado
- `~/.job-apply-agent/output/resume_ats.docx` — Currículo ATS
- `~/.job-apply-agent/output/resume_ats.pdf` — Versão PDF

#### 2. Buscar Vagas (REQ-002)

Busca vagas em múltiplas plataformas simultaneamente.

```bash
python -m src.job_apply_agent.main search "Frontend Engineer" "São Paulo, Brazil"
```

**Parâmetros:**
- `query` — Termo de busca (ex: "React Developer")
- `location` — Localização (ex: "São Paulo, Brazil" ou "Remote")
- `filters` — Filtros opcionais (tipo, senioridade, data)

**Saída:** `~/.job-apply-agent/search_results.json`

#### 3. Analisar Compatibilidade (REQ-003)

Calcula match score (0-100%) entre perfil e vagas.

```bash
python -m src.job_apply_agent.main analyze
```

**Saída:** `~/.job-apply-agent/analyzed_results.json`

Para analisar uma vaga específica:
```bash
python -m src.job_apply_agent.main analyze li-0001
```

#### 4. Gerar Materiais Adaptados (REQ-005)

Gera currículo adaptado e carta de apresentação para uma vaga.

```bash
python -m src.job_apply_agent.main adapt li-0001
```

**Saída:**
- `~/.job-apply-agent/output/li-0001/resume_adapted.pdf`
- `~/.job-apply-agent/output/li-0001/cover_letter.pdf`

#### 5. Aplicar para Vaga (REQ-006)

Executa aplicação com aprovação humana obrigatória.

```bash
python -m src.job_apply_agent.main apply li-0001
```

Aplicação em lote (todas com score >= 70%):
```bash
python -m src.job_apply_agent.main apply --batch 70
```

#### 6. Rastrear Candidaturas (REQ-008)

Lista todas as candidaturas registradas.

```bash
python -m src.job_apply_agent.main track
```

Atualizar status de uma candidatura:
```bash
python -m src.job_apply_agent.main track update li-0001 interview
```

Exportar candidaturas:
```bash
python -m src.job_apply_agent.main track export csv
python -m src.job_apply_agent.main track export json
```

## Estrutura dos Módulos

```
src/job_apply_agent/
├── __init__.py          # Versão do pacote
├── __main__.py          # Entry point alternativo
├── main.py              # Orquestrador de comandos CLI
├── config.py            # Configurações e caminhos
├── search.py            # Busca multi-plataforma (REQ-002)
├── analyzer.py          # Análise de compatibilidade (REQ-003)
├── consolidator.py      # Consolidação PDF→DOCX ATS (REQ-004)
├── generator.py         # Geração contextualizada (REQ-005)
├── applicator.py        # Aplicação semiautomática (REQ-006)
├── tracker.py           # Rastreamento e exportação (REQ-008)
├── deduplicator.py      # Prevenção de duplicatas (REQ-007)
└── __tests__/           # Suite de testes (54 testes)
    ├── test_config.py
    ├── test_search.py
    ├── test_analyzer.py
    ├── test_consolidator.py
    ├── test_generator.py
    ├── test_applicator.py
    ├── test_tracker.py
    └── test_deduplicator.py
```

### Descrição dos Módulos

| Módulo | Descrição | REQ |
|--------|-----------|-----|
| `config.py` | Gerencia configurações, caminhos de arquivos e estado | — |
| `search.py` | Busca vagas em LinkedIn, Glassdoor, Indeed, Monster | REQ-002 |
| `analyzer.py` | Extrai requisitos e calcula match score (0-100%) | REQ-003 |
| `consolidator.py` | Consolida múltiplos PDFs em DOCX ATS 1 página | REQ-004 |
| `generator.py` | Gera currículo adaptado + carta de apresentação | REQ-005 |
| `applicator.py` | Orquestra aplicação com aprovação humana | REQ-006 |
| `tracker.py` | Lista, atualiza e exporta candidaturas | REQ-008 |
| `deduplicator.py` | Impede candidaturas duplicadas | REQ-007 |

## Fluxo de Uso Recomendado

```
1. Consolidar Currículo
   └─> python -m src.job_apply_agent.main consolidate cv.pdf

2. Buscar Vagas
   └─> python -m src.job_apply_agent.main search "React" "São Paulo"

3. Analisar Compatibilidade
   └─> python -m src.job_apply_agent.main analyze

4. (Opcional) Gerar Materiais para uma Vaga
   └─> python -m src.job_apply_agent.main adapt li-0001

5. Aplicar para Vaga(s)
   └─> python -m src.job_apply_agent.main apply li-0001
   └─> python -m src.job_apply_agent.main apply --batch 70

6. Rastrear Candidaturas
   └─> python -m src.job_apply_agent.main track
   └─> python -m src.job_apply_agent.main track export csv
```

## Formato do Perfil (profile.json)

O perfil é gerado automaticamente pela consolidação de currículos:

```json
{
  "skills": ["React", "Node.js", "Python", "AWS", "Docker"],
  "experience": "...",
  "education": "...",
  "summary": "...",
  "languages": "...",
  "certifications": "..."
}
```

Para campos adicionais (nome, email, telefone), edite manualmente o arquivo `~/.job-apply-agent/profile.json`.

## Formato ATS do Currículo Consolidados

O DOCX gerado segue padrões ATS (Applicant Tracking System):

- **Fonte:** Calibri 11pt
- **Margens:** 0.7 polegadas (1,78cm)
- **Layout:** Linear, sem colunas
- **Seções:** Contato → Resumo → Habilidades → Experiência → Formação → Idiomas → Certificações

## Testes

Executar todos os testes:
```bash
python -m pytest src/job_apply_agent/__tests__/ -v
```

Executar testes de um módulo específico:
```bash
python -m pytest src/job_apply_agent/__tests__/test_analyzer.py -v
```

## Integração com Nexus Harness

O workflow utiliza as ferramentas do ecossistema Nexus:

- `nexus-log` — Observabilidade de cada estágio
- `nexus-memory` — Persistência de estado entre sessões
- `nexus-handoff` — Retomada de contexto em sessões longas

## Limitações e Considerações

1. **Rate Limiting:** O sistema limita a 10 requisições/minuto por plataforma para evitar bloqueios.

2. **Modo Semiautomático:** Toda aplicação requer aprovação humana antes da submissão.

3. **Segurança:** Nenhuma senha é armazenada. Sessões de navegador são reutilizadas via Chrome DevTools MCP.

4. **Fallback Heurístico:** Se Ollama não estiver disponível, o sistema usa extração de keywords para análise de compatibilidade.

5. **Integração MCP:** As integrações com Chrome DevTools MCP e Playwright MCP são placeholders para desenvolvimento. A integração real requer configuração adicional no `opencode.json`.

## Referências

- **Spec:** `docs/spec/job-application-workflow.spec.md`
- **Projeto Similar:** [auto-apply-template](https://github.com/yunbinbae/auto-apply-template)
- **Projeto Similar:** [job-apply-plugin](https://github.com/neonwatty/job-apply-plugin)

---

**Versão:** 0.5.0  
**Autor:** Nexus Orquestrador  
**Última Atualização:** 2026-05-19