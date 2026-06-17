---
title: "Knowledge Base de Currículo — Consolidação Completa do Candidato"
status: "draft"
author: "Nexus Orquestrador"
created: "2026-06-16"
updated: "2026-06-16"
version: "0.2.0"
---

# Knowledge Base de Currículo — Spec

## 1. Visão Geral

**Problema:** O comando `/job-consolidate` atual extrai o perfil do candidato de PDFs e gera um `profile.json` (estruturado) e um `DOCX ATS` (formatado para candidatura). Porém não gera uma base de conhecimento completa em Markdown que possa servir como fonte central para a criação de currículos adaptados para diferentes vagas.

**Usuário alvo:** Profissionais de TI usando o Nexus Job Apply Agent para gerenciar currículos e candidaturas.

**Contexto:** Expansão do comando `/job-consolidate` existente (definido em `docs/spec/job-application-workflow.spec.md`, REQ-004). O pipeline de extração atual é: `PDF(s) → merge → profile.json + DOCX ATS`. Vamos adicionar `→ knowledge-base.md`, que servirá como fonte de verdade para os comandos de adaptação de currículo.

**Objetivo principal:** O `.md` gerado não é um simples "export legível" — é uma **base de conhecimento consolidada** contendo TODO o conteúdo do(s) currículo(s) de entrada, estruturado de forma que possa ser usado como fonte para:
1. Criação de currículos adaptados por vaga (`/job-adapt`)
2. Análise de match score (`/job-analyze`)
3. Versionamento e revisão humana do perfil completo

---

## 2. Requisitos Funcionais

### REQ-001: Consolidação completa do candidato em .md (Knowledge Base)

**Descrição:** O sistema deve gerar um arquivo Markdown (.md) contendo o **currículo completo e detalhado do candidato**, consolidando todas as informações de entrada (PDFs, DOCX, TXT) em uma base de conhecimento única. Este arquivo serve como fonte de verdade para criação de currículos adaptados.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] O .md é gerado automaticamente após a consolidação dos PDFs via `/job-consolidate`
- [ ] O nome do arquivo segue o padrão `<nome-normalizado>-kb-<YYYY-MM-DD>.md` (ex: `joao-silva-kb-2026-06-16.md`)
- [ ] O arquivo contém **todas** as seções do currículo de forma completa e detalhada:
  - Informações de Contato (completas)
  - Resumo Profissional (texto integral)
  - Experiência Profissional (descrições completas, não resumidas)
  - Formação Acadêmica
  - Skills Técnicas e Comportamentais
  - Certificações
  - Idiomas
  - Projetos Relevantes
  - Publicações/Palestras (se houver)
  - Informações adicionais relevantes
- [ ] Dados **completos e fiéis** às fontes de entrada — nada é omitido, resumido ou inventado
- [ ] Estrutura padronizada para permitir parsing automatizado por outros comandos (`/job-adapt`, `/job-analyze`)
- [ ] Formatação Markdown limpa e consistente: headings hierárquicos, listas, bold para ênfase
- [ ] O arquivo é salvo em `data/curriculos/` (criado automaticamente se não existir)
- [ ] Compatível com qualquer formato de entrada (PDF, DOCX, TXT) já suportados pelo consolidate
- [ ] Suporte a múltiplos arquivos de entrada: 6 páginas de currículo em PDF → consolidado em 1 .md completo

**Casos de Teste:**
- `CT-001.1`: Consolidar 1 PDF de 6 páginas → knowledge-base.md gerado com TODAS as informações preservadas
- `CT-001.2`: Consolidar 3 PDFs da mesma pessoa → knowledge-base.md com dados mesclados corretamente
- `CT-001.3`: PDF sem seção de certificações → knowledge-base.md gerado sem a seção (não inventa)
- `CT-001.4`: Nome do arquivo gerado → normalizado corretamente (ex: "João Silva" → "joao-silva-kb-2026-06-16.md")
- `CT-001.5`: Diretório `data/curriculos/` não existe → criado automaticamente
- `CT-001.6`: Arquivo .md gerado pode ser lido e processado pelo `/job-adapt` para criar currículo adaptado
- `CT-001.7`: Arquivo .md gerado pode ser lido e processado pelo `/job-analyze` para calcular match score

---

### REQ-002: Comando dedicado para consolidação e geração da knowledge base

**Descrição:** Criar um comando dedicado (ex: `/job-kb` ou expandir `/job-consolidate`) que processa os currículos de entrada e gera exclusivamente a knowledge base .md, com flags para controle de saída.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Comando aceita 1 ou mais arquivos de entrada: `/job-kb [arquivo1.pdf] [arquivo2.pdf] ...`
- [ ] Comando aceita diretório: `/job-kb ./curriculos/`
- [ ] Gera arquivo .md completo em `data/curriculos/`
- [ ] Flag `--json` gera também o profile.json
- [ ] Flag `--docx` gera também o DOCX ATS
- [ ] Flag `--output` permite especificar diretório de saída customizado
- [ ] Mensagens de progresso claras durante o processamento
- [ ] Resumo ao final: "Knowledge base gerada: data/curriculos/joao-silva-kb-2026-06-16.md"

**Casos de Teste:**
- `CT-002.1`: `/job-kb curriculo.pdf` → knowledge base gerada sem side effects (sem JSON/DOCX)
- `CT-002.2`: `/job-kb curriculo.pdf --json` → knowledge base + profile.json
- `CT-002.3`: `/job-kb ./pasta/` → processa todos PDFs do diretório
- `CT-002.4`: `/job-kb arquivo-inexistente.pdf` → erro claro: "Arquivo não encontrado"
- `CT-002.5`: `/job-kb` sem argumentos → erro claro: "Informe ao menos um arquivo de currículo"

---

### REQ-003: Pipeline de pesquisa e aplicação baseado na knowledge base

**Descrição:** O sistema deve permitir executar o fluxo completo a partir da knowledge base consolidada: knowledge base → buscar vagas → analisar compatibilidade → adaptar currículo → aplicar.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] `/job-consolidate [arquivo]` gera `profile.json` + `knowledge-base.md` + `DOCX` em `data/curriculos/`
- [ ] `/job-kb [arquivo]` gera apenas `knowledge-base.md` (consolidação limpa)
- [ ] `/job-search [termo] [local]` utiliza a knowledge base para sugerir termos de busca
- [ ] `/job-analyze` calcula match score entre knowledge base e vagas encontradas
- [ ] `/job-adapt [vaga_id]` usa a knowledge base como fonte para gerar currículo adaptado
- [ ] `/job-apply [vaga_id]` executa aplicação com aprovação humana
- [ ] Todo o fluxo é encadeável: kb → search → analyze → adapt → apply

**Casos de Teste:**
- `CT-003.1`: Fluxo completo com knowledge base → aplicação bem-sucedida (end-to-end)
- `CT-003.2`: `/job-analyze` sem `search_results.json` → erro claro "Execute /job-search primeiro"
- `CT-003.3`: `/job-adapt` sem `analyzed_results.json` → erro claro "Execute /job-analyze primeiro"
- `CT-003.4`: `/job-adapt` sem knowledge base → erro claro "Execute /job-kb ou /job-consolidate primeiro"
- `CT-003.5`: `/job-adapt` com knowledge base → currículo adaptado gerado a partir da KB

---

## 3. Requisitos Não-Funcionais

### NFR-001: Compatibilidade com formatos atuais

**Descrição:** A geração da knowledge base .md não deve quebrar os formatos de saída existentes (profile.json, DOCX, PDF).
**Métrica:** Testes existentes do `/job-consolidate` continuam passando sem alterações.
**Prioridade:** Alta

### NFR-002: Performance

**Descrição:** A geração do .md deve ser executada em < 2s adicional sobre o tempo de consolidação (tolerância maior por ser uma base completa).
**Métrica:** Tempo total de consolidação com .md não excede o tempo sem .md em mais de 2 segundos.
**Prioridade:** Baixa

### NFR-003: Encadeabilidade

**Descrição:** A knowledge base .md deve ser legível por máquina (formato consistente) para permitir parsing pelos comandos `/job-adapt` e `/job-analyze`.
**Métrica:** Comandos downstream conseguem extrair seções da KB via parsing de headings.
**Prioridade:** Alta

---

## 4. Dependências

- **Código existente:** `src/job_apply_agent/consolidator.py` — função `consolidate_pdfs_to_docx()`
- **Código existente:** `src/job_apply_agent/main.py` — função `cmd_consolidate()`
- **Código existente:** `src/job_apply_agent/adapt.py` — comandos de adaptação (serão modificados para ler KB)
- **Código existente:** `src/job_apply_agent/analyzer.py` — análise de match score (será modificado para ler KB)
- **Dados:** `data/curriculos/` — diretório de saída (criado automaticamente)
- **Dados:** `profile.json` — estrutura de dados já gerada pelo consolidate

## 5. Questões em Aberto

- [ ] A knowledge base .md deve ser gerada internamente (Python puro) ou via template Jinja2? (Recomendado: Python puro com f-strings, sem dependência extra)
- [ ] O parsing da KB pelos comandos downstream deve ser por regex, ou devemos usar marcadores YAML-like nas seções?

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 0.1.0 | 2026-06-16 | Nexus Orquestrador | Criação inicial |
| 0.2.0 | 2026-06-16 | Nexus Orquestrador | Redirecionamento para Knowledge Base completa do candidato |
