---
name: auto-discovery
description: Escaneia o repositório, detecta tecnologias sem agente especializado e gera automaticamente agentes e skills usando o Agent Creator.
---

# Auto-Discovery Skill

Sistema de descoberta contínua que analisa o código fonte, identifica lacunas no ecossistema de agentes e gera automaticamente novos agentes e skills — inspirado no padrão de escalabilidade do ECC (everything-claude-code).

## Quando Usar Esta Skill

- Após adicionar novas dependências ou tecnologias ao projeto
- Para auditar se o ecossistema de agentes cobre as tecnologias do projeto
- Quando o repositório muda significativamente de escopo
- Como parte de CI/CD para manter o catálogo atualizado

## Quando NÃO Usar Esta Skill

- O ecossistema já está completo para as tecnologias atuais
- Apenas correções pontuais em agentes existentes

## Workflow de Descoberta

### Fase 1: Escaneamento

Use `glob` e `grep` para detectar tecnologias no repositório:

```bash
# Detectar linguagens
find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.py" \
       -o -name "*.go" -o -name "*.rs" -o -name "*.java" -o -name "*.rb" | head

# Detectar frameworks/dependências
cat package.json 2>/dev/null | grep -E '"next|"react|"vue|"express|"fastify|"prisma'

# Detectar Docker
find . -name "Dockerfile" -o -name "docker-compose*" 2>/dev/null

# Detectar CI/CD
find . -name ".github/workflows/*.yml" -o -name "Jenkinsfile" 2>/dev/null
```

### Fase 2: Gap Analysis

Compare tecnologias detectadas com agentes existentes em `AGENTS.md`:

```javascript
// Tecnologias detectadas vs agentes existentes
const techStack = ["TypeScript", "React", "Next.js", "Prisma", "Docker"];
const existingAgents = ["security-secret-auditor", "quality-assurance-analyst", ...];

const gaps = techStack.filter(t => !hasAgentFor(t, existingAgents));
// → ["Docker"] — precisa de agente Docker
```

Para cada gap, avalie:
- A tecnologia é central para o projeto? → Criar agente
- A tecnologia é periférica? → Skill apenas
- Já existe skill cobrindo isso? → Não duplicar

### Fase 3: Geração (via Agent Creator)

Para cada gap identificado, use o workflow do Agent Creator:

1. **Agent** em `.opencode/agents/<technology>-reviewer.md` ou `<technology>-specialist.md`
2. **Skill** em `.opencode/skills/<technology>-patterns/SKILL.md` com:
   - Padrões de código específicos
   - Boas práticas e anti-patterns
   - Comandos de verificação
3. **Registro** em `AGENTS.md` e `opencode.json`

### Fase 4: Continuous Learning (via nexus-memory)

Conecte com o sistema de memória para aprendizado contínuo:

1. **Extrair padrões**: Periodicamente, busque observações de ferramentas em `nexus-memory`:
   ```
   nexus-memory({ action: "search", query: "refactor", scope: "observations", limit: 50 })
   ```

2. **Clusterizar**: Agrupe padrões similares (ex: todas as refatorações de Prisma, todos os fixes de React)

3. **Gerar skill**: Para clusters com 3+ ocorrências, sugere criar uma skill:
   - Nome: `<pattern>-patterns`
   - Conteúdo: extraído dos valores das observações

4. **Auto-registro**: Se o usuário confirmar, usa `agent-creator` para criar a skill

## Schema Estendido (Proposto para Futuro)

Frontmatter de agente com metadados:

```yaml
---
name: docker-security-reviewer
version: 1.0.0
description: Revisão de segurança para Dockerfiles e docker-compose
mode: subagent
tags: [docker, security, containers, devops]
category: infrastructure
dependencies:
  skills: [security-patterns]
  agents: []
inputs:
  scope:
    type: string
    description: "Caminho do Dockerfile"
outputs:
  report:
    type: markdown
    path: ".reviews/docker-{timestamp}.md"
triggers:
  - on-commit:
      patterns: ["**/Dockerfile", "**/docker-compose*"]
  - manual
allowed-tools:
  read: allow
  glob: allow
  grep: allow
  bash: ask
  edit: deny
---
```

## Gatilhos

| Gatilho | Quando executar |
|---|---|
| `on-commit` | Após commits que adicionam novas dependências |
| `on-schedule` | Semanalmente para continuous learning |
| `manual` | Quando o usuário invoca `/audit-agents` |
| `on-technology-detected` | Quando nova tecnologia é detectada no repositório |

## Exemplo Concreto

Dado o repositório atual do Nexus (`/workspaces/nexus-7-agent`):

```bash
# Escaneamento detecta:
Tecnologias: TypeScript, JSON, Markdown, YAML, Python, Docker
Frameworks: N/A (projeto de configuração)
Ferramentas: MCP (Notion, Playwright), OpenCode plugins, SQLite (nova)

# Agentes existentes:
@security-secret-auditor      → cobre segurança
@quality-assurance-analyst    → cobre QA
@docs-architect               → cobre docs
@testsprite-mcp-agent         → cobre testes MCP

# Gaps detectados:
❌ Docker → Criar @docker-reviewer (Dockerfiles, docker-compose, containers)
❌ Notion → Criar @notion-helper (schemas, queries, templates)  
❌ Playwright → Criar @playwright-tester (E2E tests, screenshots)
❌ Python → Criar @python-lint-reviewer (PEP8, type hints)
```

## Critérios de Qualidade

- [ ] Escaneamento cobre linguagens, frameworks, ferramentas e infraestrutura
- [ ] Gap analysis não gera falsos positivos (tecnologia já coberta)
- [ ] Agente gerado tem permissões compatíveis com seu propósito
- [ ] Skill gerada tem exemplos práticos do código do projeto
- [ ] Continuous learning não duplica skills existentes
- [ ] Catálogo (`AGENTS.md` + `opencode.json`) sempre consistente
