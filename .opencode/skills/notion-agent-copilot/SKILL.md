---
name: notion-agent-copilot
description: "Use quando precisar acessar, ler ou interagir com a página 'Agent Copilot' no Notion via MCP. Aciona com: 'acesse o Agent Copilot', 'veja o Notion', 'abra o Agent Copilot', 'o que tem no Agent Copilot', 'notion page agent copilot'."
---

# Notion Agent Copilot Skill

Skill especializada em acessar e manipular páginas no **Notion** via MCP.
Fornece workflow completo com **22 ferramentas MCP** e convenções de blocos:
**toggles** para seções colapsáveis, **headings** para hierarquia, **rich text** formatado, **to-dos**, **divisores**, **bullets**, **callouts**, **data sources** (bancos de dados) e muito mais.

## ⚠️ Nomes das Ferramentas MCP

O MCP server `@notionhq/notion-mcp-server` expõe as ferramentas com o prefixo `API-*` (ex: `API-get-self`, `API-post-search`). No OpenCode, dependendo da configuração, elas podem aparecer com um prefixo adicional como `notion_API-*`.

**IMPORTANTE:** Antes de chamar qualquer ferramenta, sempre verifique sua tool list disponível para confirmar o nome exato. Use o nome que aparecer na sua tool list.

Esta skill documenta as ferramentas com seus nomes **raw do MCP server** (`API-*`). Substitua pelo prefixo que seu ambiente usar (ex: `notion_API-get-self` se for `notion_API-*`).

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

> ⚠️ **Limitação:** O schema do MCP server não inclui `annotations` no `richTextRequest`. Teste antes de usar. Para links, use `{"text":{"content":"texto","link":{"url":"https://..."}}}`.

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

1. **TODO título vira toggle** — ###, ## e # DEVEM ser transformados em toggles. Cada heading_2 vira TOGGLE; cada heading_3 vira um toggle aninhado dentro do toggle pai. Isso reduz poluição visual a zero.
2. **Headings com emoji** — Use emojis nos toggles para identificação rápida: `📋`, `⚙️`, `🔧`, `🤖`, `📚`, `🏗️`, `🛠️`, `📦`, `☁️`, `🔗`, `🔐`, `📁`, `✅`
3. **Delete antes de update — REGRA ABSOLUTA** — SEMPRE:
   1. Leia o conteúdo atual da página (`get-block-children`)
   2. Delete TODOS os blocos existentes (lotes de até 100 com `delete-a-block`)
   3. Reconstrua a página do zero com o conteúdo preservado + novo conteúdo
   4. NUNCA apenas adicione ao final — isso quebra a consistência da página
4. **Hierarquia** — toggle → toggle aninhado → bullets/todos. Máximo 3 níveis de profundidade.
5. **Divisores** — Use `divider` entre seções apenas se necessário.
6. **To-dos para status** — Use `to_do` com `checked: true/false` para itens de acompanhamento.
7. **Texto rico** — Sempre que possível, use `bold` em labels/etiquetas: `"Nome: "` (bold) + `"valor"` (normal).

---

## 🛠️ MCP Tools — Catálogo Completo (22)

> **Nota sobre nomenclatura:** Os nomes abaixo são os nomes RAW do MCP server. No seu ambiente OpenCode, eles podem aparecer prefixados (ex: `notion_API-get-self`). **Sempre verifique sua tool list disponível antes de chamar.**

### Busca e Navegação (5 tools)

| Tool | Parâmetros Obrigatórios | Parâmetros Opcionais | O que retorna |
|------|------------------------|---------------------|---------------|
| `API-post-search` | *(nenhum)* | `query` (string), `filter` (object: value=page\|data_source, property=object), `sort` (object: direction, timestamp), `start_cursor` (string), `page_size` (int, max 100) | Lista de páginas/databases que correspondem à busca |
| `API-retrieve-a-page` | `page_id` (string UUID) | `filter_properties` (string: IDs de propriedades) | Metadados + propriedades da página |
| `API-retrieve-a-block` | `block_id` (string) | — | Conteúdo de um bloco específico |
| `API-get-block-children` | `block_id` (string) | `start_cursor` (string), `page_size` (int, max 100) | Blocos filhos com paginação (`has_more`, `next_cursor`) |
| `API-retrieve-a-page-property` | `page_id` (string UUID), `property_id` (string) | `page_size` (int), `start_cursor` (string) | Valor de uma propriedade específica |

### Escrita e Edição (6 tools)

| Tool | Parâmetros Obrigatórios | Parâmetros Opcionais | O que retorna |
|------|------------------------|---------------------|---------------|
| `API-patch-block-children` | `block_id` (string: page_id ou block_id), `children` (array de block objects) | `after` (string: ID do bloco após o qual inserir) | Blocos criados com seus IDs |
| `API-update-a-block` | `block_id` (string) | `type` (object: o tipo do bloco com conteúdo atualizado), `archived` (boolean) | Bloco atualizado |
| `API-delete-a-block` | `block_id` (string) | — | Bloco movido para lixeira |
| `API-patch-page` | `page_id` (string UUID) | `properties` (object), `icon` (emoji ou external), `cover` (external), `archived` (boolean), `in_trash` (boolean) | Página atualizada |
| `API-post-page` | `parent` (object: page_id, database_id, ou workspace), `properties` (object) | `children` (array de blocks), `icon` (string JSON), `cover` (string JSON) | Nova página criada |
| `API-move-page` | `page_id` (string UUID), `parent` (object: page_id, database_id, ou workspace) | — | Página movida |

### Comentários (2 tools)

| Tool | Parâmetros Obrigatórios | Parâmetros Opcionais | O que retorna |
|------|------------------------|---------------------|---------------|
| `API-create-a-comment` | `parent` (object: page_id), `rich_text` (array de rich text) | — | Comentário criado |
| `API-retrieve-a-comment` | `block_id` (string: block_id ou page_id) | `start_cursor` (string), `page_size` (int, max 100) | Lista de comentários |

### Data Sources / Databases (6 tools)

| Tool | Parâmetros Obrigatórios | Parâmetros Opcionais | O que retorna |
|------|------------------------|---------------------|---------------|
| `API-create-a-data-source` | `parent` (object: page_id), `properties` (object) | `title` (array rich text) | Novo database criado |
| `API-retrieve-a-data-source` | `data_source_id` (string) | — | Schema e propriedades do data source |
| `API-update-a-data-source` | `data_source_id` (string) | `title` (array), `description` (array), `properties` (object) | Data source atualizado |
| `API-query-data-source` | `data_source_id` (string) | `filter_properties` (array de strings), `filter` (object), `sorts` (array de sort objects), `start_cursor` (string), `page_size` (int), `archived` (boolean), `in_trash` (boolean) | Registros do database |
| `API-retrieve-a-database` | `database_id` (string) | — | Metadados do database + data source IDs |
| `API-list-data-source-templates` | `data_source_id` (string) | `start_cursor` (string), `page_size` (int, max 100) | Templates disponíveis |

### Utilitários (3 tools)

| Tool | Parâmetros Obrigatórios | Parâmetros Opcionais | O que retorna |
|------|------------------------|---------------------|---------------|
| `API-get-self` | *(nenhum)* | — | Dados do bot conectado (workspace_name, bot name, id) |
| `API-get-user` | `user_id` (string UUID) | — | Dados do usuário específico |
| `API-get-users` | *(nenhum)* | `start_cursor` (string), `page_size` (int, max 100) | Lista de usuários do workspace |

> **Nota:** A maioria das ferramentas também aceita um parâmetro opcional `Notion-Version` (string) para especificar a versão da API Notion (ex: `"2025-09-03"`). O padrão é a versão mais recente.

---

## 📋 Workflow Completo de Interação

### Fase 0: Resumo das Alterações e Aprovação Humana (OBRIGATÓRIO)

**ANTES de fazer qualquer modificação na página, você DEVE:**

1. **Ler o estado atual** — Chame `get-block-children` na página para ver os blocos existentes
2. **Gerar um resumo claro** do que pretende fazer, incluindo:
   - Quantos blocos existem atualmente
   - Quais toggles/containers serão afetados
   - O que será adicionado, modificado ou removido
   - Qual estratégia será usada (APPEND ou REBUILD)
   - Se for REBUILD: confirmar que backup completo foi salvo
3. **Apresentar o resumo ao usuário** e AGUARDAR aprovação explícita

```
EXEMPLO DE RESUMO:

📋 Estado atual da página:
   • 11 blocos top-level (4 paragraphs, 5 toggles, 2 dividers)
   • Toggles: "📋 TO-DO", "📚 System Documentation", "⚙️ Actually Setup", "🐾 OpenPets", "☁️ Google Workspace"
   • Toggles "📋 TO-DO", "📚 System Documentation", "⚙️ Actually Setup" atualmente VAZIOS (sem conteúdo interno)

🔄 Alterações planejadas:
   • Estratégia: APPEND (adicionar ao final, sem deletar nada)
   • Adicionar conteúdo dentro do toggle "🐾 OpenPets": 1 paragraph + 6 bullets
   • Adicionar conteúdo dentro do toggle "☁️ Google Workspace": 1 paragraph + 11 bullets
   • ❌ NENHUM bloco existente será deletado ou modificado

✅ Aprovação necessária antes de prosseguir.
```

```
REGRAS:
- NUNCA modifique uma página sem apresentar o resumo primeiro
- NUNCA prossiga sem aprovação explícita do usuário ("sim", "pode", "ok", "approved")
- Se o usuário rejeitar ou pedir alterações, ajuste o plano e apresente novamente
- O resumo DEVE incluir a estratégia (APPEND vs REBUILD) e justificativa
```

### Fase 1: Setup e Verificação

```
API-get-self()
// → workspace_name, bot name, id
```

Se `401`: `NOTION_TOKEN` inválido ou não configurado.
Abortar e avisar o usuário.

### Fase 2: Encontrar a Página

```
API-post-search({
  "query": "Agent Copilot",
  "filter": { "value": "page", "property": "object" }
})
// Capturar: results[0].id → page_id
```

**Fallback:** Se não achar, tentar `"query": "Agent"`.

### Fase 3: Ler Conteúdo Atual (OBRIGATÓRIO antes de qualquer modificação) — LEITURA RECURSIVA!

> ⚠️ **CRÍTICO:** `get-block-children` retorna APENAS os filhos DIRETOS de um bloco. Blocos container (toggle, column_list, coluna, etc.) podem TER CONTEÚDO ANINHADO que não é visível em uma chamada rasa.
> 
> **NUNCA confie em `has_children: false` isoladamente.** A API pode retornar `has_children: false` se não houver children NO MOMENTO, mas você pode estar vendo a página após alguma alteração que já removeu children. A única forma segura de preservar conteúdo é:
> 1. Ler a página toda recursivamente (depth-first)
> 2. PRESERVAR o conteúdo lido como backup
> 3. SÓ ENTÃO decidir se faz rebuild ou append

```
// FUNÇÃO RECURSIVA: retorna TODOS os blocos + conteúdo aninhado
function readAllBlocksRecursive(blockId) {
  let allBlocks = []
  let cursor = null
  do {
    const result = API-get-block-children({
      block_id: blockId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {})
    })
    allBlocks.push(...result.results)
    cursor = result.has_more ? result.next_cursor : null
  } while (cursor)

  // Para CADA bloco filho, se for container, lê recursivamente
  for (const block of allBlocks) {
    if (isContainerBlock(block)) {
      block.children = readAllBlocksRecursive(block.id)
    }
  }
  return allBlocks
}

// Container blocks no Notion: toggle, column_list, column, table_of_contents, etc.
function isContainerBlock(block) {
  return ['toggle', 'column_list', 'column', 'table_of_contents'].includes(block.type)
      || block.has_children === true
}

// USO: ler a página recursivamente
const pageBlocks = readAllBlocksRecursive("<page_id>")
// → Array de blocos com .children populado recursivamente

// SALVAR como backup antes de qualquer modificação
const pageBackup = JSON.stringify(pageBlocks)
// Use nexus-memory para persistir:
// nexus-memory({ action: "save", key: "page-backup-agent-copilot", value: pageBackup })
```

### Fase 4: Decidir Estratégia — Append vs Rebuild

**REGRRA DE OURO:** Prefira APPEND (adicionar ao final) SEMPRE que possível. Só use REBUILD (deletar + recriar) quando tiver backup COMPLETO do conteúdo.

#### Opção A: Append (PADRÃO RECOMENDADO)
Use esta opção quando quiser ADICIONAR conteúdo sem modificar o existente.
Não deleta nada. Apenas adiciona ao final da página.

```
// Adicionar novo conteúdo ao final da página
API-patch-block-children({
  "block_id": "<page_id>",
  "children": [ /* novos blocos */ ]
})
```

Vantagens: seguro, preserva TODO o conteúdo existente, não precisa de backup.
Desvantagens: não permite reordenar ou modificar blocos existentes.

#### Opção B: Rebuild (APENAS com backup completo verificado)
Use APENAS quando TODAS as condições forem verdadeiras:
- [ ] Backup completo salvo (recursivo, depth 3+)
- [ ] Backup verificado (contém conteúdo aninhado dentro de toggles)
- [ ] Você TEM o conteúdo original preservado para recriar

```
// ⚠️ SÓ EXECUTE SE TIVER BACKUP VERIFICADO

// 1. Deletar blocos (lotes de até 100)
for (block of allTopLevelBlocks) {
  API-delete-a-block({ block_id: block.id })
}

// 2. Verificar página vazia
API-get-block-children({ block_id: "<page_id>", page_size: 10 })

// 3. Reconstruir com conteúdo do backup + conteúdo novo
API-patch-block-children({
  "block_id": "<page_id>",
  "children": [ /* backup content + new content */ ]
})
```

#### 🔴 REGRA ABSOLUTA: NUNCA delete blocos sem ter lido recursivamente e salvo backup.

### Fase 5: Reconstruir a Página

Construa a lista completa de blocos (conteúdo preservado + conteúdo novo) e adicione de uma vez:

```
API-patch-block-children({
  "block_id": "<page_id>",
  "children": [
    // --- CONTEÚDO PRESERVADO (reconstruído dos blocos lidos) ---
    {"type": "heading_2", "heading_2": {"rich_text": [{"text": {"content": "Título Original"}}]}},
    {"type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Conteúdo original..."}}]}},
    
    // --- DIVISOR entre seções ---
    {"type": "divider", "divider": {}},
    
    // --- NOVO CONTEÚDO ---
    {"type": "toggle", "toggle": {"rich_text": [{"text": {"content": "📋 Nova Seção"}}]}},
  ]
})
```

### Fase 6: Adicionar Filhos a um Toggle

Toggles são **container blocks**. Para colocar conteúdo DENTRO de um toggle:

```
// 1. Primeiro crie todos os toggles (vazios) na página
const result = API-patch-block-children({
  "block_id": "<page_id>",
  "children": [
    {"type": "toggle", "toggle": {"rich_text": [{"text": {"content": "📋 Seção 1"}}]}},
    {"type": "toggle", "toggle": {"rich_text": [{"text": {"content": "📋 Seção 2"}}]}}
  ]
})
// toggle1_id = result.results[0].id
// toggle2_id = result.results[1].id

// 2. Depois adicione conteúdo DENTRO de cada toggle
API-patch-block-children({
  "block_id": "<toggle1_id>",
  "children": [
    {"type": "bulleted_list_item", "bulleted_list_item": {"rich_text": [{"text": {"content": "Item 1"}}]}},
    {"type": "bulleted_list_item", "bulleted_list_item": {"rich_text": [{"text": {"content": "Item 2"}}]}}
  ]
})
```

### Fase 7: Atualizar/Remover Blocos Específicos

**Atualizar texto de um bloco:**
```
API-update-a-block({
  "block_id": "<id>",
  "type": {"paragraph": {"rich_text": [{"text": {"content": "Novo texto"}}]}}
})
```

**Mover bloco para lixeira:**
```
API-update-a-block({
  "block_id": "<id>",
  "archived": true
})
// Equivalente a API-delete-a-block
```

### Fase 8: Gerenciar Data Sources (Databases)

**Criar um database:**
```
API-create-a-data-source({
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
```
API-query-data-source({
  "data_source_id": "<id>",
  "filter": {"property": "Status", "select": {"equals": "Ativo"}},
  "sorts": [{"property": "Nome", "direction": "ascending"}]
})
```

---

## 🧠 Padrões e Antipadrões

### ✅ Padrões Recomendados

**Ordem de operações para ATUALIZAR página:**

**Estratégia PADRÃO (segura): APPEND**
1. `get-block-children` — LER conteúdo atual (com paginação)
2. `get-block-children` recursivo em CADA toggle/container — LER conteúdo aninhado
3. `nexus-memory({ action: "save", key: "page-backup", value: JSON.stringify(blocks) })` — BACKUP
4. `patch-block-children` na página — ADICIONAR novos blocos ao final (NÃO deletar)
5. `patch-block-children` em cada novo toggle_id — PREENCHER conteúdo interno

**Estratégia ALTERNATIVA (risco): REBUILD — só use com backup verificado**
1. `get-block-children` recursivo — LER TUDO (depth-first, todos os níveis)
2. Salvar backup COMPLETO com `nexus-memory`
3. VERIFICAR que o backup inclui conteúdo aninhado (ex: toggles com bullets dentro)
4. `delete-a-block` — DELETAR blocos top-level (um por um ou paralelo)
5. `patch-block-children` na página — RECONSTRUIR do zero com conteúdo do backup + novo
6. `patch-block-children` em cada toggle — PREENCHER conteúdo interno

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

### ❌ Antipadrões — REGRAS ABSOLUTAS

- ❌ **🔥 NUNCA** deletar blocos sem ter lido recursivamente TODO o conteúdo aninhado (dentro de toggles, colunas, etc.) → **perda de dados permanente**
- ❌ **🔥 NUNCA** confiar em `has_children: false` como única verificação → a API pode retornar `false` se children já foram deletados ou não foram indexados
- ❌ **🔥 NUNCA** fazer rebuild completo sem salvar backup em `nexus-memory` primeiro
- ❌ **🔥 NUNCA** assumir que `get-block-children` retorna tudo em depth 1 → toggles container precisam de leitura recursiva
- ❌ **🔥 PADRÃO SEGURO é APPEND** — rebuild só quando estritamente necessário
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

---

## ✅ Checklist Antes de Modificar uma Página

### Para APPEND (estratégia padrão)
- [ ] Executei `API-get-self()` para verificar conexão?
- [ ] Encontrei a página com `API-post-search()`?
- [ ] Li o conteúdo atual com `API-get-block-children()` (com paginação)?
- [ ] Vou usar APPEND (adicionar ao final) — NÃO vou deletar nada?
- [ ] Adicionei conteúdo dentro dos toggles novos (não só toggles vazios)?

### Para REBUILD (⚠️ risco — só se estritamente necessário)
- [ ] Li recursivamente TODOS os blocos (depth-first, todos os níveis)?
- [ ] Salvei backup COMPLETO em `nexus-memory` ou variável?
- [ ] VERIFIQUEI que o backup contém conteúdo aninhado (dentro de toggles)?
- [ ] Consigo reconstruir TODO o conteúdo original do backup?
- [ ] Deletei TODOS os blocos top-level com `API-delete-a-block()`?
- [ ] Verifiquei que a página está vazia antes de escrever?
- [ ] Reconstruí a página com conteúdo do backup + novo conteúdo?
- [ ] Adicionei conteúdo dentro dos toggles (não só toggles vazios)?
