/**
 * Gemini Client — Gera resumos de notícias via Gemini REST API
 *
 * Segurança: API key no header x-goog-api-key (nunca exposta em logs).
 * Todas as requisições têm timeout via AbortController.
 */

import {
  GEMINI_BASE_URL,
  GEMINI_MODEL,
  MAX_RETRIES,
  GEMINI_CONFIG,
  type NewsArticle,
  type CategoryConfig,
} from './config';
import { sleep, fetchWithTimeout, createLogger } from './utils';

const logger = createLogger('gemini-client');

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Gera resumo para um conjunto de artigos de uma categoria via Gemini.
 * Retorna fallback (lista de títulos) se a API falhar.
 */
export async function summarizeCategory(
  category: CategoryConfig,
  articles: NewsArticle[],
  apiKey: string
): Promise<string> {
  if (articles.length === 0) {
    return `*Nenhuma notícia encontrada para "${category.label}" hoje.*`;
  }

  const articlesText = articles
    .map(
      (a, i) =>
        `${i + 1}. **${a.title}**\n   ${a.description || 'Sem descrição'}\n   Fonte: ${a.source.name} | ${a.url}`
    )
    .join('\n\n');

  const prompt = `${category.prompt}\n\nAqui estão as notícias:\n\n${articlesText}\n\nGere o resumo em português brasileiro com tom de newsletter matinal. Use bullet points para facilitar a leitura.`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent`;
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: GEMINI_CONFIG,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown');
        throw new Error(
          `Gemini error ${response.status}: ${errorText.slice(0, 200)}`
        );
      }

      const data = (await response.json()) as GeminiResponse;
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        '*Resumo não disponível*';

      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn(
          `Gemini tentativa ${attempt}/${MAX_RETRIES} falhou para "${category.label}". Retry em ${delay}ms`,
          { error: lastError.message }
        );
        await sleep(delay);
      }
    }
  }

  logger.error(
    `Gemini falhou para "${category.label}" após ${MAX_RETRIES} tentativas`,
    { error: lastError?.message }
  );

  // Fallback: texto plano com lista de artigos
  return articles
    .map((a) => `• ${a.title} — ${a.source.name}`)
    .join('\n');
}
