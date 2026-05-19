# /job-consolidate - Consolidação de Currículos

Extrai texto de múltiplos PDFs de currículo e gera DOCX ATS de 1 página + PDF.

## Uso
```
/job-consolidate [caminho_pdf1] [caminho_pdf2] ...
```

## Processo
1. Extrai texto de cada PDF (PyMuPDF)
2. Parseia seções (experiência, formação, habilidades, etc.)
3. Faz merge de múltiplos perfis
4. Gera DOCX padronizado ATS
5. Gera PDF de saída
6. Salva profile.json para uso nos próximos passos

## Arquivos gerados
- `~/.job-apply-agent/profile.json` — perfil estruturado do candidato
- `~/.job-apply-agent/output/resume_ats.docx` — currículo ATS
- `~/.job-apply-agent/output/resume_ats.pdf` — currículo PDF

## Execução
Para executar a consolidação, rode o comando Python com os caminhos dos PDFs:
```bash
cd /workspaces/nexus-7-agent && PYTHONPATH=src python -m src.job_apply_agent consolidate [caminho_pdf1] [caminho_pdf2] ...
```

Ou via wrapper:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py consolidate [caminho_pdf1] [caminho_pdf2] ...
```
