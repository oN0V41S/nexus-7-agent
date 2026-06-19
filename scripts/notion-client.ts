/**
 * Notion Client — Publica edições diárias no Notion via REST API
 *
 * Cria o Database "📰 Meu News Personalizado" se não existir,
 * e publica cada edição como uma página diária com seções em toggles.
 *
 * CT-004.3: Se a página do dia já existir, APAGA os blocos existentes
 * e recria o conteúdo (evita duplicação).
 */

import {
  NOTION_API_BASE,
  NOTION_VERSION,
  RATE_LIMIT_MS,
  CATEGORIES,
  type SectionContent,
} from './config';
import { sleep, createLogger } from './utils';

const logger = createLogger('notion-client');

// ─── Tipos internos da API Notion ───────────────────

interface NotionDatabase {
  id: string;
  title?: Array<{ plain_text: string }>;
}

interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
}

interface NotionBlock {
  object: 'block';
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ─── Rate Limiting ──────────────────────────────────

let lastRequestTime = 0;

async function notionRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

// ─── Fetch Wrapper ──────────────────────────────────

async function notionFetch(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  await notionRateLimit();
  const url = `${NOTION_API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
      ...(options.headers as Record<string, string>),
    },
  });
  return response;
}

async function notionFetchJson<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await notionFetch(path, token, options);
  if (!response.ok) {
    const err = await response.text().catch(() => 'unknown');
    throw new Error(`Notion API ${response.status} em ${path}: ${err.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

// ─── Buscar Database existente ──────────────────────

async function searchDatabase(
  token: string,
  dbName: string
): Promise<NotionDatabase | null> {
  try {
    const data = await notionFetchJson<{ results?: NotionDatabase[] }>(
      '/search',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          query: dbName,
          filter: { value: 'database', property: 'object' },
          page_size: 10,
        }),
      }
    );

    const db = data.results?.find((r) =>
      r.title?.[0]?.plain_text?.includes(dbName)
    );
    return db || null;
  } catch (error) {
    logger.warn('Erro ao buscar database', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ─── Criar Database ─────────────────────────────────

async function createDatabase(token: string): Promise<NotionDatabase> {
  return notionFetchJson<NotionDatabase>('/databases', token, {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'workspace' },
      title: [
        { type: 'text', text: { content: '📰 Meu News Personalizado' } },
      ],
      properties: {
        'Título': { title: {} },
        'Data': { date: {} },
        'Status': {
          select: {
            options: [
              { name: '📬 Entregue', color: 'green' },
              { name: '⏳ Em produção', color: 'yellow' },
              { name: '❌ Falha', color: 'red' },
            ],
          },
        },
      },
    }),
  });
}

// ─── Buscar página do dia ───────────────────────────

async function findTodayPage(
  databaseId: string,
  token: string,
  today: string
): Promise<NotionPage | null> {
  try {
    const data = await notionFetchJson<{ results?: NotionPage[] }>(
      `/databases/${databaseId}/query`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            property: 'Data',
            date: { equals: today },
          },
          page_size: 1,
        }),
      }
    );
    return data.results?.[0] || null;
  } catch {
    return null;
  }
}

// ─── Apagar blocos de uma página ────────────────────

async function deletePageBlocks(pageId: string, token: string): Promise<void> {
  try {
    const data = await notionFetchJson<{ results?: NotionBlock[] }>(
      `/blocks/${pageId}/children`,
      token
    );

    if (!data.results || data.results.length === 0) return;

    // Apaga blocos em lote
    for (const block of data.results) {
      if (block.object === 'block' && block.id) {
        await notionFetch(`/blocks/${block.id}`, token, {
          method: 'DELETE',
        });
      }
    }

    logger.info(`${data.results.length} blocos antigos apagados`);
  } catch (error) {
    logger.warn('Erro ao apagar blocos existentes', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── Criar página diária ────────────────────────────

async function createDailyPage(
  databaseId: string,
  token: string,
  today: string
): Promise<NotionPage> {
  const dateStr = formatDateBR(today);
  return notionFetchJson<NotionPage>('/pages', token, {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        'Título': {
          title: [
            { text: { content: `📰 Edição de ${dateStr}` } },
          ],
        },
        'Data': {
          date: { start: today },
        },
        'Status': {
          select: { name: '⏳ Em produção' },
        },
      },
    }),
  });
}

// ─── Adicionar blocos de seção ──────────────────────

function createToggleBlock(
  emoji: string,
  title: string,
  content: string
): NotionBlock {
  return {
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: [
        {
          type: 'text',
          text: { content: ` ${emoji}  ${title}` },
          annotations: { bold: true },
        },
      ],
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: { content },
              },
            ],
          },
        },
      ],
    },
  };
}

async function appendBlocks(
  pageId: string,
  token: string,
  blocks: NotionBlock[]
): Promise<void> {
  // Notion API aceita até 100 blocos por chamada
  for (let i = 0; i < blocks.length; i += 100) {
    const chunk = blocks.slice(i, i + 100);
    await notionFetchJson(`/blocks/${pageId}/children`, token, {
      method: 'PATCH',
      body: JSON.stringify({ children: chunk }),
    });
  }
}

// ─── Atualizar Status ────────────────────────────────

async function updatePageStatus(
  pageId: string,
  token: string,
  status: string
): Promise<void> {
  // Fire-and-forget aceitável — falha em status não quebra o fluxo
  try {
    await notionFetch(`/pages/${pageId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          Status: {
            select: { name: status },
          },
        },
      }),
    });
  } catch (error) {
    logger.warn('Falha ao atualizar status da página', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── Formatação ──────────────────────────────────────

function formatDateBR(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return 'data-invalida';
  }
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

// ─── API Pública ─────────────────────────────────────

/**
 * Garante que o Database existe e retorna seu ID.
 * Procura por "📰 Meu News Personalizado" no workspace.
 * Se não existir, cria um novo.
 */
export async function ensureDatabase(token: string): Promise<string> {
  logger.info('Verificando se Database "📰 Meu News Personalizado" existe...');

  const existing = await searchDatabase(token, '📰 Meu News Personalizado');
  if (existing) {
    logger.info(`Database encontrado: ${existing.id}`);
    return existing.id;
  }

  logger.info('Criando novo Database no workspace raiz...');
  const db = await createDatabase(token);
  logger.info(`Database criado: ${db.id}`);
  return db.id;
}

/**
 * Publica uma edição diária de notícias no Notion.
 *
 * Fluxo:
 * 1. Verifica se já existe página para hoje
 * 2. Se existir: apaga blocos antigos e reusa a página (CT-004.3)
 * 3. Se não existir: cria nova página
 * 4. Adiciona blocos toggle para cada seção
 * 5. Atualiza status para "📬 Entregue"
 */
export async function publishDailyEdition(
  databaseId: string,
  token: string,
  sections: SectionContent[]
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  logger.info(`Publicando edição de ${formatDateBR(today)}...`);

  // (1) Verifica se já existe página para hoje
  const existingPage = await findTodayPage(databaseId, token, today);
  let pageId: string;

  if (existingPage) {
    // (2) CT-004.3: Reusa página existente — apaga blocos e recria
    logger.info(
      `Edição de hoje já existe (${existingPage.id}). Reutilizando página...`
    );
    await deletePageBlocks(existingPage.id, token);
    pageId = existingPage.id;
  } else {
    // (3) Cria nova página
    const page = await createDailyPage(databaseId, token, today);
    pageId = page.id;
    logger.info(`Página criada: ${pageId}`);
  }

  // (4) Cria blocos toggle para cada seção
  const blocks: NotionBlock[] = sections
    .filter((s) => s.summary && s.summary.length > 0)
    .map((s) =>
      createToggleBlock(s.category.emoji, s.category.label, s.summary)
    );

  if (blocks.length === 0) {
    logger.warn('Nenhuma seção com conteúdo para publicar');
    await updatePageStatus(pageId, token, '❌ Falha');
    return;
  }

  // Adiciona blocos em lotes de 100
  await appendBlocks(pageId, token, blocks);
  logger.info(`${blocks.length} seções adicionadas à página`);

  // (5) Marca como entregue
  await updatePageStatus(pageId, token, '📬 Entregue');
  logger.info('✅ Edição publicada com sucesso!');
}
