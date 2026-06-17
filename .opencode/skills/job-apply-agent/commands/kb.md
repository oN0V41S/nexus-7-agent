# /job-kb - Knowledge Base do Currículo

Gera uma Knowledge Base completa em Markdown (.md) com TODO o conteúdo do currículo do candidato, consolidando todos os PDFs de entrada em um único arquivo que serve como fonte de verdade para criação de currículos adaptados.

## Uso
```
/job-kb [caminho_pdf1] [caminho_pdf2] ...
/job-kb [caminho_pdf1] --json    # Gera também profile.json
/job-kb [caminho_pdf1] --docx    # Gera também DOCX ATS
/job-kb [caminho_pdf1] --output ./pasta/   # Diretório customizado
/job-kb ./pasta/                 # Processa todos PDFs de um diretório
```

## Processo
1. Extrai texto de cada PDF (PyMuPDF)
2. Parseia seções (experiência, formação, habilidades, etc.)
3. Gera arquivo .md completo com TODAS as informações preservadas
4. (Opcional) Gera profile.json e/ou DOCX ATS via flags

## Saída
- `data/curriculos/<nome>-kb-2026-06-16.md` — Knowledge Base completa

## Diferença para /job-consolidate
- `/job-consolidate`: foco em DOCX ATS + JSON (currículo resumido para candidatura)
- `/job-kb`: foco em conhecimento COMPLETO do candidato (base para criar currículos)

## Execução
```bash
cd /workspaces/nexus-7-agent && PYTHONPATH=src python -m src.job_apply_agent kb [caminho_pdf1] [caminho_pdf2] ...
```

Ou via wrapper:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py kb [caminho_pdf1] [caminho_pdf2] ...
```
