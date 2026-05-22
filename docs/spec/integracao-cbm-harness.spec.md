---
title: "Integração do CBM Agent no Pipeline Harness Completo"
status: "draft"
author: "Orquestrador Nexus"
created: "2026-05-21"
updated: "2026-05-21"
version: "0.2.0"
status: "implemented"
---

# Integração do CBM Agent no Pipeline Harness Completo — Spec

## 1. Visão Geral

**Problema:** O agente CBM (codebase-memory-mcp) está parcialmente integrado ao pipeline — a skill `harness-workflow` e o `super-pipeline` já o referenciam no ANALYZE, mas o `orchestrator.md` (agente primário) está desatualizado e não menciona CBM em nenhum estágio. Além disso, o CBM não é usado nos estágios SPEC, BUILD, REVIEW e DOCUMENT, onde suas ferramentas (get_architecture, get_code_snippet, detect_changes, manage_adr) trariam benefício significativo.

**Usuário alvo:** Desenvolvedores usando o pipeline Harness Nexus para desenvolvimento.

**Contexto:** O CBM agent expõe 14 ferramentas de análise estrutural via knowledge graph. Atualmente ele só é chamado no ANALYZE (via super-pipeline e harness-workflow skill), mas o orchestrator.md — que é a definição canônica do pipeline — sequer o menciona. Isso cria uma lacuna entre o que o pipeline documenta e o que realmente executa.

---

## 2. Requisitos Funcionais

### REQ-001: Atualizar orchestrator.md para incluir CBM no ANALYZE

**Descrição:** Adicionar referência explícita ao `@cbm-agent` no estágio ANALYZE do `orchestrator.md`, alinhando-o com a skill `harness-workflow` e o `super-pipeline`.

**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] orchestrator.md menciona `@cbm-agent` no estágio ANALYZE
- [ ] orchestrator.md especifica quais ferramentas CBM usar (search_graph, trace_call_path, get_architecture)
- [ ] A ordem de execução é documentada: CBM antes de security-secret-auditor e project-review
- [ ] Caso o repositório não esteja indexado, o pipeline deve indexá-lo automaticamente

**Casos de Teste:**
- `CT-001.1`: Verificar que orchestrator.md contém "cbm-agent" no estágio ANALYZE
- `CT-001.2`: Verificar que orchestrator.md e harness-workflow SKILL.md usam a mesma sequência de agentes no ANALYZE e ambas referenciam search_graph, trace_call_path e get_architecture

---

### REQ-002: Adicionar CBM ao estágio SPEC

**Descrição:** Usar `get_architecture` do CBM durante a geração da spec para entender a estrutura real do projeto antes de escrever requisitos. Isso produz specs mais precisas baseadas na arquitetura existente.

**Prioridade:** Média
**Critérios de Aceitação:**
- [ ] O pipeline, ao gerar spec, consulta `get_architecture` do CBM
- [ ] O resultado da arquitetura é incluído na seção de Contexto da spec
- [ ] Se o CBM não estiver disponível, o pipeline continua sem falha (fallback)

**Casos de Teste:**
- `CT-002.1`: Executar spec-gen com CBM disponível e verificar que a seção de Contexto da spec inclui ao menos o nome dos módulos retornados por `get_architecture`
- `CT-002.2`: Executar spec-gen com CBM indisponível e verificar que o comando não exibe mensagens de erro do CBM ao usuário, retorna exit code 0, e produz uma spec sem seção de contexto enriquecido

---

### REQ-003: Adicionar CBM ao estágio PLAN

**Descrição:** Usar `search_graph` e `trace_call_path` do CBM durante o planejamento para mapear arquivos e dependências afetadas antes de criar o plano de implementação.

**Prioridade:** Média
**Critérios de Aceitação:**
- [ ] O pipeline consulta CBM durante o PLAN para identificar arquivos relevantes
- [ ] O plano referencia arquivos descobertos pelo CBM
- [ ] `trace_call_path` é usado para análise de impacto de dependências

**Casos de Teste:**
- `CT-003.1`: Verificar que o PLAN gerado contém uma seção de "Arquivos Afetados" listando arquivos retornados por `search_graph`
- `CT-003.2`: Verificar que o plano inclui dependências mapeadas por `trace_call_path` entre os arquivos afetados

---

### REQ-004: Adicionar CBM ao estágio BUILD

**Descrição:** Disponibilizar `get_code_snippet` do CBM durante a implementação para buscar código de referência no repositório indexado. Isso acelera a implementação ao permitir lookup rápido de funções existentes.

**Prioridade:** Baixa
**Critérios de Aceitação:**
- [ ] O pipeline documenta que `get_code_snippet` pode ser usado durante BUILD
- [ ] Implementadores podem consultar código existente via CBM sem grep manual

**Casos de Teste:**
- `CT-004.1`: Verificar documentação do BUILD mencionando CBM como ferramenta de consulta
- `CT-004.2`: Executar BUILD com CBM offline e verificar que ferramentas tradicionais (grep/glob) são usadas como fallback sem interromper a implementação

---

### REQ-005: Adicionar CBM ao estágio REVIEW

**Descrição:** Usar `detect_changes` do CBM no REVIEW para validar que o diff da implementação cobre exatamente o escopo planejado (blast radius validation).

**Prioridade:** Baixa
**Critérios de Aceitação:**
- [ ] O REVIEW inclui passo opcional de `detect_changes` via CBM
- [ ] Mudanças fora do escopo planejado são reportadas como alertas

**Casos de Teste:**
- `CT-005.1`: Executar detect_changes após implementação e verificar que diff cobre o escopo planejado
- `CT-005.2`: Executar REVIEW em repositório sem git history e verificar alerta informativo sem interromper o pipeline

---

### REQ-006: Adicionar CBM ao estágio DOCUMENT

**Descrição:** Usar `manage_adr` do CBM para criar Architecture Decision Records automaticamente durante a documentação, capturando decisões arquiteturais tomadas no pipeline.

**Prioridade:** Baixa
**Critérios de Aceitação:**
- [ ] O pipeline pode criar ADRs via CBM ao final da documentação
- [ ] ADRs são armazenados no knowledge graph do CBM

**Casos de Teste:**
- `CT-006.1`: Verificar que ADR pode ser criado via CBM durante DOCUMENT e fica armazenado no knowledge graph
- `CT-006.2`: Executar DOCUMENT com CBM indisponível e verificar que nenhum ADR é criado (sem falha)

---

### REQ-007: Indexação automática do repositório

**Descrição:** Antes de qualquer pipeline, verificar se o repositório atual está indexado no CBM. Se não estiver, indexar automaticamente com `index_repository` em modo `fast`.

**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] O pipeline verifica `index_status` do CBM antes de começar
- [ ] Se não indexado, executa `index_repository` em modo `fast`
- [ ] Indexação é síncrona com timeout de 30s (se exceder, pipeline continua com fallback)

**Casos de Teste:**
- `CT-007.1`: Iniciar pipeline sem índice e verificar indexação automática síncrona (modo fast)
- `CT-007.2`: Iniciar pipeline com índice existente e pular indexação
- `CT-007.3`: Simular timeout de indexação (>30s) e verificar que pipeline continua com fallback grep/glob

---

## 3. Requisitos Não-Funcionais

### NFR-001: Fallback resiliente

**Descrição:** Se o CBM não estiver disponível (servidor MCP offline, knowledge graph corrompido), o pipeline deve continuar sem falha.
**Métrica:** Pipeline não falha quando CBM está indisponível — usa grep/glob como fallback.
**Prioridade:** Alta
**Casos de Teste:**
- `CT-NFR-001.1`: Simular CBM offline (parar servidor MCP) e executar pipeline completo — deve terminar com exit code 0

---

### NFR-002: Performance

**Descrição:** A indexação `fast` do CBM não deve adicionar mais que 30 segundos ao tempo total do pipeline. O timeout é síncrono: se exceder 30s, o pipeline continua com fallback.
**Métrica:** Tempo de indexação fast < 30s para repositórios de até 50k arquivos. Se >30s, pipeline prossegue sem índice.
**Prioridade:** Média
**Casos de Teste:**
- `CT-NFR-002.1`: Indexar repositório de teste com ~10k arquivos e medir tempo < 30s

---

### NFR-003: Consistência

**Descrição:** A documentação do pipeline (orchestrator.md, harness-workflow SKILL.md, super-pipeline.md) deve estar consistente entre si.
**Métrica:** grep por "cbm-agent" deve retornar em todos os 3 arquivos.
**Prioridade:** Alta
**Casos de Teste:**
- `CT-NFR-003.1`: Executar grep "cbm-agent" nos 3 arquivos e verificar que todos contêm pelo menos 1 match

---

## 4. Dependências

- `@cbm-agent` — agente especializado (já existe e está funcional)
- `codebase-memory-mcp` — servidor MCP (já instalado e configurado)
- `orchestrator.md` — atualizar referências
- `harness-workflow/SKILL.md` — pode precisar ajustes de consistência
- `super-pipeline.md` — pode precisar ajustes de consistência

## 5. Questões em Aberto

- `detect_changes` e `manage_adr` dependem de git history — isso está disponível em todos os cenários?
- O orchestrator.md deve delegar ao CBM diretamente ou via task para o @cbm-agent?
- Indexação `fast` é suficiente ou precisa ser `full` para análise de impacto confiável?

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 0.1.0 | 2026-05-21 | Orquestrador Nexus | Criação inicial |
| 0.2.0 | 2026-05-21 | Orquestrador Nexus | Adicionados CTs faltantes (REQ-004/005/006), CTs para NFRs, especificados critérios vagos, sync REQ-007/NFR-002 |
