/**
 * Utilitários compartilhados para o CRON News → Notion
 *
 * Consolida funções duplicadas (sleep, logger) e adiciona
 * AbortController para fetch com timeout.
 */

import { RATE_LIMIT_MS } from './config';

// ─── Sleep ──────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Fetch com Timeout ──────────────────────────────

const DEFAULT_TIMEOUT_MS = 15_000; // 15s

/**
 * fetch() com timeout via AbortController.
 * Lança erro se a requisição exceder o timeout.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Logger Sanitizado ──────────────────────────────

const SENSITIVE_PATTERNS = [
  'apiKey', 'api_key', 'apikey',
  'authorization', 'x-api-key', 'x-goog-api-key',
  'token', 'secret', 'password',
];

/**
 * Logger estruturado que sanitiza campos sensíveis.
 * Nunca expõe API keys, tokens ou secrets em logs.
 */
export function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length > 100 && SENSITIVE_PATTERNS.some((p) => value.toLowerCase().includes(p))) {
      return '[REDACTED]';
    }
    return value;
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(sanitize);
    }
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_PATTERNS.some((p) => key.toLowerCase().includes(p))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitize(val);
      }
    }
    return sanitized;
  }
  return value;
}

export interface Logger {
  debug: (msg: string, data?: unknown) => void;
  info: (msg: string, data?: unknown) => void;
  warn: (msg: string, data?: unknown) => void;
  error: (msg: string, data?: unknown) => void;
}

export function createLogger(context: string): Logger {
  const log = (level: string, msg: string, data?: unknown) => {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: msg,
    };
    if (data !== undefined) {
      entry.data = sanitize(data);
    }
    const line = JSON.stringify(entry);

    if (level === 'ERROR' || level === 'FATAL') {
      console.error(line);
    } else if (level === 'WARN') {
      console.warn(line);
    } else if (level === 'DEBUG') {
      console.debug(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (msg: string, data?: unknown) => log('DEBUG', msg, data),
    info: (msg: string, data?: unknown) => log('INFO', msg, data),
    warn: (msg: string, data?: unknown) => log('WARN', msg, data),
    error: (msg: string, data?: unknown) => log('ERROR', msg, data),
  };
}

// ─── Rate Limiter ───────────────────────────────────

let lastRequestTime = 0;

/**
 * Garante que chamadas não excedam o rate limit configurado.
 */
export async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed);
  }
  lastRequestTime = Date.now();
}
