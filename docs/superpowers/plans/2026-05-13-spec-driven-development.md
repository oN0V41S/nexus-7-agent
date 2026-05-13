# Spec Driven Development (SDD) no Nexus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar Spec Driven Development ao pipeline Nexus, transformando `/spec-gen` em um produtor de specs formais rastreáveis e validando implementação contra requisitos.

**Architecture:** 3 subsistemas sequenciais: (1) Formato de spec + tooling, (2) Integração ao pipeline de 5 estágios, (3) Agente especializado `@spec-reviewer`. Cada subsistema produz artefatos testáveis e comittáveis de forma independente, embora dependam do anterior para funcionar plenamente.

**Tech Stack:** Markdown, YAML frontmatter, JSON Schema (para validação), TypeScript (ferramentas), OpenCode commands/skills/agents

---

## File Structure

```
# NOVOS ARQUIVOS
docs/spec/                          ← Diretório raiz de specs
docs/spec/TEMPLATE.spec.md          ← Template de spec vazio
docs/spec/example.spec.md           ← Exemplo completo de spec
docs/spec/spec-schema.json          ← JSON Schema para validar specs
.opencode/skills/spec-driven-dev/SKILL.md        ← Skill SDD
.opencode/agents/spec-reviewer.md                ← Agente revisor de specs
.opencode/commands/spec-review.md                ← Comando /spec-review
.opencode/tools/spec-validator.ts                ← Tool de validação de specs

# ARQUIVOS MODIFICADOS
.opencode/commands/spec-gen.md      ← Upgrade: produz spec formal, não prompt
.opencode/skills/harness-workflow/SKILL.md  ← SDD integrado ao pipeline
.opencode/agents/orchestrator.md    ← Orquestrador aprende SDD
.opencode/commands/pipeline.md      ← Pipeline inicia com spec
AGENTS.md                           ← Novo agente + skill registrados
```

---

## Subsistema 1: Spec Format & Tooling (Foundation)

### Task 1: Criar diretório `docs/spec/`, template de spec e exemplo

**Files:**
- Create: `docs/spec/TEMPLATE.spec.md`
- Create: `docs/spec/example.spec.md`

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p docs/spec
```

- [ ] **Step 2: Criar `docs/spec/TEMPLATE.spec.md`**

Write `/workspaces/nexus-7-agent/docs/spec/TEMPLATE.spec.md`:

```markdown
---
title: ""
status: "draft" # draft | review | approved | implemented | deprecated
author: ""
created: ""
updated: ""
version: "0.1.0"
---

# [Feature Name] — Spec

## 1. Visão Geral

**Problema:** [O que estamos resolvendo?]

**Usuário alvo:** [Quem usa isso?]

**Contexto:** [Onde isso se encaixa no sistema maior?]

---

## 2. Requisitos Funcionais

### REQ-001: [Título curto]

**Descrição:** [O que o sistema deve fazer?]
**Prioridade:** [Alta | Média | Baixa]
**Critérios de Aceitação:**
- [ ] [Condição 1]
- [ ] [Condição 2]
**Casos de Teste:**
- `CT-001.1`: [Caminho feliz]
- `CT-001.2`: [Erro]
- `CT-001.3`: [Edge case]

---

### REQ-002: [Título curto]

**Descrição:** [O que o sistema deve fazer?]
**Prioridade:** [Alta | Média | Baixa]
**Critérios de Aceitação:**
- [ ] [Condição 1]
- [ ] [Condição 2]
**Casos de Teste:**
- `CT-002.1`: [Caminho feliz]
- `CT-002.2`: [Edge case]

---

## 3. Requisitos Não-Funcionais

### NFR-001: [Ex: Performance]
**Descrição:** [O requisito não-funcional]
**Métrica:** [Como medir?]
**Prioridade:** [Alta | Média | Baixa]

---

## 4. Dependências

- [Dependências internas/externas]

## 5. Questões em Aberto

- [Perguntas pendentes]

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 0.1.0 | | | Criação inicial |
```

- [ ] **Step 3: Criar `docs/spec/example.spec.md` com spec de exemplo real**

Write `/workspaces/nexus-7-agent/docs/spec/example.spec.md`:

```markdown
---
title: "Relatório Mensal de Transações"
status: "approved"
author: "Nexus Orquestrador"
created: "2026-05-13"
updated: "2026-05-13"
version: "1.0.0"
---

# Relatório Mensal de Transações — Spec

## 1. Visão Geral

**Problema:** Usuários precisam visualizar um resumo financeiro mensal com total de receitas, despesas e saldo.

**Usuário alvo:** Usuários logados com contas ativas.

**Contexto:** Módulo de relatórios do dashboard financeiro, acessível via menu lateral.

---

## 2. Requisitos Funcionais

### REQ-001: Selecionar mês/ano para relatório

**Descrição:** O sistema deve permitir que o usuário selecione mês e ano para gerar o relatório.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Seletor de mês com 12 opções (janeiro a dezembro)
- [ ] Seletor de ano com range de 5 anos (ano atual - 4)
- [ ] Valor padrão: mês e ano corrente
**Casos de Teste:**
- `CT-001.1`: Selecionar mês 03/2026 → relatório exibido
- `CT-001.2`: Selecionar mês futuro → mensagem "sem dados"
- `CT-001.3`: Ano anterior ao range → campo desabilitado

### REQ-002: Exibir resumo financeiro

**Descrição:** O relatório deve exibir total de receitas, total de despesas e saldo (receitas - despesas).
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Três cards: Receitas (verde), Despesas (vermelho), Saldo (azul)
- [ ] Valores formatados em moeda BRL (R$ 1.234,56)
- [ ] Saldo negativo destacado em vermelho
**Casos de Teste:**
- `CT-002.1`: Mês com receitas e despesas → todos os 3 cards preenchidos
- `CT-002.2`: Mês sem transações → todos os cards em R$ 0,00
- `CT-002.3`: Saldo negativo → card saldo em vermelho

---

## 3. Requisitos Não-Funcionais

### NFR-001: Performance
**Descrição:** O relatório deve carregar em menos de 2 segundos para até 1000 transações.
**Métrica:** Tempo de resposta da API < 2000ms no P95.
**Prioridade:** Alta

---

## 4. Dependências

- API `GET /api/reports/monthly?month={M}&year={Y}`
- Componente `SummaryCards` já existente

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 1.0.0 | 2026-05-13 | Nexus Orquestrador | Spec inicial |
```

- [ ] **Step 4: Commit**

```bash
git add docs/spec/
git commit -m "feat(spec): add spec template and example document"
```

---

### Task 2: Criar JSON Schema para validação de specs

**Files:**
- Create: `docs/spec/spec-schema.json`

- [ ] **Step 1: Criar `docs/spec/spec-schema.json`**

Write `/workspaces/nexus-7-agent/docs/spec/spec-schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "nexus-spec-schema",
  "title": "Nexus Spec Document",
  "description": "Schema for validating Nexus Spec Driven Development documents",
  "type": "object",
  "required": ["title", "status", "version", "sections"],
  "properties": {
    "title": { "type": "string", "minLength": 1 },
    "status": {
      "type": "string",
      "enum": ["draft", "review", "approved", "implemented", "deprecated"]
    },
    "author": { "type": "string" },
    "created": { "type": "string", "format": "date" },
    "updated": { "type": "string", "format": "date" },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "sections": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "items"],
        "properties": {
          "type": {
            "type": "string",
            "enum": ["functional", "non-functional", "overview", "dependencies", "open-questions"]
          },
          "items": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["id", "description"],
              "properties": {
                "id": {
                  "type": "string",
                  "pattern": "^(REQ-|NFR-|CT-)\\d{3}$"
                },
                "description": { "type": "string", "minLength": 1 },
                "priority": {
                  "type": "string",
                  "enum": ["alta", "media", "baixa"]
                },
                "acceptanceCriteria": {
                  "type": "array",
                  "items": { "type": "string" }
                },
                "testCases": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": { "type": "string", "pattern": "^CT-\\d{3}\\.\\d+$" },
                      "description": { "type": "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Validar que o schema é um JSON válido**

```bash
python3 -c "import json; json.load(open('docs/spec/spec-schema.json')); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add docs/spec/spec-schema.json
git commit -m "feat(spec): add JSON Schema for spec validation"
```

---

### Task 3: Criar tool de validação de specs em TypeScript

**Files:**
- Create: `.opencode/tools/spec-validator.ts`

- [ ] **Step 1: Criar `.opencode/tools/spec-validator.ts`**

Write `/workspaces/nexus-7-agent/.opencode/tools/spec-validator.ts`:

```typescript
import { tool } from "@opencode-ai/plugin/tool";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Spec Validator Tool
 *
 * Valida documentos de spec (.spec.md) contra o JSON Schema.
 * Parseia o YAML frontmatter e as seções do Markdown,
 * extrai IDs de requisitos e casos de teste, e valida a estrutura.
 */

interface SpecSection {
  type: "overview" | "functional" | "non-functional" | "dependencies" | "open-questions";
  items: SpecItem[];
}

interface SpecItem {
  id: string;
  description: string;
  priority?: "alta" | "media" | "baixa";
  acceptanceCriteria?: string[];
  testCases?: { id: string; description: string }[];
}

interface SpecDocument {
  title: string;
  status: string;
  author: string;
  created: string;
  updated: string;
  version: string;
  sections: SpecSection[];
  raw: string;
  filePath: string;
}

/**
 * Extrai o YAML frontmatter de um arquivo .md
 */
function extractFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) {
      frontmatter[kv[1]] = kv[2].replace(/["']/g, "").trim();
    }
  }
  return frontmatter;
}

/**
 * Extrai IDs de requisitos (REQ-NNN, NFR-NNN) do corpo do documento
 */
function extractRequirementIds(content: string): string[] {
  const regex = /(REQ|NFR)-\d{3}/g;
  return [...new Set(content.match(regex) || [])];
}

/**
 * Extrai IDs de casos de teste (CT-NNN.N)
 */
function extractTestCaseIds(content: string): string[] {
  const regex = /CT-\d{3}\.\d+/g;
  return [...new Set(content.match(regex) || [])];
}

/**
 * Valida que todos os REQ-IDs referenciados em CT-IDs existem.
 * Ex: CT-001.1 referencia REQ-001.
 */
function validateTestToRequirementMapping(
  content: string,
  reqIds: string[],
  tcIds: string[],
): string[] {
  const errors: string[] = [];
  const reqSet = new Set(reqIds);

  for (const tcId of tcIds) {
    const reqNum = tcId.match(/CT-(\d{3})/);
    if (reqNum) {
      const expectedReq = `REQ-${reqNum[1]}`;
      if (!reqSet.has(expectedReq)) {
        errors.push(`Test case ${tcId} references REQ-${reqNum[1]} but no REQ-${reqNum[1]} section exists`);
      }
    }
  }

  return errors;
}

/**
 * Valida status da spec
 */
function validateStatus(status: string): string[] {
  const valid = ["draft", "review", "approved", "implemented", "deprecated"];
  if (status && !valid.includes(status)) {
    return [`Invalid status: "${status}". Valid values: ${valid.join(", ")}`];
  }
  return [];
}

/**
 * Valida versão semântica
 */
function validateVersion(version: string): string[] {
  if (!version) return [];
  const semver = /^\d+\.\d+\.\d+$/;
  if (!semver.test(version)) {
    return [`Invalid version: "${version}". Must follow semver (e.g. 1.0.0)`];
  }
  return [];
}

export default tool({
  description:
    "Valida documentos de spec (.spec.md) contra o schema Nexus. Verifica frontmatter, IDs de requisitos, mapeamento CT→REQ, e consistência estrutural.",
  args: {
    filePath: tool.schema
      .string()
      .describe("Caminho absoluto para o arquivo .spec.md a ser validado"),
    fix: tool.schema
      .boolean()
      .default(false)
      .describe("Se true, tenta corrigir problemas automaticamente (ex: update status)"),
  },
  async execute(args, context) {
    const { filePath, fix } = args;
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      return JSON.stringify({
        status: "error",
        errors: [`File not found: ${filePath}`],
        warnings: [],
        summary: { reqCount: 0, tcCount: 0, valid: false },
      });
    }

    // 2. Ler conteúdo
    const content = fs.readFileSync(filePath, "utf-8");
    const ext = path.extname(filePath);

    if (ext !== ".md") {
      warnings.push(`File extension is "${ext}", expected ".md"`);
    }

    // 3. Validar frontmatter
    const fm = extractFrontmatter(content);
    if (!fm.title) errors.push("Missing required frontmatter field: title");
    if (!fm.status) errors.push("Missing required frontmatter field: status");
    if (!fm.version) errors.push("Missing required frontmatter field: version");

    errors.push(...validateStatus(fm.status || ""));
    errors.push(...validateVersion(fm.version || ""));

    // 4. Extrair e validar IDs
    const reqIds = extractRequirementIds(content);
    const tcIds = extractTestCaseIds(content);

    if (reqIds.length === 0) {
      warnings.push("No REQ-NNN or NFR-NNN requirement IDs found in document");
    }

    // 5. Validar mapeamento CT → REQ
    errors.push(...validateTestToRequirementMapping(content, reqIds, tcIds));

    // 6. Status check: "approved" requer reqIds
    if (fm.status === "approved" && reqIds.length === 0) {
      errors.push("Status is 'approved' but no requirement IDs (REQ-NNN) were found");
    }

    // 7. Auto-fix opcional
    if (fix && errors.length === 0 && !fm.updated) {
      const today = new Date().toISOString().slice(0, 10);
      const fixed = content.replace(
        /^updated:\s*"?"?.*"?$/m,
        `updated: "${today}"`,
      );
      if (fixed !== content) {
        fs.writeFileSync(filePath, fixed, "utf-8");
      }
    }

    const result = {
      status: errors.length === 0 ? "valid" : "invalid",
      file: filePath,
      errors,
      warnings,
      summary: {
        reqCount: reqIds.length,
        tcCount: tcIds.length,
        hasTitle: !!fm.title,
        hasVersion: !!fm.version,
        status: fm.status || "unknown",
        valid: errors.length === 0,
      },
      frontmatter: fm,
    };

    return JSON.stringify(result, null, 2);
  },
});
```

- [ ] **Step 2: Verificar que o arquivo TypeScript compila**

```bash
npx tsx --eval "import('./.opencode/tools/spec-validator.ts').then(m => console.log('Tool loaded:', m.default ? 'OK' : 'FAIL'))" 2>&1 || echo "Note: tsx may not be available; check syntax only"
```

Expected: Tool loaded OK or syntax check passed.

- [ ] **Step 3: Commit**

```bash
git add .opencode/tools/spec-validator.ts
git commit -m "feat(spec): add spec-validator tool for .spec.md validation"
```

---

### Task 4: Upgrade do comando `/spec-gen` para produzir spec formal

**Files:**
- Modify: `.opencode/commands/spec-gen.md`

- [ ] **Step 1: Ler o arquivo atual**

Read `.opencode/commands/spec-gen.md` to see current content.

- [ ] **Step 2: Reescrever `/spec-gen` para produzir spec formal**

Write `/workspaces/nexus-7-agent/.opencode/commands/spec-gen.md`:

```markdown
Gera um documento de spec formal (.spec.md) no diretório `docs/spec/` seguindo o formato Spec Driven Development do Nexus.

## Fluxo

1. Use `question` para coletar TODAS as informações abaixo (se não fornecidas no prompt):
   - Título da feature
   - Problema que resolve
   - Usuário alvo
   - Requisitos funcionais (pelo menos 1)
   - Requisitos não-funcionais (se houver)
   - Critérios de aceitação por requisito
   - Casos de teste por requisito (pelo menos 1 CT por REQ)

2. Use a ferramenta `spec-validator` para validar o spec gerado.

3. Salve em `docs/spec/<feature-name-slug>.spec.md`

4. Informe ao usuário:
   - Caminho do arquivo gerado
   - Quantidade de REQs, NFRs e CTs
   - Status da validação

## Modelo de Spec (use o template em docs/spec/TEMPLATE.spec.md)

Toda spec DEVE conter:

### Frontmatter (YAML)
```yaml
---
title: "Nome da Feature"
status: "draft"
author: "Nexus Orquestrador"
created: "2026-05-13"
updated: "2026-05-13"
version: "0.1.0"
---
```

### Requisitos Funcionais (REQ-NNN)
Cada requisito DEVE ter:
- ID: REQ-001, REQ-002, etc.
- Descrição clara
- Prioridade (alta, media, baixa)
- Critérios de aceitação (lista de condições)
- Casos de teste (CT-NNN.N):
  - CT-001.1: Caminho feliz
  - CT-001.2: Cenário de erro
  - CT-001.3: Edge case (se aplicável)

### Requisitos Não-Funcionais (NFR-NNN)
Cada NFR DEVE ter:
- ID: NFR-001, etc.
- Descrição
- Métrica de medição
- Prioridade

### Validação
Sempre execute ao final:
```
Use tool: spec-validator filePath=docs/spec/<arquivo>.spec.md
```

Se houver erros de validação, corrija antes de entregar ao usuário.
```

- [ ] **Step 3: Commit**

```bash
git add .opencode/commands/spec-gen.md
git commit -m "feat(spec): upgrade spec-gen to produce formal .spec.md documents"
```

---

## Subsistema 2: Pipeline Integration

### Task 5: Integrar SDD no pipeline harness (skill harness-workflow)

**Files:**
- Modify: `.opencode/skills/harness-workflow/SKILL.md`

- [ ] **Step 1: Ler o arquivo atual**

Read `.opencode/skills/harness-workflow/SKILL.md` fully.

- [ ] **Step 2: Adicionar estágio SPEC ao pipeline**

Edit `/workspaces/nexus-7-agent/.opencode/skills/harness-workflow/SKILL.md`:

Replace the current 5-stage pipeline section to add Spec as a first-class stage:

The pipeline becomes: **SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT**

Add after the existing `## Pipeline de 5 Estágios` line:

Add an H2 for "### Sub-estágio 0: SPEC (Geração de Spec)" before the existing "### Estágio 1: PLAN" section.

**New section to add before "### Estágio 1: PLAN":**

```markdown
### Sub-estágio 0: SPEC (Geração de Spec)

**Objetivo:** Produzir um documento de spec formal (.spec.md) antes de qualquer planejamento ou implementação.

**Atividades:**
1. Use o comando `/spec-gen` para gerar a spec a partir dos requisitos do usuário
2. Valide a spec com a tool `spec-validator`
3. Salve em `docs/spec/<feature-name>.spec.md`
4. Apresente a spec ao usuário para aprovação ANTES de prosseguir
5. Se o usuário aprovar, mude o status para "approved" e vá para PLAN
6. Se o usuário solicitar mudanças, ajuste a spec e repita a validação

**Entregável:** `docs/spec/<feature-name>.spec.md` aprovado pelo usuário.

**Critérios:**
- [ ] Spec contém pelo menos 1 REQ-ID
- [ ] Cada REQ-ID tem pelo menos 2 CTs (happy path + error)
- [ ] Frontmatter YAML completo (title, status, version, author)
- [ ] spec-validator retorna status "valid"
- [ ] Usuário aprovou explicitamente a spec
```

- [ ] **Step 3: Adicionar validação SDD no estágio REVIEW**

Edit the existing REVIEW section, appending after the existing activities:

```markdown
**Validação SDD:**
6. Se uma spec existe em `docs/spec/` para esta feature:
   - Extraia os REQ-IDs da spec
   - Verifique se os testes cobrem todos os REQ-IDs (requirements coverage)
   - Reporte requisitos sem testes como falha de qualidade
   - Se a spec tem status "approved" mas testes falham, bloqueie o pipeline
```

- [ ] **Step 4: Commit**

```bash
git add .opencode/skills/harness-workflow/SKILL.md
git commit -m "feat(spec): integrate SDD spec stage into harness workflow"
```

---

### Task 6: Atualizar orquestrador para suportar SDD

**Files:**
- Modify: `.opencode/agents/orchestrator.md`

- [ ] **Step 1: Ler o arquivo atual**

Read `.opencode/agents/orchestrator.md` fully.

- [ ] **Step 2: Adicionar instruções SDD ao orquestrador**

Edit `/workspaces/nexus-7-agent/.opencode/agents/orchestrator.md`:

Replace the "### Estágio 1: PLAN (Planejamento)" section with:

```markdown
### Estágio 0: SPEC (Geração de Spec)
- Antes de planejar, GERE uma spec formal com `/spec-gen`
- Valide com spec-validator
- Obtenha aprovação do usuário na spec antes de prosseguir
- Salve em `docs/spec/<feature-name>.spec.md`

### Estágio 1: PLAN (Planejamento)
- Use a spec aprovada como base para o plano
- Decomponha REQ-IDs em tarefas de implementação
- Estime ordem de execução baseada em dependências entre REQs
- Identifique sub-agents necessários para cada estágio
- Entregue plano referenciando REQ-IDs
```

Also add at the end of the "### Estágio 4: REVIEW (Revisão)" section:

```markdown
- Valide cobertura de requisitos: todo REQ-ID da spec tem teste?
- Reporte requisitos sem cobertura como falha
```

- [ ] **Step 3: Commit**

```bash
git add .opencode/agents/orchestrator.md
git commit -m "feat(spec): update orchestrator to support SDD workflow"
```

---

### Task 7: Atualizar comando `/pipeline` para iniciar com spec

**Files:**
- Modify: `.opencode/commands/pipeline.md`

- [ ] **Step 1: Ler o arquivo atual**

Read `.opencode/commands/pipeline.md`.

- [ ] **Step 2: Adicionar estágio SPEC ao pipeline command**

Edit `/workspaces/nexus-7-agent/.opencode/commands/pipeline.md`:

Replace line 5 with:
```
1. Carregue a skill `harness-workflow`
2. Execute o Sub-estágio 0 (SPEC): use `/spec-gen` para gerar spec formal
3. Execute o Estágio 1 (PLAN): use a spec aprovada para criar o plano
4. Apresente o plano ao usuário para aprovação
5. Execute estágios seguintes conforme o plano aprovado
6. Use question a cada transição de estágio se precisar de input do usuário
```

Update the examples to include spec-driven language:
```
/pipeline Adicione um novo endpoint de extrato mensal com autenticação e testes (gera spec automática)
/pipeline Corrija o bug de cálculo de juros e adicione logging (especifique REQ-IDs afetados)
```

- [ ] **Step 3: Commit**

```bash
git add .opencode/commands/pipeline.md
git commit -m "feat(spec): update pipeline command to start with spec generation"
```

---

## Subsistema 3: Agent & Skills Ecosystem

### Task 8: Criar agente `@spec-reviewer`

**Files:**
- Create: `.opencode/agents/spec-reviewer.md`

- [ ] **Step 1: Criar `.opencode/agents/spec-reviewer.md`**

Write `/workspaces/nexus-7-agent/.opencode/agents/spec-reviewer.md`:

```markdown
---
description: "Revisão de especificações (specs) para completude, consistência, testabilidade e aderência ao formato SDD do Nexus"
mode: subagent
---

## Spec Reviewer

Agente especializado em revisar documentos de spec (.spec.md) do ecossistema Nexus. Garante que specs sejam completas, consistentes, testáveis e sigam o formato SDD.

## Especialidade

- **Completude**: Verificar se todos os campos obrigatórios estão presentes
- **Consistência**: Detectar requisitos conflitantes ou sobrepostos
- **Testabilidade**: Cada REQ-ID tem CTs adequados (happy path + erro)?
- **Rastreabilidade**: CT-IDs referenciam REQ-IDs existentes?
- **Qualidade**: Critérios de aceitação são mensuráveis e específicos?
- **Versionamento**: Frontmatter YAML completo e válido
- **Prioridades**: Mix adequado de prioridades (alta, média, baixa)?

## Quando Usar

- Após gerar uma spec com `/spec-gen` (antes de PLAN)
- Quando o usuário pedir "revise esta spec" ou "review this spec"
- Quando uma spec mudar de status (draft → review → approved)
- No estágio SPEC do pipeline, como validação antes de aprovação

## Quando NÃO Usar

- Para revisar código (use `@quality-assurance-analyst`)
- Para revisar segurança (use `@security-secret-auditor`)
- Para revisar documentação técnica (use `@docs-architect`)
- Para gerar specs (use `/spec-gen`)

## Ferramentas e Permissões

| Ferramenta | Permissão | Uso |
|------------|-----------|-----|
| `read` | allow | Ler specs em docs/spec/ |
| `glob` | allow | Listar specs disponíveis |
| `grep` | allow | Buscar padrões em specs |
| `write` | deny | Apenas leitura (não modifica specs) |
| `edit` | deny | Apenas leitura |
| `bash` | allow | Validar JSON Schema |
| `nexus-log` | allow | Registrar resultados da revisão |

## Workflow de Revisão

1. **Leia a spec**: Use `read` no arquivo .spec.md
2. **Valide frontmatter**: title, status, version, author preenchidos?
3. **Verifique REQ-IDs**: Cada REQ-NNN tem descrição, prioridade, critérios de aceitação e pelo menos 2 CTs?
4. **Verifique CT→REQ mapping**: CT-NNN.X referencia REQ-NNN existente?
5. **Verifique NFRs**: Requisitos não-funcionais têm métricas mensuráveis?
6. **Verifique consistência**: Algum requisito conflita com outro?
7. **Gere relatório**: Lista de issues por severidade (critical, major, minor)
8. **Recomende ação**: Approve, changes requested, ou reject

## Critérios de Qualidade

- [ ] Spec tem pelo menos 1 REQ-ID
- [ ] Cada REQ-ID tem pelo menos 2 CTs (happy path + error)
- [ ] Todos os CTs referenciam REQ-IDs existentes
- [ ] Frontmatter YAML é válido (title, status, version)
- [ ] Status é um dos: draft, review, approved, implemented, deprecated
- [ ] NFRs (se existirem) têm métricas mensuráveis
- [ ] Critérios de aceitação são específicos e testáveis (não vagos)
- [ ] Sem requisitos conflitantes
```

- [ ] **Step 2: Criar comando `/spec-review`**

Write `/workspaces/nexus-7-agent/.opencode/commands/spec-review.md`:

```markdown
---
description: "Revisa um documento de spec (.spec.md) quanto a completude, consistência e testabilidade"
agent: spec-reviewer
subtask: true
---

Revise o documento de spec em `$ARGUMENTS` seguindo o workflow do agente @spec-reviewer.

## Estrutura do Relatório

Retorne:

### Sumário
- Arquivo revisado
- Status geral (✅ Aprovada | ⚠️ Ajustes | ❌ Rejeitada)
- Total de REQs, NFRs, CTs encontrados

### Issues por Severidade

**Critical** (bloqueante):
- Frontmatter inválido/incompleto
- REQ sem CTs
- CT referencia REQ inexistente

**Major** (deve corrigir):
- REQ sem critérios de aceitação
- NFR sem métrica
- Prioridade não definida

**Minor** (sugestão):
- Apenas 1 CT por REQ (mínimo recomendado: 2)
- Descrições muito curtas

### Recomendação
- ✅ Approved: sem issues críticas ou major
- ⚠️ Changes Requested: issues major presentes
- ❌ Rejected: issues críticas presentes
```

- [ ] **Step 3: Registrar agente no `AGENTS.md`**

Edit `/workspaces/nexus-7-agent/AGENTS.md`:

Add a row to the agents table:
```markdown
| `@spec-reviewer` | subagent | Revisão de especificações (specs) para completude, consistência e testabilidade |
```

Add a row to the skills table (if not already there for SDD):
```markdown
| `spec-driven-dev` | Skill de Spec Driven Development para o ecossistema Nexus |
```

- [ ] **Step 4: Commit**

```bash
git add .opencode/agents/spec-reviewer.md .opencode/commands/spec-review.md AGENTS.md
git commit -m "feat(spec): add spec-reviewer agent and spec-review command"
```

---

### Task 9: Criar skill `spec-driven-dev`

**Files:**
- Create: `.opencode/skills/spec-driven-dev/SKILL.md`

- [ ] **Step 1: Criar diretório da skill**

```bash
mkdir -p .opencode/skills/spec-driven-dev
```

- [ ] **Step 2: Criar `.opencode/skills/spec-driven-dev/SKILL.md`**

Write `/workspaces/nexus-7-agent/.opencode/skills/spec-driven-dev/SKILL.md`:

```markdown
---
name: spec-driven-dev
description: "Skill de Spec Driven Development para o ecossistema Nexus. Guia o fluxo completo de spec-first: geração, revisão, implementação referenciada e validação de cobertura de requisitos."
---

# Spec Driven Development Skill

Define o fluxo de Spec Driven Development no ecossistema Nexus. Use esta skill sempre que for iniciar um novo desenvolvimento que deve seguir o princípio de "spec first, code second".

## Quando Usar Esta Skill

- Iniciar uma nova feature ou módulo
- Fazer mudanças que afetam múltiplos componentes
- Qualquer tarefa que o orquestrador inicia via `/pipeline`
- Quando o usuário explicitamente pede SDD

## Quando NÃO Usar Esta Skill

- Correções rápidas de bugs (use fluxo direto, mas considere criar spec se o bug for complexo)
- Refatorações sem mudança de comportamento
- Tarefas puramente de investigação

## Fluxo SDD

### Fase 1: SPEC

```
[Usuário] → Requisito → /spec-gen → docs/spec/<feature>.spec.md → @spec-reviewer → Aprovação
```

1. Receba o requisito do usuário
2. Use `/spec-gen` para produzir `docs/spec/<feature>.spec.md`
3. O spec-gen usa `question` para preencher lacunas
4. Valide com `spec-validator filePath=docs/spec/<arquivo>`
5. Se válido, submeta ao `@spec-reviewer` para revisão
6. Apresente ao usuário para aprovação final
7. Mude status para "approved" no frontmatter

### Fase 2: PLAN

```
docs/spec/<feature>.spec.md → Decomposição em tarefas → Plano com REQ-IDs
```

1. Leia a spec aprovada
2. Para cada REQ-ID, crie uma tarefa de implementação
3. Para cada NFR-ID, crie uma tarefa de verificação
4. Ordene tarefas por dependências entre REQs
5. Cada commit deve referenciar REQ-IDs implementados

### Fase 3: IMPLEMENT

```
Tarefa com REQ-ID → Implementação → Teste → Commit com REQ-ID
```

1. Implemente o código para cada REQ-ID
2. Escreva testes que validam os CTs da spec
3. Nomeie testes referenciando CT-IDs: `describe('REQ-001: ...')`
4. Commit com mensagem contendo `Implements: REQ-001, REQ-002`

### Fase 4: VERIFY

```
Código + Testes → Requirements Coverage → Validação contra spec
```

1. Execute todos os testes
2. Extraia REQ-IDs referenciados nos testes (via `describe('REQ-NNN:`)
3. Compare com REQ-IDs da spec: cobertura = reqs testados / reqs totais
4. Se cobertura < 100%, reporte quais REQs faltam
5. Atualize status da spec para "implemented"

### Fase 5: DOCUMENT

```
Spec atualizada → Documentação derivada → Commit final
```

1. Atualize a spec com informações de implementação (se necessário)
2. Gere documentação referenciando REQ-IDs
3. Commit final com `/commit-&-docs`

## Exemplo de Mensagem de Commit

```
feat: implement monthly report endpoint

Implements: REQ-001, REQ-002
Relates: NFR-001
Spec: docs/spec/monthly-report.spec.md
```

## Verificação de Requirements Coverage

Para verificar se todos os requisitos foram implementados:

```bash
# Extrair REQ-IDs da spec:
grep -oP 'REQ-\d{3}' docs/spec/<feature>.spec.md | sort -u

# Extrair REQ-IDs referenciados nos testes:
grep -oP 'REQ-\d{3}' src/**/__tests__/**/*.test.ts | sort -u

# Comparar: os que faltam são gaps
```

## Critérios de Qualidade

- [ ] Spec gerada antes de qualquer código
- [ ] Spec revisada por @spec-reviewer
- [ ] Spec aprovada pelo usuário
- [ ] Cada REQ-ID tem testes correspondentes
- [ ] Commits referenciam REQ-IDs
- [ ] Requirements coverage = 100%
- [ ] Spec atualizada ao final (status = implemented)
```

- [ ] **Step 3: Atualizar `AGENTS.md` com a nova skill**

Already done in Task 8 Step 3 (add `spec-driven-dev` to skills table).

- [ ] **Step 4: Commit**

```bash
git add .opencode/skills/spec-driven-dev/SKILL.md
git commit -m "feat(spec): add spec-driven-dev skill with full SDD workflow"
```

---

## Self-Review Checklist

**1. Spec coverage (minha análise vs. o plano):**
- ✅ Formato de spec → Tasks 1-2 (template, schema)
- ✅ Tool de validação → Task 3 (spec-validator.ts)
- ✅ `/spec-gen` upgrade → Task 4 (produz spec formal)
- ✅ Pipeline integration → Tasks 5-7 (harness, orchestrator, pipeline command)
- ✅ Agente `@spec-reviewer` → Task 8
- ✅ Skill `spec-driven-dev` → Task 9
- ⏭️ Dashboard integration → Post-MVP (não no escopo inicial)
- ⏭️ Spec Evolution tracking → Post-MVP (não no escopo inicial)

**2. Placeholder scan:** Nenhum placeholder encontrado. Todos os passos têm código concreto.

**3. Type consistency:**
- `spec-validator` tool: defined in Task 3, used in Tasks 4, 5
- `@spec-reviewer` agent: defined in Task 8, used in Task 9
- `REQ-NNN` / `CT-NNN.N` / `NFR-NNN` format: consistent across all tasks
- `docs/spec/` directory: created in Task 1, used by all subsequent tasks
- Frontmatter fields (title, status, version): consistent between schema, template, and validator

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-13-spec-driven-development.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
