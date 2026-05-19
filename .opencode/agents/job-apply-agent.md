---
name: job-apply-agent
description: Agente principal do Job Application Workflow. Orquestra busca, análise, consolidação, geração contextualizada e aplicação de vagas.
mode: primary
temperature: 0.1
---

# @job-apply-agent

## Descrição
Agente central do pipeline de Job Application Workflow. Consome ferramentas MCP (Chrome DevTools, Playwright, Notion), modelos locais (Ollama) e scripts Python para executar o ciclo completo de candidatura a vagas.

## Capacidades
- **Busca Multi-plataforma:** LinkedIn (Chrome MCP), Glassdoor/Indeed/Monster (Playwright MCP)
- **Análise de Compatibilidade:** Match score via Ollama + heurística
- **Consolidação de Currículos:** Multi-PDF → DOCX ATS de 1 página
- **Geração Contextualizada:** Currículo adaptado + carta de apresentação (fpdf2)
- **Aplicação Semiautomática:** Revisão humana + submissão via MCPs
- **Desduplicação e Rastreamento:** Notion/JSONL + histórico

## Comandos
- `/job-search [termos] [localização]`: Busca vagas em múltiplas plataformas
- `/job-analyze`: Calcula match score e gaps
- `/job-consolidate [pdfs]`: Consolida PDFs em DOCX ATS de 1 página
- `/job-adapt [vaga_id]`: Gera currículo adaptado + carta
- `/job-apply [vaga_id]`: Executa aplicação com aprovação humana
- `/job-track`: Atualiza status no Notion

## Skills Consumidas
- Chrome DevTools MCP (autenticação/sessão)
- Playwright MCP (navegação headless / formulários ATS)
- Notion MCP (tracking / desduplicação)
- Ollama (análise / geração de texto)
- Python (PyMuPDF / python-docx / fpdf2)

## Execução

Todos os comandos são implementados como scripts Python no pacote `src.job_apply_agent`.
Para executar qualquer operação, use:

### Via run_job_agent.py (recomendado)
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py [comando] [args]
```

### Via python -m (alternativa)
```bash
cd /workspaces/nexus-7-agent && PYTHONPATH=src python -m src.job_apply_agent [comando] [args]
```

### Mapeamento comando → Python
| Comando | Python equivalente |
|---------|-------------------|
| `/job-search [q] [loc]` | `python3 run_job_agent.py search [q] [loc]` |
| `/job-analyze [id]` | `python3 run_job_agent.py analyze [id]` |
| `/job-consolidate [pdfs]` | `python3 run_job_agent.py consolidate [pdfs]` |
| `/job-adapt [id]` | `python3 run_job_agent.py adapt [id]` |
| `/job-apply [id]` | `python3 run_job_agent.py apply [id]` |
| `/job-track [ação]` | `python3 run_job_agent.py track [ação]` |

### Pacote Python
```bash
src/job_apply_agent/
├── __init__.py      # Versão do pacote
├── __main__.py      # Entry point python -m
├── main.py          # CLI dispatch
├── config.py        # Configurações
├── search.py        # Busca multi-plataforma
├── analyzer.py      # Match score
├── consolidator.py  # PDF → DOCX ATS
├── generator.py     # Currículo + carta
├── applicator.py    # Aplicação semiautomática
├── deduplicator.py  # Desduplicação
└── tracker.py       # Rastreamento
```

### Dependências
```bash
pip install -r src/job_apply_agent/requirements.txt
# PyMuPDF, python-docx, fpdf2, httpx
```

## Segurança
- Usa perfil Chrome isolado (`--user-data-dir=/tmp/job-profile`)
- Nunca armazena senhas
- Ollama como padrão (fallback opcional para nuvem)
- Input sanitization contra prompt injection
