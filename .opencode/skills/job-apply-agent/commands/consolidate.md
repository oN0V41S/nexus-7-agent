# /job-consolidate - Consolidação de Currículos

Processa múltiplos PDFs e gera DOCX ATS de 1 página.

## Uso
```
/job-consolidate [pdf1] [pdf2] ... [output_dir]
```

## Processo
1. Extrai texto de cada PDF (PyMuPDF)
2. Verifica se pertencem à mesma pessoa
3. Mescla conteúdo com melhor de cada versão
4. Resolve contradições
5. Gera DOCX ATS-ready em 1 página
6. Salva profile.json para reuso

## Formato ATS
- Sem colunas, tabelas, imagens
- Fonte Calibri (10-12pt corpo, 14-16pt títulos)
- Margens 2.54cm
- Seções: Contato → Resumo → Experiência → Educação → Skills → Certificações
