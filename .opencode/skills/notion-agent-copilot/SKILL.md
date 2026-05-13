---
name: notion-agent-copilot
description: "Use quando precisar acessar, ler ou interagir com a página 'Agent Copilot' no Notion via MCP. Aciona com: 'acesse o Agent Copilot', 'veja o Notion', 'abra o Agent Copilot', 'o que tem no Agent Copilot', 'notion page agent copilot'."
---

# Notion Agent Copilot Skill

Skill especializada em acessar e manipular páginas no **Notion** via MCP.
Fornece workflow completo com **22 ferramentas MCP** e convenções de blocos:
**toggles** para seções colapsáveis, **headings** para hierarquia, **rich text** formatado, **to-dos**, **divisores**, **bullets**, **callouts**, **data sources** (bancos de dados) e muito mais.

## Quando Usar

- Acessar/ler a página "Agent Copilot" no Notion
- Criar, editar ou organizar conteúdo no Notion
- Buscar páginas, databases ou blocos
- Qualquer menção a "Notion" + "Agent Copilot"

## Quando NÃO Usar

- Notion MCP não configurado em `opencode.json`
- `NOTION_TOKEN` não definido no ambiente
- Tarefa apenas sobre o repositório local (sem Notion)

---

## 📚 Referência Rápida — Blocos Suportados

### Blocos de Estrutura (Container)

| Bloco | Uso | Exemplo |
|-------|-----|---------|
| `toggle` | Seções colapsáveis para reduzir poluição visual | `{"type":"toggle","toggle":{"rich_text":[{"type":"text","text":{"content":"📋 Título"}}],"color":"default"}}` |
| `heading_2` | Seção principal (H2) | `{"type":"heading_2","heading_2":{"rich_text":[{"type":"text","text":{"content":"Título"}}]}}` |
| `heading_3` | Subseção (H3) | `{"type":"heading_3","heading_3":{"rich_text":[{"type":"text","text":{"content":"Subtítulo"}}]}}` |
| `divider` | Separador visual | `{"type":"divider","divider":{}}` |
| `callout` | Destaque em caixa colorida | *(ver seção avançada)* |
| `quote` | Citação/bloco de destaque | *(ver seção avançada)* |

### Blocos de Conteúdo

| Bloco | Uso | Exemplo |
|-------|-----|---------|
| `paragraph` | Texto normal | `{"type":"paragraph","paragraph":{"rich_text":[{"type":"text","text":{"content":"texto"}}]}}` |
| `bulleted_list_item` | Lista com bullet | `{"type":"bulleted_list_item","bulleted_list_item":{"rich_text":[...]}}` |
| `numbered_list_item` | Lista numerada | `{"type":"numbered_list_item","numbered_list_item":{"rich_text":[...]}}` |
| `to_do` | Checkbox (tarefa) | `{"type":"to_do","to_do":{"rich_text":[...],"checked":false}}` |
| `code` | Bloco de código | *(ver seção avançada)* |
| `table_of_contents` | Índice automático | *(ver seção avançada)* |

### Formatação de Texto (Rich Text)

Cada `rich_text` item pode incluir:

```json
{
  "type": "text",
  "text": { "content": "texto aqui" },
  "annotations": {
    "bold": false,
    "italic": false,
    "strikethrough": false,
    "underline": false,
    "code": false,
    "color": "default"
  }
}
```

> ⚠️ **Limitação:** O schema do MCP server (v2.0.0+) não inclui `annotations` no `richTextRequest`. Teste antes de usar. Para links, use `{"text":{"content":"texto","link":{"url":"https://..."}}}`.

---

## 🏗️ Convenções de Construção de Páginas

### Estrutura Recomendada

```
H2: 🚀 Título Principal
  P: Descrição geral (parágrafo)
  P: Detalhes adicionais
  TOGGLE: 📋 Seção Colapsável 1
    H3: Subseção
    • Bullet item 1
    • Bullet item 2
  DIVIDER ─────
  TOGGLE: 📚 Seção Colapsável 2
    ☐ To-do 1
    ☐ To-do 2
  TOGGLE: ⚙️ Configurações
    H3: Subseção
    • Item
```

### Regras de Ouro

1. **TOGGLES primeiro** — Qualquer seção com 3+ linhas DEVE ser um toggle. Isso reduz drasticamente a poluição visual da página.
2. **Headings com emoji** — Use emojis nos headings para identificação rápida: `📋`, `⚙️`, `🔧`, `🤖`, `📚`, `🏗️`, `🛠️`, `📦`, `☁️`, `🔗`, `🔐`, `📁`, `✅`
3. **Hierarquia** — H2 → toggle → H3 → bullets/todos. Máximo 3 níveis de profundidade.
4. **Divisores** — Use `divider` entre seções principais para separação visual.
5. **To-dos para status** — Use `to_do` com `checked: true/false` para itens de acompanhamento.
6. **Texto rico** — Sempre que possível, use `bold` em labels/etiquetas: `"Nome: "` (bold) + `"valor"` (normal).

---

## 🛠️ MCP Tools — Catálogo Completo (22)

### Busca e Navegação

| Tool | Como usar | Resposta |
|------|-----------|----------|
| `notion_API-post-search` | `{"query":"Agent Copilot","filter":{"value":"page","property":"object"}}` | Lista de páginas/databases |
| `notion_API-retrieve-a-page` | `page_id="<id>"` | Metadados + propriedades |
| `notion_API-retrieve-a-block` | `block_id="<id>"` | Conteúdo de um bloco |
| `notion_API-get-block-children` | `block_id="<id>"` + `page_size=100` + `start_cursor` (opcional) | Blocos filhos com paginação |
| `notion_API-retrieve-a-page-property` | `page_id="<id>"` + `property_id="<id>"` | Valor de uma propriedade |

### Escrita e Edição

| Tool | Como usar | Resposta |
|------|-----------|----------|
| `notion_API-patch-block-children` | `block_id="<página>"` + `children=[...blocos...]` + opcional `after="<id_bloco>"` | Blocos criados |
| `notion_API-update-a-block` | `block_id="<id>"` + `type={...}` + `archived` (opcional) | Bloco atualizado |
| `notion_API-delete-a-block` | `block_id="<id>"` | Bloco movido para lixeira |
| `notion_API-patch-page` | `page_id="<id>"` + `properties={...}` + `icon` + `cover` | Página atualizada |
| `notion_API-post-page` | `parent={...}` + `properties={...}` + `children=[...]` | Nova página criada |
| `notion_API-move-page` | `page_id="<id>"` + `parent={...}` | Página movida |

### Comentários

| Tool | Como usar | Resposta |
|------|-----------|----------|
| `notion_API-create-a-comment` | `parent={"page_id":"<id>"}` + `rich_text=[...]` | Comentário criado |
| `notion_API-retrieve-a-comment` | `block_id="<id>"` + opcional `page_size` + `start_cursor` | Lista de comentários |

### Data Sources (Bancos de Dados)

| Tool | Como usar | Resposta |
|------|-----------|----------|
| `notion_API-create-a-data-source` | `parent={"page_id":"<id>"}` + `title=[...]` + `properties={...}` | Novo database criado |
| `notion_API-retrieve-a-data-source` | `data_source_id="<id>"` | Schema e propriedades |
| `notion_API-update-a-data-source` | `data_source_id="<id>"` + `title`/`description`/`properties` | Data source atualizado |
| `notion_API-query-data-source` | `data_source_id="<id>"` + `filter`/`sorts`/`page_size` | Registros do database |
| `notion_API-retrieve-a-database` | `database_id="<id>"` | Metadados + data source IDs |
| `notion_API-list-data-source-templates` | `data_source_id="<id>"` | Templates disponíveis |

### Utilitários

| Tool | Como usar | Resposta |
|------|-----------|----------|
| `notion_API-get-self` | (sem parâmetros) | Dados do bot conectado |
| `notion_API-get-user` | `user_id="<id>"` | Dados do usuário |
| `notion_API-get-users` | `start_cursor` (opcional) | Lista de usuários |

---

## 📋 Workflow Completo de Interação

### Fase 1: Setup e Verificação

```json
// Verificar conexão
notion_API-get-self()
// → workspace_name, bot name, id
```

Se `401`: NOTION_TOKEN inválido ou não configurado.
Abortar e avisar o usuário.

### Fase 2: Encontrar a Página

```json
notion_API-post-search({
  "query": "Agent Copilot",
  "filter": { "value": "page", "property": "object" }
})
// Capturar: results[0].id → page_id
```

**Fallback:** Se não achar, tentar `"query": "Agent"`.

### Fase 3: Ler Conteúdo

```json
// Metadados
notion_API-retrieve-a-page(page_id="<id>")

// Blocos (com paginação se necessário)
notion_API-get-block-children(block_id="<id>", page_size=100)
// Se has_more: true, chamar de novo com start_cursor="<next_cursor>"
```

### Fase 4: Escrever na Página

**Adicionar ao final da página:**
```json
notion_API-patch-block-children({
  "block_id": "<page_id>",
  "children": [
    {"type": "heading_2", "heading_2": {"rich_text": [{"text": {"content": "📋 Nova Seção"}}]}},
    {"type": "toggle", "toggle": {"rich_text": [{"text": {"content": "Detalhes"}}]}}
  ]
})
```

**Adicionar após um bloco específico:**
```json
notion_API-patch-block-children({
  "block_id": "<page_id>",
  "children": [{"type": "divider", "divider": {}}],
  "after": "<id_do_bloco_anterior>"
})
```

### Fase 5: Adicionar Filhos a um Toggle

Toggles são **container blocks**. Para colocar conteúdo DENTRO de um toggle:

```json
// 1. Criar o toggle (vazio)
notion_API-patch-block-children({
  "block_id": "<page_id>",
  "children": [{"type": "toggle", "toggle": {"rich_text": [{"text": {"content": "📋 Título"}}]}}]
})
// → toggle_id = result.id

// 2. Adicionar conteúdo DENTRO do toggle
notion_API-patch-block-children({
  "block_id": "<toggle_id>",
  "children": [
    {"type": "heading_3", "heading_3": {"rich_text": [{"text": {"content": "Subseção"}}]}},
    {"type": "bulleted_list_item", "bulleted_list_item": {"rich_text": [{"text": {"content": "Item"}}]}},
    {"type": "to_do", "to_do": {"rich_text": [{"text": {"content": "Tarefa"}}], "checked": false}}
  ]
})
```

### Fase 6: Atualizar/Remover Blocos

**Atualizar texto de um bloco:**
```json
notion_API-update-a-block({
  "block_id": "<id>",
  "type": {"paragraph": {"rich_text": [{"text": {"content": "Novo texto"}}]}}
})
```

**Mover para lixeira (arquivar):**
```json
notion_API-delete-a-block({ "block_id": "<id>" })
```

### Fase 7: Gerenciar Data Sources (Databases)

**Criar um database:**
```json
notion_API-create-a-data-source({
  "parent": {"page_id": "<parent_page_id>"},
  "title": [{"type": "text", "text": {"content": "Meu Database"}}],
  "properties": {
    "Nome": {"title": {}},
    "Status": {"select": {"options": [
      {"name": "Ativo", "color": "green"},
      {"name": "Inativo", "color": "red"}
    ]}},
    "Descrição": {"rich_text": {}}
  }
})
```

> ⚠️ **Atenção:** O endpoint `create-a-data-source` pode não funcionar na API version 2025-09-03+. Erro: `"Creating new databases with data sources is not supported in this endpoint"`. Como alternativa, crie uma página filha com estrutura tabelada usando toggles + bullets.

**Consultar um database:**
```json
notion_API-query-data-source({
  "data_source_id": "<id>",
  "filter": {"property": "Status", "select": {"equals": "Ativo"}},
  "sorts": [{"property": "Nome", "direction": "ascending"}]
})
```

---

## 🧠 Padrões e Antipadrões

### ✅ Padrões Recomendados

**Página limpa com toggles:**
```
H2: Título
P: descrição curta
TOGGLE: 📋 Seção 1 (colapsado)
  H3: Sub
    bullets
TOGGLE: 📋 Seção 2 (colapsado)
  H3: Sub
    to-dos
```

**Chamada estruturada com metadados:**
```json
[
  {"type": "paragraph", "paragraph": {"rich_text": [
    {"text": {"content": "Nome: "}},
    {"text": {"content": "Valor"}}
  ]}},
  {"type": "paragraph", "paragraph": {"rich_text": [
    {"text": {"content": "Repo: "}},
    {"text": {"content": "https://...", "link": {"url": "https://..."}}}
  ]}}
]
```

**Ordem de operações para reconstruir página:**
1. `delete-a-block` em lotes de 10 (remover blocos antigos)
2. `patch-block-children` na página (adicionar toggles + estrutura)
3. `patch-block-children` em cada toggle_id (adicionar conteúdo interno)
4. Opcional: `create-a-data-source` (se suportado)

### ❌ Antipadrões

- ❌ Criar 30 blocos soltos sem toggles → página poluída
- ❌ Usar apenas paragraphs para tudo → sem hierarquia visual
- ❌ Ignorar `after` e colocar blocos na ordem errada
- ❌ Tentar criar databases sem verificar se o endpoint funciona
- ❌ Não tratar `has_more: true` na paginação → dados truncados
- ❌ Passar `annotations` sem testar antes → erro 400 no schema

---

## 🚨 Tratamento de Erros

| Erro | Causa | Solução |
|------|-------|---------|
| `401 unauthorized` | Token inválido | Verificar `NOTION_TOKEN` |
| `404 not_found` | Página/bloco não existe | Verificar ID e permissões |
| `403 forbidden` | Sem acesso | Compartilhar página com a integração |
| `409 conflict` | Conflito de edição | Re-ler e tentar novamente |
| `429 too_many_requests` | Rate limit (~3 req/s) | Aguardar 1-2s e retentar |
| `400 validation_error` | Schema inválido | Verificar formato do bloco |
| `body.type should be not present` | `type` aninhado errado | Usar `type` como key direta, não objeto |

---

## 💾 Cache com Nexus Memory

```json
// Salvar page_id para reuso
nexus-memory({ action: "save", key: "notion-agent-copilot-page-id", value: "<page_id>" })

// Recuperar
nexus-memory({ action: "load", key: "notion-agent-copilot-page-id" })
```

---

## 🔗 Integração com o Harness Nexus

| Estágio | Uso do Notion |
|---------|---------------|
| **PLAN** | Buscar specs e requisitos no Agent Copilot |
| **ANALYZE** | Consultar documentação e decisões |
| **BUILD** | Atualizar status de tarefas no Notion |
| **REVIEW** | Adicionar comentários de review |
| **DOCUMENT** | Criar/atualizar páginas de documentação |

Use com `skill("notion-agent-copilot")` antes de chamar os tools MCP.
