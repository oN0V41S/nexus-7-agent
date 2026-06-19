/**
 * NewsAPI Client — Coleta notícias via NewsAPI.org
 *
 * Segurança: API key no header X-Api-Key (nunca em query param).
 * Todas as requisições têm timeout via AbortController.
 */

import {
  NEWSAPI_BASE_URL,
  MAX_RETRIES,
  MAX_ARTICLES_PER_CATEGORY,
  CATEGORIES,
  type NewsArticle,
  type CategoryConfig,
} from './config';
import { sleep, fetchWithTimeout, createLogger } from './utils';

const logger = createLogger('news-fetcher');

// Categorias que usam o parâmetro `category` da NewsAPI (vs query search)
const NEWSAPI_STANDARD_CATEGORIES = new Set([
  'general',
  'business',
  'technology',
  'sports',
  'health',
]);

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
 * Busca notícias para uma categoria específica.
 * Retorna array vazio em caso de falha (não quebra o pipeline).
 */
export async function fetchNewsByCategory(
  category: CategoryConfig,
  apiKey: string
): Promise<NewsArticle[]> {
  const params = new URLSearchParams();

  if (NEWSAPI_STANDARD_CATEGORIES.has(category.id)) {
    params.set('country', 'br');
    params.set('category', category.id);
  } else {
    params.set('q', category.newsApiQuery);
    params.set('language', 'pt');
    params.set('sortBy', 'popularity');
  }

  params.set('pageSize', String(MAX_ARTICLES_PER_CATEGORY));
  const url = `${NEWSAPI_BASE_URL}/top-headlines?${params.toString()}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          'X-Api-Key': apiKey,
        },
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

  logger.error(
    `Falha ao buscar "${category.label}" após ${MAX_RETRIES} tentativas`,
    { error: lastError?.message }
  );
  return [];
}
