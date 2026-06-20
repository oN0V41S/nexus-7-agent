/**
 * Config — Tipos, constantes e validação de ambiente
 * para o CRON News → Notion
 */

// ─── Tipos ───────────────────────────────────────────

export interface NewsArticle {
  title: string;
  description: string | null;
  source: { name: string };
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  category: NewsCategory;
}

export type NewsCategory =
  | 'general'    // 🌎 Mundo
  | 'brazil'     // 🇧🇷 Brasil
  | 'business'   // 💼 Negócios
  | 'technology' // 🤖 Tecnologia & IA
  | 'career'     // 🚀 Minha Carreira
  | 'sports'     // ⚽ Esporte
  | 'health'     // 💊 Saúde & Ciência
  | 'goodnews';  // 🌞 Notícias Boas

export interface CategoryConfig {
  id: NewsCategory;
  emoji: string;
  label: string;
  newsApiQuery: string;
  prompt: string;
}

export interface SectionContent {
  category: CategoryConfig;
  articles: NewsArticle[];
  summary: string;
}

export interface EnvConfig {
  GEMINI_API_KEY: string;
  NEWSAPI_KEY: string;
  NOTION_TOKEN: string;
  NOTION_PARENT_PAGE_ID: string;
}

// ─── Constantes ──────────────────────────────────────

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'general',
    emoji: '🌎',
    label: 'Mundo',
    newsApiQuery: 'general',
    prompt:
      'Resuma as principais notícias internacionais em 3-4 parágrafos com bullet points. ' +
      'Destaque eventos geopolíticos relevantes. Idioma: português brasileiro.',
  },
  {
    id: 'brazil',
    emoji: '🇧🇷',
    label: 'Brasil',
    newsApiQuery: 'brazil',
    prompt:
      'Resuma as principais notícias do Brasil em 4-5 parágrafos com bullet points. ' +
      'Cubra política, economia, sociedade. Seja mais extenso que as outras seções. ' +
      'Idioma: português brasileiro.',
  },
  {
    id: 'business',
    emoji: '💼',
    label: 'Negócios & Economia',
    newsApiQuery: 'business',
    prompt:
      'Resuma as principais notícias de negócios e economia em 2-3 parágrafos com bullet points. ' +
      'Destaque mercados, empresas e tendências econômicas. Idioma: português brasileiro.',
  },
  {
    id: 'technology',
    emoji: '🤖',
    label: 'Tecnologia & IA',
    newsApiQuery: 'technology',
    prompt:
      'Resuma as principais novidades de tecnologia e IA em 2-3 parágrafos com bullet points. ' +
      'Destaque inovações, lançamentos e tendências tech. Idioma: português brasileiro.',
  },
  {
    id: 'career',
    emoji: '🚀',
    label: 'Minha Carreira',
    newsApiQuery: 'technology career artificial intelligence',
    prompt:
      'Resuma notícias sobre carreira, tecnologia, IA e mercado de trabalho em 2-3 parágrafos. ' +
      'Foco em: tendências de carreira em tech, IA generativa, mercado BR e mundial. ' +
      'Idioma: português brasileiro.',
  },
  {
    id: 'sports',
    emoji: '⚽',
    label: 'Esporte & Cultura',
    newsApiQuery: 'sports entertainment',
    prompt:
      'Resuma as principais notícias de esportes e entretenimento em 2-3 parágrafos. ' +
      'Idioma: português brasileiro.',
  },
  {
    id: 'health',
    emoji: '💊',
    label: 'Saúde & Ciência',
    newsApiQuery: 'health science',
    prompt:
      'Resuma os principais avanços em saúde e ciência em 2-3 parágrafos. ' +
      'Destaque descobertas, estudos e inovações médicas. Idioma: português brasileiro.',
  },
  {
    id: 'goodnews',
    emoji: '🌞',
    label: 'Notícias Boas',
    newsApiQuery: 'good news inspiration',
    prompt:
      'Selecione e resuma APENAS notícias positivas e inspiradoras em 2-3 parágrafos. ' +
      'Histórias de superação, descobertas felizes, atos de bondade. ' +
      'NÃO inclua notícias negativas. Esta é a última seção. Idioma: português brasileiro.',
  },
];

export const NEWSAPI_BASE_URL = 'https://newsapi.org/v2';
export const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta';
export const GEMINI_MODEL = 'gemini-2.0-flash';
export const GEMINI_CONFIG = {
  temperature: 0.7,
  maxOutputTokens: 1024,
} as const;
export const NOTION_API_BASE = 'https://api.notion.com/v1';
export const NOTION_VERSION = '2022-06-28';
export const NOTION_DATABASE_NAME = 'NewsDB';

export const MAX_RETRIES = 3;
export const RATE_LIMIT_MS = 350;
export const MAX_ARTICLES_PER_CATEGORY = 5;

// ─── Validação de Ambiente ──────────────────────────

export function validateEnv(): EnvConfig {
  const required = [
    'GEMINI_API_KEY',
    'NEWSAPI_KEY',
    'NOTION_TOKEN',
    'NOTION_PARENT_PAGE_ID',
  ] as const;

  const missing: string[] = [];

  for (const key of required) {
    const val = process.env[key];
    if (!val || val.trim().length < 5) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const msg = `❌ Variáveis de ambiente obrigatórias ausentes ou inválidas: ${missing.join(', ')}`;
    console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`);
    throw new Error(msg);
  }

  return {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
    NEWSAPI_KEY: process.env.NEWSAPI_KEY!,
    NOTION_TOKEN: process.env.NOTION_TOKEN!,
    NOTION_PARENT_PAGE_ID: process.env.NOTION_PARENT_PAGE_ID!,
  };
}
