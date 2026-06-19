/**
 * Cache Manager — Cache Híbrido para DeepSeek-V4 Flash
 *
 * Sistema de cache otimizado para respostas do deepseek-v4-flash,
 * combinando cache em memória com persistência em disco.
 *
 * Funcionalidades:
 * - Cache de código gerado (TTL: 1h padrão)
 * - Cache de respostas para tarefas similares (TTL: 30min padrão)
 * - Invalidação inteligente via file hash
 * - Estatísticas de hit/miss rate e economia de tokens
 * - Persistência em .opencode/cache/
 * - Thread-safe via file locks
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

// ============================================================
// Types
// ============================================================

/** Tipos de conteúdo cacheado */
export type CacheType = "code" | "response" | "context" | "other";

/** Entrada individual do cache */
export interface CacheEntry {
  /** Chave única do cache */
  key: string;
  /** Valor armazenado */
  value: string;
  /** Tipo do conteúdo */
  type: CacheType;
  /** Timestamp de criação */
  createdAt: number;
  /** Timestamp da última atualização */
  updatedAt: number;
  /** Timestamp de expiração (0 = sem expiração) */
  expiresAt: number;
  /** Tamanho do valor em caracteres */
  size: number;
  /** Hash do valor para verificação de integridade */
  hash: string;
  /** Número de vezes acessado */
  accessCount: number;
  /** Timestamp do último acesso */
  lastAccessedAt: number;
}

/** Configuração do cache */
export interface CacheConfig {
  /** TTL padrão para código gerado (ms) */
  codeTtlMs: number;
  /** TTL padrão para respostas (ms) */
  responseTtlMs: number;
  /** TTL padrão para contexto (ms) */
  contextTtlMs: number;
  /** TTL padrão para outros (ms) */
  otherTtlMs: number;
  /** Limite máximo de entradas no cache (0 = ilimitado) */
  maxEntries: number;
  /** Limite máximo de tamanho total em bytes (0 = ilimitado) */
  maxSizeBytes: number;
  /** Habilitar persistência em disco */
  enablePersistence: boolean;
  /** Intervalo de auto-save em disco (ms) */
  autoSaveIntervalMs: number;
}

/** Estatísticas do cache */
export interface CacheStats {
  /** Total de hits */
  hits: number;
  /** Total de misses */
  misses: number;
  /** Taxa de hits (0-1) */
  hitRate: number;
  /** Total de entradas no cache */
  totalEntries: number;
  /** Tamanho total em bytes */
  totalSizeBytes: number;
  /** Economia estimada de tokens */
  estimatedTokensSaved: number;
  /** Entradas por tipo */
  entriesByType: Record<CacheType, number>;
}

/** Documento serializado para disco */
interface CacheDocument {
  version: number;
  entries: Record<string, CacheEntry>;
  stats: {
    hits: number;
    misses: number;
    estimatedTokensSaved: number;
  };
  lastSavedAt: string;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_CONFIG: CacheConfig = {
  codeTtlMs: 60 * 60 * 1000,       // 1 hora
  responseTtlMs: 30 * 60 * 1000,    // 30 minutos
  contextTtlMs: 60 * 60 * 1000,     // 1 hora
  otherTtlMs: 30 * 60 * 1000,       // 30 minutos
  maxEntries: 1000,
  maxSizeBytes: 50 * 1024 * 1024,   // 50MB
  enablePersistence: true,
  autoSaveIntervalMs: 5 * 60 * 1000, // 5 minutos
};

const CACHE_VERSION = 1;

// ============================================================
// Helpers
// ============================================================

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function computeHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getTtlForType(type: CacheType, config: CacheConfig): number {
  switch (type) {
    case "code": return config.codeTtlMs;
    case "response": return config.responseTtlMs;
    case "context": return config.contextTtlMs;
    case "other": return config.otherTtlMs;
  }
}

// ============================================================
// Lock (simplificado — file-based)
// ============================================================

class FileLock {
  private lockDir: string;

  constructor(worktree: string) {
    this.lockDir = path.join(worktree, ".opencode/cache/.locks");
    ensureDir(this.lockDir);
  }

  async acquire(name: string, timeoutMs: number = 5000): Promise<boolean> {
    const lockFile = path.join(this.lockDir, `${name}.lock`);
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        fs.writeFileSync(lockFile, process.pid.toString(), { flag: "wx" });
        return true;
      } catch {
        // Lock já existe — espera
        await new Promise((r) => setTimeout(r, 10));
      }
    }
    return false;
  }

  release(name: string): void {
    const lockFile = path.join(this.lockDir, `${name}.lock`);
    try {
      fs.unlinkSync(lockFile);
    } catch {
      // Ignora se não existe
    }
  }
}

// ============================================================
// Cache Manager
// ============================================================

export class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private worktree: string;
  private cacheDir: string;
  private lock: FileLock;
  private stats = {
    hits: 0,
    misses: 0,
    estimatedTokensSaved: 0,
  };
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;

  constructor(worktree: string, config: Partial<CacheConfig> = {}) {
    this.worktree = worktree;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cacheDir = path.join(worktree, ".opencode/cache");
    this.lock = new FileLock(worktree);

    if (this.config.enablePersistence) {
      ensureDir(this.cacheDir);
      this.load();
      this.startAutoSave();
    }
  }

  // ============================================================
  // Core API
  // ============================================================

  /**
   * Recupera uma entrada do cache
   * @param key - Chave da entrada
   * @returns CacheEntry ou null se não encontrada ou expirada
   */
  async get(key: string): Promise<CacheEntry | null> {
    const normalizedKey = normalizeKey(key);
    const entry = this.cache.get(normalizedKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Verifica expiração
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.cache.delete(normalizedKey);
      this.stats.misses++;
      this.dirty = true;
      return null;
    }

    // Atualiza metadados de acesso
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    this.stats.hits++;
    this.stats.estimatedTokensSaved += Math.ceil(entry.value.length / 4);
    this.dirty = true;

    return entry;
  }

  /**
   * Armazena uma entrada no cache
   * @param key - Chave única
   * @param value - Valor a armazenar
   * @param type - Tipo do conteúdo
   * @param ttlMs - TTL customizado (opcional, usa padrão do tipo se omitido)
   */
  async set(key: string, value: string, type: CacheType, ttlMs?: number): Promise<void> {
    const normalizedKey = normalizeKey(key);
    const ttl = ttlMs ?? getTtlForType(type, this.config);
    const now = Date.now();

    const entry: CacheEntry = {
      key: normalizedKey,
      value,
      type,
      createdAt: now,
      updatedAt: now,
      expiresAt: ttl > 0 ? now + ttl : 0,
      size: value.length,
      hash: computeHash(value),
      accessCount: 0,
      lastAccessedAt: now,
    };

    // Verifica limites antes de inserir
    this.enforceLimits(entry);

    this.cache.set(normalizedKey, entry);
    this.dirty = true;
  }

  /**
   * Remove uma entrada específica do cache
   * @param key - Chave a remover
   */
  async invalidate(key: string): Promise<void> {
    const normalizedKey = normalizeKey(key);
    this.cache.delete(normalizedKey);
    this.dirty = true;
  }

  /**
   * Limpa todo o cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, estimatedTokensSaved: 0 };
    this.dirty = true;
  }

  /**
   * Busca ou cria uma entrada no cache
   * Se a entrada não existir ou estiver expirada, executa a factory e armazena o resultado
   * @param key - Chave da entrada
   * @param factory - Função que gera o valor se não estiver em cache
   * @param type - Tipo do conteúdo
   * @returns Valor cacheado ou recém-gerado
   */
  async getOrCreate(key: string, factory: () => string | Promise<string>, type: CacheType): Promise<string> {
    const existing = await this.get(key);
    if (existing) {
      return existing.value;
    }

    const value = await factory();
    await this.set(key, value, type);
    return value;
  }

  // ============================================================
  // Stats
  // ============================================================

  /**
   * Retorna estatísticas completas do cache
   */
  getStats(): CacheStats {
    const entriesByType: Record<CacheType, number> = { code: 0, response: 0, context: 0, other: 0 };
    let totalSizeBytes = 0;

    for (const entry of this.cache.values()) {
      entriesByType[entry.type]++;
      totalSizeBytes += entry.size;
    }

    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      totalEntries: this.cache.size,
      totalSizeBytes,
      estimatedTokensSaved: this.stats.estimatedTokensSaved,
      entriesByType,
    };
  }

  // ============================================================
  // Persistence
  // ============================================================

  /**
   * Salva o cache em disco (.opencode/cache/entries.json)
   */
  async save(): Promise<void> {
    if (!this.config.enablePersistence || !this.dirty) return;

    const acquired = await this.lock.acquire("save", 3000);
    if (!acquired) return;

    try {
      const doc: CacheDocument = {
        version: CACHE_VERSION,
        entries: Object.fromEntries(this.cache),
        stats: this.stats,
        lastSavedAt: new Date().toISOString(),
      };

      const filePath = path.join(this.cacheDir, "entries.json");
      fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), "utf-8");
      this.dirty = false;
    } finally {
      this.lock.release("save");
    }
  }

  /**
   * Carrega o cache do disco
   */
  async load(): Promise<void> {
    if (!this.config.enablePersistence) return;

    const filePath = path.join(this.cacheDir, "entries.json");
    if (!fs.existsSync(filePath)) return;

    const acquired = await this.lock.acquire("load", 3000);
    if (!acquired) return;

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const doc: CacheDocument = JSON.parse(raw);

      if (doc.version !== CACHE_VERSION) {
        // Versão incompatível — descarta
        return;
      }

      this.cache.clear();
      const now = Date.now();

      for (const [key, entry] of Object.entries(doc.entries)) {
        // Não carrega entradas expiradas
        if (entry.expiresAt > 0 && now > entry.expiresAt) continue;
        this.cache.set(key, entry);
      }

      this.stats = doc.stats;
    } finally {
      this.lock.release("load");
    }
  }

  /**
   * Força salvamento e para o auto-save
   */
  async destroy(): Promise<void> {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    await this.save();
  }

  // ============================================================
  // Smart Invalidation
  // ============================================================

  /**
   * Invalida entradas baseadas em mudanças detectadas no código-base
   * @param filePath - Caminho do arquivo que mudou
   * @param fileHash - Hash atual do arquivo
   */
  async invalidateByFileChange(filePath: string, fileHash: string): Promise<number> {
    let invalidated = 0;

    for (const [key, entry] of this.cache) {
      // Invalida entradas de código que referenciam o arquivo
      if (entry.type === "code") {
        if (entry.value.includes(filePath) || entry.hash === fileHash) {
          this.cache.delete(key);
          invalidated++;
        }
      }
    }

    this.dirty = true;
    return invalidated;
  }

  /**
   * Remove entradas expiradas do cache
   * @returns Número de entradas removidas
   */
  async prune(): Promise<number> {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt > 0 && now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }

    this.dirty = true;
    return pruned;
  }

  /**
   * Retorna entradas ordenadas por lastAccessedAt (mais antigas primeiro)
   * Útil para debug e LRU eviction
   */
  getOldestEntries(count: number): CacheEntry[] {
    return Array.from(this.cache.values())
      .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
      .slice(0, count);
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private enforceLimits(newEntry: CacheEntry): void {
    // Limite de entradas
    if (this.config.maxEntries > 0 && this.cache.size >= this.config.maxEntries) {
      this.evictOldest(1);
    }

    // Limite de tamanho
    if (this.config.maxSizeBytes > 0) {
      let totalSize = newEntry.size;
      for (const entry of this.cache.values()) {
        totalSize += entry.size;
      }

      while (totalSize > this.config.maxSizeBytes && this.cache.size > 0) {
        const evicted = this.evictOldest(1);
        totalSize -= evicted;
      }
    }
  }

  private evictOldest(count: number): number {
    const entries = this.getOldestEntries(count);
    let freed = 0;

    for (const entry of entries) {
      this.cache.delete(entry.key);
      freed += entry.size;
    }

    this.dirty = true;
    return freed;
  }

  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      this.save().catch(() => {
        // Falha silenciosa no auto-save
      });
    }, this.config.autoSaveIntervalMs);
  }
}
