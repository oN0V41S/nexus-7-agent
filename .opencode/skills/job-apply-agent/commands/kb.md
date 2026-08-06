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
- `data/job-apply-agent/<slug>-kb-<YYYY-MM-DD>.md` — Knowledge Base completa

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

## Lógica de Geração de Knowledge Base
O comando gera automaticamente uma Knowledge Base .md completa seguindo a **Regra de Ouro KB**:

> **A KB é a FONTE DE VERDADE. Nunca simplifique, resuma, comprima ou omita informações.**

**O que é permitido:**
- Reorganizar por seção
- Normalizar formatação
- Unificar nomes iguais (ex: "SENAI" e "SENAI Suíço-Brasileira" → usar o mais completo)

**O que NÃO é permitido:**
- Resumir experiência em 1 linha
- Agrupar habilidades em "e outros"
- Omitir certificações "menores"
- Simplificar projetos para "breve descrição"

**Exemplo de saída:**
```
📄 Consolidando 2 PDFs em Knowledge Base...
✅ Knowledge Base gerada: data/job-apply-agent/rafael-novais-kb-2026-06-16.md

📋 Resumo da KB:
   • Contato: São Paulo, SP | (11) 99831-7761 | rafaelaugustonnovais@gmail.com
   • Resumo: Desenvolvedor Full Stack com experiência em Back-end (Java/Spring Boot, Node.js/NestJS, Python)
   • Experiência: 4 cargos principais (Arizona & Visto, Zyon Tech, Projeto Olho Mágico, SERPRO)
   • Skills: Java, Python, TypeScript/Node.js, SQL, AWS, Docker, Kubernetes, React, Next.js, Vue.js
   • Formação: Tecnólogo em Análise e Desenvolvimento de Sistemas (UNISA) + Técnico em Desenvolvimento de Sistemas (SENAI)
   • Certificações: Network Essentials (Cisco), LGPD (SENAI), Power BI e Python (SENAI)

💡 Use /job-adapt [vaga_id] para criar currículo adaptado a partir desta KB.
```
