# /job-consolidate - Consolidação de Currículos

Extrai texto de múltiplos PDFs de currículo e gera DOCX ATS de 1 página + PDF + Knowledge Base.

## Uso
```
/job-consolidate [caminho_pdf1] [caminho_pdf2] ...
```

## Processo
1. Extrai texto de cada PDF (PyMuPDF)
2. Parseia seções (experiência, formação, habilidades, etc.)
3. Faz merge de múltiplos perfis
4. Gera DOCX padronizado ATS (1 página)
5. Gera PDF de saída
6. Gera Knowledge Base .md completa (fonte de verdade)
7. Salva profile.json para uso nos próximos passos

## Arquivos gerados
- `~/.job-apply-agent/profile.json` — perfil estruturado do candidato
- `~/.job-apply-agent/output/resume_ats.docx` — currículo ATS
- `~/.job-apply-agent/output/resume_ats.pdf` — currículo PDF
- `data/job-apply-agent/<slug>-kb-<YYYY-MM-DD>.md` — Knowledge Base completa

## Execução
Para executar a consolidação, rode o comando Python com os caminhos dos PDFs:
```bash
cd /workspaces/nexus-7-agent && PYTHONPATH=src python -m src.job_apply_agent consolidate [caminho_pdf1] [caminho_pdf2] ...
```

Ou via wrapper:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py consolidate [caminho_pdf1] [caminho_pdf2] ...
```

## Lógica de Geração de Knowledge Base
O comando gera automaticamente uma Knowledge Base .md completa:
- **Sempre**: Gera Knowledge Base .md com TODO o conteúdo do currículo
- **Flag --json**: Gera também profile.json (comportamento padrão)
- **Flag --docx**: Gera também DOCX ATS (comportamento padrão)
- **Flag --output**: Diretório customizado para saída

**Exemplo de saída:**
```
📄 Consolidando 3 PDFs...
✅ Perfil salvo em ~/.job-apply-agent/profile.json
✅ DOCX gerado: ~/.job-apply-agent/output/resume_ats.docx
✅ PDF gerado: ~/.job-apply-agent/output/resume_ats.pdf
✅ Knowledge Base gerada: data/job-apply-agent/rafael-novais-kb-2026-06-16.md

💡 Use /job-adapt [vaga_id] para criar currículo adaptado a partir desta KB.
```
