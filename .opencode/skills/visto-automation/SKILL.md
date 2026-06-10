---
name: visto-automation
description: Padrões de automação browser para o Visto DAM — sessão, login, react-select, modais, filtros, permissões.
---

# Visto Automation Skill

Padrões documentados de automação browser para o Visto DAM (natura.visto.global). Esta skill codifica patterns descobertos através de debugging extensivo para reuso consistente.

## Quando Usar Esta Skill

- Automatizar qualquer interação com Visto DAM (busca, filtros, permissões, upload)
- Escrever scripts de automação browser para a plataforma Visto
- Depurar falhas de automação em componentes react-select e modais Material-UI
- Gerenciar ciclo de vida de sessão com autenticação 2FA

## Quando NÃO Usar Esta Skill

- Para debugging de performance do frontend (use `@chrome-devtools-agent`)
- Para testes de carga ou stress

## Session Management (Padrão mais importante)

O Visto DAM usa autenticação com 2FA via Azure AD. A sessão expira após ~24h. Todo script de automação **deve** verificar a sessão antes de executar.

### Ciclo de Vida da Sessão

| Componente | Caminho | Propósito |
|---|---|---|
| Session file | `.playwright-mcp/.visto-session.json` | Estado de armazenamento do browser (storageState) |
| Login script | `.playwright-mcp/visto-login.mjs` | Gerenciamento de autenticação |
| Cookie backup | `.playwright-mcp/.visto-session-cookies.json` | Backup de cookies para recovery |

### Modos de Operação

O script `visto-login.mjs` opera em dois modos:

1. **`login`** (padrão): Executa autenticação completa com 2FA. Requer intervenção humana para aprovação no dispositivo móvel.
2. **`verify`**: Verifica se a sessão atual ainda é válida sem abrir o navegador.

```bash
# Verificar sessão antes de qualquer automação
node .playwright-mcp/visto-login.mjs verify

# Se inválida, re-autenticar (requer 2FA humano)
node .playwright-mcp/visto-login.mjs
```

### Uso em Scripts de Automação

```javascript
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = resolve(__dirname, '.visto-session.json');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: SESSION_FILE, // <-- sempre usar storageState
  });
  const page = await context.newPage();

  try {
    // ... automação
  } catch (err) {
    console.error(err);
    await page.screenshot({ path: resolve(__dirname, '.playwright-mcp/.visto-error.png') });
  } finally {
    await browser.close();
  }
}
```

### Regras de Ouro

- **Sempre** verificar sessão antes de iniciar automação (`visto-login.mjs verify`)
- **Nunca** commitar `.visto-session.json` ou `.visto-session-cookies.json`
- Se o page redirecionar para página de login → sessão expirou, re-autenticar

## React-Select Pattern (CRITICAL — pitfall mais comum)

O Visto DAM usa `react-select` para dropdowns de busca/filtro. O comportamento desse componente é contra-intuitivo para automação.

### O Problema

```javascript
// ❌ ERRADO: .fill() não dispara o filtro do react-select
await input.fill('Natura Liberado Sim');
```

O método `fill()` apenas insere texto no campo mas **não dispara** o mecanismo de busca/filtro interno do react-select.

### A Solução

```javascript
// ✅ CORRETO: digitação via teclado dispara o filtro
const input = page.locator('input[id^="react-select"]').first();
await input.focus();
await input.click({ force: true });
await sleep(800);
await page.keyboard.type('Natura Liberado Sim');
await sleep(2500);
await page.locator('[id^="react-select-"][id*="-option-"]')
  .filter({ hasText: 'Natura Liberado Sim' })
  .first()
  .click({ force: true });
await sleep(2000);
```

### Comportamentos Importantes

| Comportamento | Implicação |
|---|---|
| `closeMenuOnSelect: true` | Clicar na opção fecha o dropdown automaticamente |
| Opção não encontrada → `filter({ hasText })` nunca falha silenciosamente | Sempre verificar se a opção existe antes de clicar |
| IDs dinâmicos: `react-select-{N}-option-{M}` | N muda a cada sessão — **nunca** hardcode o ID |

### O que NÃO Fazer

- ❌ **Não** pressionar `Escape` após selecionar — o dropdown já fechou e o Escape fechará o modal pai!
- ❌ **Não** usar `page.selectOption()` — react-select não é um `<select>` nativo
- ❌ **Não** hardcodar IDs de opção (`react-select-2-option-0`)
- ❌ **Não** usar `.fill()` ou `.pressSequentially()` — não disparam o filtro interno

### Para "Limpar" o Foco sem Fechar o Modal

Use a tecla `Alt` para tirar o foco do dropdown sem fechar o modal:

```javascript
await page.keyboard.press('Alt');
```

## Modal Dialog Pattern

O Visto DAM usa Material-UI Dialogs para modais de edição, permissões e confirmação.

### Estrutura do Modal

```javascript
// Dialogs usam role="dialog" e classe .MuiDialog-root
const modal = page.locator('[role="dialog"]');

// Botão para abrir — ícone de "+"
const addButton = page.locator('[data-testid="AddRoundedIcon"]');
await addButton.click();
await sleep(2000);
```

### Conteúdo e Ações

| Elemento | Seletor | Nota |
|---|---|---|
| Conteúdo do modal | `.MuiDialogContent-root` | Contém react-selects |
| Confirmar | `.MuiButton-containedPrimary` | Pode haver múltiplos — filtrar por texto |
| Fechar | Botão "Fechar" | Text match direto |

### Interação Segura

```javascript
// Confirmar — filtrar por texto para evitar ambiguidade
await page.locator('.MuiButton-containedPrimary')
  .filter({ hasText: 'Confirmar' })
  .click();

// Ou fechar sem confirmar
await page.locator('button:has-text("Fechar")').click();
```

### ⚠️ Atenção: Propagação do Escape

O Visto DAM tem um comportamento crítico de propagação de eventos:

1. React-select aberto → **Escape** → Fecha o dropdown (comportamento esperado)
2. React-select já fechado → **Escape** → **Fecha o modal também!**

**Regra:** Só pressione Escape se você tem **certeza** que o dropdown do react-select está aberto. Quando em dúvida, use `Alt` para blur.

## Navigation Pattern

Fluxo padrão para navegação no Visto DAM.

### Sequência Padrão

```javascript
// 1. Navegar para busca
await page.goto('https://natura.visto.global/app/dam/search?query=<imagem>', {
  waitUntil: 'networkidle',
  timeout: 30000
});

// 2. Dismiss popups/modal de boas-vindas
await page.keyboard.press('Escape');
await sleep(1500);

// 3. Filtrar por Status
await page.locator('#DamFiltersstatus').click();
// ... react-select pattern para selecionar "Ativos"

// 4. Abrir imagem com duplo clique
await page.locator('img[alt="<filename>"]').first().dblclick();
await sleep(3000);

// 5. Navegar entre abas
await page.locator('text=Nome da Aba').click();
await sleep(1500);
```

### Timeouts Recomendados

| Operação | Timeout |
|---|---|
| Navegação (`goto`) | 30000ms |
| Dismiss de popup | 1500ms |
| Digitação react-select | 2500ms (esperar resultados) |
| Duplo clique em imagem | 3000ms (renderização) |
| Transições entre abas | 1500ms |
| Cliques em geral | 2000ms |

## Error Handling Pattern

### Estrutura Padrão com Screenshot

```javascript
async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();

  try {
    console.log('[login] sessão validada');
    // ... automação com logs por passo
  } catch (err) {
    console.error('[erro]', err.message);
    await page.screenshot({
      path: resolve(__dirname, '.playwright-mcp/.visto-error.png'),
      fullPage: true
    });
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Falha na automação:', err.message);
  process.exit(1);
});
```

### Checklist de Logs

Cada passo deve ter um `console.log` descritivo:

```javascript
console.log('[navegar] acessando página de busca');
console.log('[filtro] aplicando filtro de status');
console.log('[imagem] abrindo detalhes da imagem');
console.log('[permissão] adicionando permissão');
console.log('[ok] operação concluída');
```

## File Organization

Todos os arquivos de automação Visto DAM vivem em `.playwright-mcp/` na raiz do projeto:

```
.playwright-mcp/
├── visto-login.mjs                 # Gerenciamento de sessão
├── visto-select-verify-confirm.mjs # Script de referência
├── .visto-session.json             # Sessão ativa (NÃO commitar)
└── .visto-session-cookies.json     # Backup de cookies (NÃO commitar)
```

### .gitignore Recomendado

```
# Visto session files
.playwright-mcp/.visto-session.json
.playwright-mcp/.visto-session-cookies.json
.playwright-mcp/.visto-error.png
```

## Debugging Tips

### Problemas e Soluções

| Sintoma | Causa Provável | Solução |
|---|---|---|
| Redireciona para `/login` | Sessão expirou | Rodar `visto-login.mjs` |
| React-select sem opções | `fill()` não disparou filtro | Usar `keyboard.type()` |
| Modal fecha sozinho | Escape pressionado com dropdown fechado | Usar `Alt` para blur |
| "Confirmar" não encontrado | Múltiplos `MuiButton-containedPrimary` | Filtrar por `.filter({ hasText: 'Confirmar' })` |
| `dblclick` timeout | Página não carregou completamente | Aumentar wait, verificar `waitUntil` |
| Erro `storageState` file not found | Sessão nunca foi criada | Rodar `visto-login.mjs` primeiro |

### Fluxo de Debugging

1. **Sessão inválida?** → `node .playwright-mcp/visto-login.mjs verify`
2. **Screenshot disponível?** → Verificar `.visto-error.png`
3. **Logs mostram onde parou?** → Último `console.log` antes do erro
4. **react-select não responde?** → Tentar com `headless: false` para observar

## Padrão: Clonagem de Licenças

Fluxo para copiar licenças de uma imagem antiga para uma imagem nova no Visto DAM.

### Scripts

| Script | Função |
|--------|--------|
| `extrair-licencas.mjs <imagem>` | Navega até a imagem, extrai licenças da aba Licenças, salva JSON |
| `adicionar-licencas.mjs <json> <imagem-nova>` | Lê JSON, navega até imagem nova, explora interface de adição |
| `visto-clonagem-licenca.mjs <antiga> <nova>` | Orquestrador: validar sessão → extrair → adicionar → relatório |

### Formato do JSON

```json
{
  "imagemOriginal": "PE_Ciclo12-26_1015",
  "dataExtracao": "2026-05-27T19:36:58.532Z",
  "totalLicencas": 6,
  "licencas": [
    {
      "id": 1,
      "nome": "Direito de Uso de Imagem",
      "periodo": "28/05/2026 - 28/05/2031",
      "territorios": ["Argentina"],
      "canais": ["Aplicativos Natura", "Casa Natura", ...]
    }
  ]
}
```

### Seletores da Aba Licenças

| Componente | Seletor | Notas |
|---|---|---|
| Tab Licenças | `[role="tab"]:has-text("Licenças")` | `aria-selected="true"` quando ativo |
| Filtro Território | `#react-select-2-input` | react-select, usar `keyboard.type()` |
| Filtro Canal | `#react-select-3-input` | react-select, usar `keyboard.type()` |
| Item de licença | `li[class*="css-h2y34m"]` | Cada licença é um `<li>` |
| Nome licença | `h6[class*="css-4dcfx8"]` | "Direito de Uso de Imagem" |
| Período | `p[class*="css-1ck3as5"]` | "28/05/2026 - 28/05/2031" |
| Botão Baixar | `button:has-text("Baixar Selecionados")` | Download dos selecionados |
| Botão Excluir | `button:has-text("Excluir Selecionados")` | Delete dos selecionados |

### Uso

```bash
# Extrair licenças de imagem antiga
node .playwright-mcp/extrair-licencas.mjs PE_Ciclo12-26_1015

# Adicionar licenças na imagem nova
node .playwright-mcp/adicionar-licencas.mjs data/licencas/licencas-PE_Ciclo12-26_1015.json PE_Ciclo12-26_1016

# Pipeline completo
node .playwright-mcp/visto-clonagem-licenca.mjs PE_Ciclo12-26_1015 PE_Ciclo12-26_1016
```

### Modal: "Nova Licença de Uso"

O modal é aberto clicando no **FAB** (Floating Action Button) — botão circular preto com ícone Plus, canto inferior direito.

**Seletor do FAB:** `.MuiFab-root` (classe MUI `MuiFab-secondary`)

#### Campos do Formulário

| Campo | Tipo | Seletor | Obrigatório | Observações |
|-------|------|---------|-------------|-------------|
| **Tipo de licença** | react-select | `[role="dialog"] input[id^="react-select"]` (1º) | ✅ | Opções: "Direito de Uso de Imagem", "Contrato de Direito de Uso de Imagem Internacional", etc. |
| **Data inicial** | date mask (tel) | `#mui-57` | ✅ | Formato DD/MM/AAAA |
| **Data final** | date mask (tel) | `#mui-58` | ✅ | Formato DD/MM/AAAA |
| **Território** | react-select multi | `[role="dialog"] input[id^="react-select"]` (2º) | ❌ | Multi-select: Alemanha, Argentina, Bolívia, Brasil, Chile, Colômbia, Equador, Espanha, EUA, França, Italia |
| **Tipos de uso** | checkboxes | `input[type="checkbox"]` | ❌ | Comercial, Institucional, Publicitário |
| **Restrições** | textarea | `#mui-60` | ❌ | Placeholder: "Descreva restrições específicas para esta licença" |

#### Botões do Modal

| Botão | Seletor | Estado |
|-------|---------|--------|
| **Fechar** | `button:has-text("Fechar")` | Sempre habilitado |
| **Confirmar** | `button:has-text("Confirmar")` | Habilitado após preencher campos obrigatórios |

#### Opções de Tipo de Licença

1. `1 - FOTO DE LAYOUT NATURA (NÃO USAR)`
2. `Contrato de Direito de Uso de Imagem Internacional`
3. `Contrato de Direito de Uso de Imagem Latam`
4. `Direito de Uso de Imagem`
5. `Padrão 60 dias`
6. `Prorrogação do direito de uso de imagens`
7. `Use Rights - International`

#### Opções de Território

Alemanha, Argentina, Bolívia, Brasil, Chile, Colômbia, Equador, Espanha, EUA, França, Italia

#### Fluxo de Preenchimento

```javascript
// 1. Tipo de licença (react-select)
const tipoInput = page.locator('[role="dialog"] input[id^="react-select"]').first();
await tipoInput.focus();
await tipoInput.click({ force: true });
await page.keyboard.type('Direito de Uso de Imagem');
await sleep(2000);
await page.locator('[id^="react-select-"][id*="-option-"]').filter({ hasText: 'Direito de Uso de Imagem' }).first().click({ force: true });

// 2. Data inicial
const dataIni = page.locator('#mui-57');
await dataIni.click({ force: true });
await page.keyboard.type('28/05/2026');
await page.keyboard.press('Tab');

// 3. Data final
const dataFim = page.locator('#mui-58');
await dataFim.click({ force: true });
await page.keyboard.type('28/05/2031');
await page.keyboard.press('Tab');

// 4. Território (multi-select)
const terrInput = page.locator('[role="dialog"] input[id^="react-select"]').nth(1);
await terrInput.focus();
await terrInput.click({ force: true });
await page.keyboard.type('Brasil');
await sleep(2000);
await page.locator('[id^="react-select-"][id*="-option-"]').filter({ hasText: 'Brasil' }).first().click({ force: true });

// 5. Tipos de uso (checkboxes)
await page.locator('[role="dialog"] label:has-text("Comercial")').first().click({ force: true });

// 6. Confirmar
await page.locator('[role="dialog"] button:has-text("Confirmar")').first().click({ force: true });
```

### ⚠️ Dependência: Checkboxes → Canais

Canais (react-select) **só aparecem após** marcar o checkbox correspondente:

```javascript
// 1. Marcar checkbox primeiro
const checkbox = page.locator(`[role="dialog"] label:has-text("Comercial")`).first();
await checkbox.click({ force: true });
await sleep(2000);

// 2. Só então o react-select de canais aparece
const channelInput = page.locator('[role="dialog"] input[id^="react-select"]').last();
await channelInput.focus();
await channelInput.click({ force: true });
await sleep(1500);

// 3. "Selecionar Tudo" é sempre a primeira opção
await page.locator('[id^="react-select-"][id*="-option-"]')
  .filter({ hasText: 'Selecionar Tudo' }).first().click({ force: true });
await sleep(1000);
```

### Botões com "Selecionar Tudo"

Cada categoria (Comercial, Institucional, Publicitário) tem sua própria opção "Selecionar Tudo" no react-select de canais. Isso evita ter que selecionar individualmente 43+ canais.

## Padrão: Orquestração do Pipeline

### Arquitetura do Pipeline de Clonagem

```
visto-clonagem-licenca.mjs (orquestrador)
├── 1. verificarSessao()      → visto-login.mjs verify
├── 2. extrairLicencas()      → extrair-licencas.mjs <antiga>
├── 3. adicionarLicencas()    → adicionar-licencas.mjs <json> <nova>
├── 4. gerarSumarioTexto()    → formata validação legível
└── 5. gerarRelatorio()       → salva JSON com metadados
```

Cada estágio executa via `child_process.execSync()` com `DISPLAY=:99` e `node <script>.mjs <args>`.

### Integração com Nexus Log

O orquestrador escreve logs estruturados em `.opencode/logs/visto-pipeline-{YYYY-MM-DD}.log`:

```javascript
function nexusLog(level, message, metadata = {}) {
  const logDir = resolve(__dirname, '..', '.opencode', 'logs');
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const logFile = resolve(logDir, `visto-pipeline-${date}.log`);
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
  const entry = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
  appendFileSync(logFile, entry, 'utf-8');
}
```

Formato da entrada: `[2026-05-28T10:00:00.000Z] [INFO] mensagem {"key":"value"}`

## Padrão: Validação de Resultados

### Formato de Sumário Textual

Após a clonagem, o orquestrador exibe um resumo formatado para validação visual rápida:

```
==================== VALIDAÇÃO: RESUMO DAS LICENÇAS ====================
Imagem Original: FOT-CST-PER-FEM-ILIA-CICLO-11-2026-125968
Total de Licenças: 7

  [1] [Direito de Uso de Imagem], [28/05/2026 - 28/05/2031], [Argentina], [Comercial, Institucional], [Aplicativos Natura, Casa Natura, Catálogo... (+3)]
```

### Campos do Sumário

| Campo | Fonte no JSON | Exemplo |
|---|---|---|
| ID | `licenca.id` | 1 |
| Tipo de Contrato | `licenca.nome` | Direito de Uso de Imagem |
| Período | `licenca.periodo` | 28/05/2026 - 28/05/2031 |
| Territórios | `licenca.territorios` | Argentina |
| Tipos de uso | `licenca.categoriasCanais` | Comercial, Institucional |
| 3 primeiros canais | `licenca.canais.slice(0,3)` | Aplicativos Natura, Casa Natura, Catálogo... |

### Relatório JSON Estruturado

O orquestrador salva em `data/licencas/relatorio-{antiga}-{nova}-{timestamp}.json`:

```json
{
  "timestamp": "2026-05-28T10:00:00.000Z",
  "pipeline": "clonagem-licencas",
  "imagemOriginal": "FOT-CST-PER-FEM-ILIA-CICLO-11-2026-125968",
  "imagemDestino": "PE_Ciclo12-26_1002",
  "jsonGerado": "data/licencas/licencas-....json",
  "sucesso": true,
  "status": "CONCLUÍDO",
  "totalLicencas": 7,
  "licencas": [
    {
      "id": 1,
      "nome": "Direito de Uso de Imagem",
      "periodo": "28/05/2026 - 28/05/2031",
      "territorios": ["Argentina"],
      "categoriasCanais": ["Comercial", "Institucional"],
      "canais": ["Aplicativos Natura", "Casa Natura", "Catálogo", ...]
    }
  ]
}
```

## Padrão: Exact Match em React-Select

### Problema

O filter `{ hasText: 'Direito de Uso de Imagem' }` do Playwright faz **partial match** — seleciona "Contrato de Direito de Uso de Imagem Internacional" em vez de "Direito de Uso de Imagem".

### Solução

Usar **exact regex** no hasText para evitar colisões:

```javascript
// ❌ ERRADO: partial match pega opção errada
page.locator('[id^="react-select-"][id*="-option-"]')
  .filter({ hasText: 'Direito de Uso de Imagem' });

// ✅ CORRETO: regex de match exato
page.locator('[id^="react-select-"][id*="-option-"]')
  .filter({ hasText: new RegExp(`^${lic.nome}$`) });
```

### Quando Usar

- **Sempre** que o texto da opção for substring de outra opção (ex: "Direito de Uso de Imagem" vs "Contrato de Direito de Uso de Imagem Internacional")
- Opções com prefixos numéricos (ex: "1 - FOTO DE LAYOUT NATURA") não precisam — são únicas

## Padrão: Fechar Dropdown sem Fechar Modal

### Problema

`page.keyboard.press('Escape')` fecha o modal pai se o dropdown react-select já estiver fechado.

### Soluções

| Situação | Ação |
|---|---|
| Dropdown está aberto | `Escape` — seguro, fecha só o dropdown |
| Dropdown já fechado | Clicar no título do modal (`[role="dialog"] h2`) |
| Precisa tirar foco | `Alt` — não fecha nada |

```javascript
// ✅ Seguro: clicar no título do modal
await page.locator('[role="dialog"] h2').click({ force: true });

// ✅ Alternativa: Tecla Alt (tira foco sem fechar)
await page.keyboard.press('Alt');
```
