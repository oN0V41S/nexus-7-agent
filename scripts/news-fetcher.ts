/**
 * NewsAPI Client — Coleta notícias via NewsAPI.org
 *
 * Estratégia (v2):
 *   - Categorias padrão (general, business, technology, sports, health):
 *     → top-headlines (country=br, category=...)
 *     → fallback para everything se retornar 0
 *   - Categorias custom (brazil, career, goodnews):
 *     → everything (q=..., language=pt) diretamente
 *
 * Segurança: API key no header X-Api-Key (nunca em query param).
 * Todas as requisições têm timeout via AbortController.
 * Rate limiting entre chamadas para evitar throttle da NewsAPI.
 */

import {
  NEWSAPI_BASE_URL,
  MAX_RETRIES,
  MAX_ARTICLES_PER_CATEGORY,
  RATE_LIMIT_MS,
  type NewsArticle,
  type CategoryConfig,
} from './config';
import { sleep, fetchWithTimeout, createLogger } from './utils';

const logger = createLogger('news-fetcher');

export interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: Array<{
    title: string;
    description: string | null;
    source: { name: string };
    url: string;
    urlToImage: string | null;
    publishedAt: string;
  }>;
}

/**
 * Busca no endpoint /everything (keyword search em todo o acervo).
 * Mais indicado para queries custom e fallback.
 */
async function fetchEverything(
  category: CategoryConfig,
  apiKey: string
): Promise<NewsArticle[]> {
  const params = new URLSearchParams({
    q: category.newsApiQuery,
    language: 'pt',
    sortBy: 'publishedAt',
    pageSize: String(MAX_ARTICLES_PER_CATEGORY),
  });
  const url = `${NEWSAPI_BASE_URL}/everything?${params.toString()}`;

  return executeRequest(url, apiKey, category);
}

/**
 * Busca no endpoint /top-headlines (breaking news por país/categoria).
 * Mais indicado para as 5 categorias padrão da NewsAPI.
 */
async function fetchTopHeadlines(
  category: CategoryConfig,
  apiKey: string
): Promise<NewsArticle[]> {
  const params = new URLSearchParams({
    country: 'br',
    category: category.id,
    pageSize: String(MAX_ARTICLES_PER_CATEGORY),
  });
  const url = `${NEWSAPI_BASE_URL}/top-headlines?${params.toString()}`;

  return executeRequest(url, apiKey, category);
}

/**
 * Executa uma requisição GET para a URL com retry exponencial.
 */
async function executeRequest(
  url: string,
  apiKey: string,
  category: CategoryConfig
): Promise<NewsArticle[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: { 'X-Api-Key': apiKey },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown');
        throw new Error(
          `NewsAPI error ${response.status}: ${errorText.slice(0, 200)}`
        );
      }

      const data = (await response.json()) as NewsApiResponse;

      if (data.status !== 'ok') {
        throw new Error(`NewsAPI status error: ${data.status}`);
      }

      return data.articles
        .filter((a) => a.title && a.title !== '[Removed]')
        .slice(0, MAX_ARTICLES_PER_CATEGORY)
        .map((a) => ({
          title: a.title,
          description: a.description,
          source: a.source,
          url: a.url,
          urlToImage: a.urlToImage,
          publishedAt: a.publishedAt,
          category: category.id,
        }));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 500;
        logger.warn(
          `Tentativa ${attempt}/${MAX_RETRIES} falhou para "${category.label}". Retry em ${delay}ms`,
          { error: lastError.message }
        );
        await sleep(delay);
      }
    }
  }

  logger.warn(`Falha ao buscar "${category.label}" após ${MAX_RETRIES} tentativas`, {
    error: lastError?.message,
  });
  return [];
}

/**
 * Busca notícias para uma categoria com fallback inteligente.
 *
 * Categorias padrão (general, business, technology, sports, health):
 *   1. top-headlines (country=br, category=id)
 *   2. Se retornar 0 artigos → fallback para everything (q=query)
 *
 * Categorias custom (brazil, career, goodnews):
 *   1. everything (q=query, language=pt) diretamente
 */
export async function fetchNewsByCategory(
  category: CategoryConfig,
  apiKey: string
): Promise<NewsArticle[]> {
  let articles: NewsArticle[] = [];

  // ── Estratégia 1: top-headlines (apenas categorias padrão) ──
  if (category.isStandardCategory) {
    logger.debug(`  → "${category.label}": tentando top-headlines...`);
    articles = await fetchTopHeadlines(category, apiKey);

    if (articles.length > 0) {
      return articles;
    }

    logger.info(
      `  → "${category.label}": top-headlines vazio (0 artigos), tentando fallback everything...`
    );
    await sleep(RATE_LIMIT_MS); // pausa antes do fallback
  }

  // ── Estratégia 2: everything (fallback ou direto) ──
  logger.debug(`  → "${category.label}": tentando everything (q="${category.newsApiQuery}")...`);
  articles = await fetchEverything(category, apiKey);

  if (articles.length > 0) {
    return articles;
  }

  // ── Último recurso: everything sem filtro de idioma ──
  logger.info(`  → "${category.label}": everything vazio, tentando sem filtro de idioma...`);
  await sleep(RATE_LIMIT_MS);

  const params = new URLSearchParams({
    q: category.newsApiQuery,
    sortBy: 'relevancy',
    pageSize: String(MAX_ARTICLES_PER_CATEGORY),
  });
  const url = `${NEWSAPI_BASE_URL}/everything?${params.toString()}`;
  articles = await executeRequest(url, apiKey, category);

  return articles;
}
