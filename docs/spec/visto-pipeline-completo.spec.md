---
title: "Pipeline Completa de Clonagem Visto DAM"
status: "approved"
author: "Nexus 7 Agent"
created: "2026-05-29"
updated: "2026-05-29"
version: "0.1.0"
---

# Pipeline Completa de Clonagem Visto DAM — Spec

## 1. Visão Geral

**Problema:** O fluxo atual de clonagem de licenças (`/visto clone`) copia apenas as licenças de uso entre imagens. Os METADADOS da aba de detalhes e o comentário referenciando a imagem original não são transferidos, exigindo preenchimento manual repetitivo.

**Usuário alvo:** Equipe de operações Visto DAM que realiza clone completo de imagens (metadados + licenças + comentário).

**Contexto:** Extensão do pipeline de clonagem de licenças existente (`visto-clonagem-licenca.mjs`). O novo pipeline adiciona extração/preenchimento de metadados e comentário, mantendo os scripts de licenças como reuso.

---

## 2. Requisitos Funcionais

### REQ-001: Extrair METADADOS da imagem original

**Descrição:** Navegar até a imagem original, acessar a aba METADADOS, extrair todos os campos (exceto "Ciclo Original") e retornar em formato JSON estruturado.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Navega até a imagem original e clica na aba METADADOS
- [ ] Extrai os 15 campos obrigatórios (lista abaixo)
- [ ] Ignora o campo "Ciclo Original"
- [ ] Detecta se "Pessoa Retratada Casting" está preenchido → retorna flag `requiresCastingManualStep: true`
- [ ] Rejeita extração se imagem não encontrada no DAM
- [ ] Rejeita extração se todos os metadados estiverem vazios
- [ ] Salva JSON em `data/licencas/metadados-{imagem}-{timestamp}.json`

**Campos a extrair:**
1. "O que é" — texto
2. "Submarcas" — texto
3. "País Produzido" — texto
4. "País Veículado" — texto
5. "Veículos" — texto
6. "Código de Venda" — numérico
7. "Descrição do Produto" — texto
8. "Categoria" — select
9. "Pessoa Retratada Casting" — texto (⚠️ se preenchido → passo manual)
10. "Direito de Território de Casting" — texto
11. "Prazo Publicitário de Casting" — data
12. "Direitos de Uso do Produto/Paisagem/Textura da foto - Meio" — texto
13. "Direitos de Uso do Produto/Paisagem/Textura da foto - Território" — texto
14. "Prazo Publicitário Produto/Paisagem/Textura da Foto - Território" — texto
15. "Prazo publicitário Produto/Paisagem/Textura (caso seja Buy Out, insira esta informação)" — texto

**Casos de Teste:**
- `CT-001.1`: Imagem com todos os campos preenchidos → JSON completo com 15 campos
- `CT-001.2`: Imagem não encontrada → erro com mensagem descritiva
- `CT-001.3`: Metadados todos vazios → erro "metadados insuficientes"
- `CT-001.4`: Campo "Pessoa Retratada Casting" preenchido → flag `requiresCastingManualStep: true`

---

### REQ-002: Preencher METADADOS na imagem nova

**Descrição:** Navegar até a imagem nova, entrar em modo edição da aba METADADOS, preencher todos os 15 campos copiados da original (incluindo "Ciclo Original" fornecido pelo usuário) e confirmar.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Navega até a imagem nova e abre aba METADADOS
- [ ] Entra em modo edição (modal ou inline)
- [ ] Preenche todos os 15 campos com dados do JSON + Ciclo Original
- [ ] Valida preenchimento pós-confirmação (re-extrai e compara)
- [ ] Trata react-select, date inputs e textareas conforme padrão visto-automation
- [ ] Gera screenshot pós-preenchimento

**Casos de Teste:**
- `CT-002.1`: Preenchimento completo → todos os campos conferem
- `CT-002.2`: Modo edição não encontrado → erro com screenshot
- `CT-002.3`: Campo react-select falha → retry com padrão keyboard.type

---

### REQ-003: Extrair licenças da imagem original

**Descrição:** Reutilizar o script `extrair-licencas.mjs` existente para extrair licenças da imagem original.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Chama `extrair-licencas.mjs` existente via child_process
- [ ] Retorna caminho do JSON gerado
- [ ] Loga warning se nenhuma licença encontrada

**Casos de Teste:**
- `CT-003.1`: Imagem com licenças → JSON gerado com sucesso
- `CT-003.2`: Imagem sem licenças → warning + JSON com totalLicencas: 0

---

### REQ-004: Clonar licenças na imagem nova

**Descrição:** Reutilizar o script `adicionar-licencas.mjs` existente para adicionar licenças na imagem nova.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Chama `adicionar-licencas.mjs` existente via child_process
- [ ] Adiciona cada licença via modal "Nova Licença de Uso"
- [ ] Confirma e valida persistência

**Casos de Teste:**
- `CT-004.1`: Licenças adicionadas → confirmação visual
- `CT-004.2`: Falha na adição → erro com screenshot

---

### REQ-005: Adicionar comentário na aba Comentários

**Descrição:** Navegar até a imagem nova, acessar a aba Comentários, inserir texto referenciando a imagem original e salvar.
**Prioridade:** Média
**Critérios de Aceitação:**
- [ ] Navega até a imagem nova e clica na aba Comentários
- [ ] Insere texto no formato: "IMAGEM ORIGINAL: {filename}"
- [ ] Confirma que comentário foi salvo e aparece na lista

**Casos de Teste:**
- `CT-005.1`: Comentário inserido → aparece na lista de comentários
- `CT-005.2`: Aba Comentários não encontrada → erro com screenshot

---

### REQ-006: Coleta manual do Ciclo Original

**Descrição:** O usuário deve fornecer o valor de "Ciclo Original" antes do preenchimento. Se não fornecido, o pipeline pergunta interativamente.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Se "Ciclo Original" não passado como argumento → pergunta ao usuário
- [ ] Preenche "Ciclo Original" no METADADOS da nova imagem
- [ ] Pipeline não inicia sem valor de Ciclo Original

**Casos de Teste:**
- `CT-006.1`: Ciclo Original fornecido via argumento → usa o valor
- `CT-006.2`: Ciclo Original não fornecido → pergunta ao usuário
- `CT-006.3`: Usuário cancela → pipeline aborta graciosamente

---

### REQ-007: Validação visual em texto

**Descrição:** Ao final da pipeline, exibir sumário tabular dos metadados copiados, licenças clonadas e confirmação do comentário.
**Prioridade:** Média
**Critérios de Aceitação:**
- [ ] Exibe sumário dos 15 metadados copiados (campo: valor)
- [ ] Exibe sumário das licenças clonadas (padrão existente)
- [ ] Exibe confirmação do comentário adicionado
- [ ] Formatação legível no terminal

**Casos de Teste:**
- `CT-007.1`: Pipeline completa → sumário exibido com todos os dados
- `CT-007.2`: Pipeline com erros parciais → sumário mostra status de cada etapa

---

### REQ-008: Tratamento de erro: imagem/metadados insuficientes

**Descrição:** Abortar pipeline com mensagem clara quando imagem original não é encontrada ou metadados extraídos estão vazios.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Aborta com mensagem "Imagem original não encontrada" se busca falha
- [ ] Aborta com mensagem "Metadados insuficientes" se JSON vazio
- [ ] Gera relatório de falha mesmo em caso de aborto
- [ ] Screenshots de erro salvos

**Casos de Teste:**
- `CT-008.1`: Imagem inexistente → aborta com mensagem clara
- `CT-008.2`: Metadados vazios → aborta com mensagem clara

---

### REQ-009: Flag "Pessoa Retratada" → passo manual

**Descrição:** Se "Pessoa Retratada Casting" estiver preenchido na imagem original, pausar o pipeline e solicitar ação manual do usuário para preencher Casting na Lista.
**Prioridade:** Média
**Critérios de Aceitação:**
- [ ] Detecta campo preenchido → exibe instrução "Preencher Casting na Lista"
- [ ] PAUSA pipeline (não continua automaticamente)
- [ ] Só continua após confirmação manual do usuário

**Casos de Teste:**
- `CT-009.1`: Campo preenchido → pipeline pausa com mensagem
- `CT-009.2`: Campo vazio → pipeline continua normalmente

---

### REQ-010: Orquestrador unificado

**Descrição:** Script orquestrador que executa a sequência completa: sessão → extrair metadados → preencher metadados → extrair licenças → adicionar licenças → comentário → validação.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Executa sequência completa na ordem correta
- [ ] Reutiliza scripts existentes (extrair-licencas, adicionar-licencas) via child_process
- [ ] Cria scripts novos para metadados e comentário
- [ ] Logs Nexus em cada etapa
- [ ] Gera relatório JSON final
- [ ] Sumário textual de validação

**Casos de Teste:**
- `CT-010.1`: Pipeline completa sem erros → status CONCLUÍDO
- `CT-010.2`: Falha em etapa intermediária → status FALHA + relatório parcial
- `CT-010.3`: Sessão expirada → tenta re-login antes de abortar

---

## 3. Requisitos Não-Funcionais

### NFR-001: Reuso de scripts existentes
**Descrição:** Scripts de licenças (`extrair-licencas.mjs`, `adicionar-licencas.mjs`) devem ser reutilizados via child_process, não duplicados.
**Métrica:** Zero duplicação de lógica de licenças
**Prioridade:** Alta

### NFR-002: Compatibilidade com padrão visto-automation
**Descrição:** Todos os novos scripts devem seguir os padrões documentados na skill visto-automation (session management, react-select, modais, error handling).
**Métrica:** Scripts passam em revisão de padrão
**Prioridade:** Alta

### NFR-003: Observabilidade
**Descrição:** Cada etapa deve gerar logs estruturados via nexusLog e screenshots em caso de erro.
**Métrica:** Logs presentes em `.opencode/logs/visto-pipeline-{date}.log`
**Prioridade:** Média

---

## 4. Dependências

- `visto-login.mjs` — Gerenciamento de sessão (existente)
- `extrair-licencas.mjs` — Extração de licenças (existente)
- `adicionar-licencas.mjs` — Adição de licenças (existente)
- `visto-clonagem-licenca.mjs` — Padrão de orquestração (referência)
- Playwright MCP — Automação de browser
- Sessão Visto DAM válida — Pré-requisito de execução

---

## 5. Questões em Aberto

- [ ] Qual é o seletor CSS exato da aba METADADOS? (Requer análise DOM no Estágio 2)
- [ ] A aba METADADOS tem modo edição inline ou modal? (Requer análise DOM)
- [ ] Qual é o seletor da aba Comentários? (Requer análise DOM)
- [ ] O campo "Ciclo Original" é editável na aba METADADOS? (Requer validação)

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 0.1.0 | 2026-05-29 | Nexus 7 Agent | Criação inicial |
