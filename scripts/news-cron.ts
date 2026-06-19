#!/usr/bin/env npx tsx
/**
 * CRON News → Notion — Script Principal
 *
 * Pipeline diário:
 *   1. Valida ambiente (env vars)
 *   2. Busca notícias por categoria (NewsAPI.org)
 *   3. Gera resumos (Gemini API)
 *   4. Publica no Notion (Notion REST API)
 *
 * Uso:
 *   npx tsx scripts/news-cron.ts
 *
 * Requer variáveis de ambiente:
 *   GEMINI_API_KEY, NEWSAPI_KEY, NOTION_TOKEN
 */

import { validateEnv, CATEGORIES, RATE_LIMIT_MS } from './config';
import { fetchNewsByCategory } from './news-fetcher';
import { summarizeCategory } from './gemini-client';
import { ensureDatabase, publishDailyEdition } from './notion-client';
import { sleep, createLogger } from './utils';
import type { SectionContent } from './config';

const logger = createLogger('news-cron');

// ─── Main ───────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  logger.info('🚀 Iniciando CRON News → Notion');

  // ── Etapa 1: Validar ambiente ──
  logger.info('📋 Validando variáveis de ambiente...');
  const env = validateEnv();
  logger.info('✅ Ambiente validado com sucesso');

  // ── Etapa 2 + 3: Buscar notícias + gerar resumos ──
  logger.info(`📰 Buscando e resumindo notícias em ${CATEGORIES.length} categorias...`);

  const sections: SectionContent[] = [];

  for (const category of CATEGORIES) {
    try {
      logger.info(`  → "${category.label}": buscando...`);
      const articles = await fetchNewsByCategory(category, env.NEWSAPI_KEY);
      logger.info(`  → "${category.label}": ${articles.length} artigos`);

      logger.info(`  → "${category.label}": resumindo...`);
      const summary = await summarizeCategory(category, articles, env.GEMINI_API_KEY);
      logger.info(`  → "${category.label}": resumo gerado (${summary.length} caracteres)`);

      sections.push({ category, articles, summary });

      // Delay entre categorias para rate limiting
      await sleep(RATE_LIMIT_MS * 2);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Falha na categoria "${category.label}"`, { error: errMsg });

      // Falha parcial: continua com as próximas categorias
      sections.push({
        category,
        articles: [],
        summary: `*Indisponível devido a erro: ${errMsg}*`,
      });
    }
  }

  const totalArticles = sections.reduce((sum, s) => sum + s.articles.length, 0);
  logger.info(`📊 Total: ${totalArticles} artigos em ${sections.length} categorias`);

  // ── Etapa 4: Publicar no Notion ──
  logger.info('📝 Publicando no Notion...');

  try {
    const databaseId = await ensureDatabase(env.NOTION_TOKEN);
    await publishDailyEdition(databaseId, env.NOTION_TOKEN, sections);
    logger.info('✅ Publicação concluída com sucesso!');
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Falha na publicação no Notion`, { error: errMsg });
    throw error;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`⏱️  Tempo total: ${elapsed}s`);
  logger.info('🎉 CRON News → Notion finalizado com sucesso!');
}

// ─── Execução ───────────────────────────────────────

main().catch((error) => {
  const errMsg = error instanceof Error ? error.message : String(error);
  logger.error(`💥 Falha fatal: ${errMsg}`);
  process.exit(1);
});
