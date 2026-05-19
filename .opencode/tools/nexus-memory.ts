import { tool } from "@opencode-ai/plugin/tool";
import * as fs from "node:fs";
import * as path from "node:path";
import { createDb, type SqliteDb } from "./sqlite-adapter";

/**
 * Nexus Memory Tool v3 — SQLite + FTS5
 *
 * Persistência de contexto entre sessões usando SQLite com busca full-text.
 * Substitui o antigo armazenamento JSON com migração automática.
 * Handoffs continuam como JSON em .opencode/memory/handoffs/.
 */

const MEMORY_DIR = ".opencode/memory";
const DB_FILE = "nexus-memory.db";
const HANDOFF_DIR = ".opencode/memory/handoffs";

// ============================================================
// Database
// ============================================================

let db: SqliteDb | null = null;
let dbPath: string = "";

/**
 * Safe JSON parse — handles both string and already-parsed values.
 */
function tryParseJson(input: any): any {
  if (typeof input === "string") {
    try { return JSON.parse(input); } catch { return input; }
  }
  return input; // already an object
}

function getDb(baseDir: string): SqliteDb {
  if (db) return db;

  const memDir = path.join(baseDir, MEMORY_DIR);
  if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });

  dbPath = path.join(memDir, DB_FILE);
  db = createDb(dbPath);
  initSchema(db as any);
  migrateJsonToSqlite(db as any, memDir);
  return db;
}

function initSchema(database: any): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      key TEXT,
      scope TEXT NOT NULL DEFAULT 'session',
      value TEXT NOT NULL,
      agent TEXT,
      sessionID TEXT,
      savedAt TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (key, scope)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      key, scope, value, agent,
      content='memories',
      content_rowid='rowid',
      tokenize='porter unicode61'
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, key, scope, value, agent)
      VALUES (new.rowid, new.key, new.scope, new.value, new.agent);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, key, scope, value, agent)
      VALUES ('delete', old.rowid, old.key, old.scope, old.value, old.agent);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, key, scope, value, agent)
      VALUES ('delete', old.rowid, old.key, old.scope, old.value, old.agent);
      INSERT INTO memories_fts(rowid, key, scope, value, agent)
      VALUES (new.rowid, new.key, new.scope, new.value, new.agent);
    END;
  `);
}

function migrateJsonToSqlite(database: any, memDir: string): void {
  // Check if migration already done
  const count = database.prepare("SELECT COUNT(*) as c FROM memories").get() as { c: number };
  if (count.c > 0) return;

  const files = fs.readdirSync(memDir).filter(
    (f) => f.endsWith(".json") && !f.startsWith("."),
  );

  if (files.length === 0) return;

  const insert = database.prepare(
    "INSERT OR IGNORE INTO memories (key, scope, value, agent, sessionID, savedAt) VALUES (?, ?, ?, ?, ?, ?)",
  );

  const tx = database.transaction(() => {
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(memDir, file), "utf-8"));
        insert.run(
          content.key || file.replace(".json", ""),
          content.scope || "session",
          JSON.stringify(content.value || content),
          content.agent || null,
          content.sessionID || null,
          content.savedAt || new Date().toISOString(),
        );
      } catch {
        // Skip invalid files
      }
    }
  });

  tx();

  // Move migrated JSON files to backup
  const backupDir = path.join(memDir, ".migrated");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  for (const file of files) {
    try {
      fs.renameSync(
        path.join(memDir, file),
        path.join(backupDir, file),
      );
    } catch {
      // Skip locked files
    }
  }
}

// ============================================================
// Handoff helpers (kept as JSON)
// ============================================================

function ensureHandoffDir(baseDir: string): string {
  const dir = path.join(baseDir, HANDOFF_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ============================================================
// Tool
// ============================================================

export default tool({
  description:
    "Persiste e recupera contexto entre sessões do harness Nexus. SQLite com FTS5. Ações: save, load, list, delete, search.",
  args: {
    action: tool.schema
      .enum(["save", "load", "list", "delete", "search"])
      .describe("Ação: save, load, list, delete, search"),
    key: tool.schema
      .string()
      .optional()
      .describe("Chave única (obrigatório para save/load/delete)"),
    value: tool.schema
      .string()
      .optional()
      .describe("Valor JSON (obrigatório para save)"),
    scope: tool.schema
      .string()
      .default("session")
      .describe("Escopo: session, project, agent, observations"),
    query: tool.schema
      .string()
      .optional()
      .describe("Termo de busca FTS5 (obrigatório para search)"),
    limit: tool.schema
      .number()
      .default(10)
      .describe("Limite de resultados (search e list)"),
  },
  async execute(args, context) {
    const { action, key, value, scope, query, limit } = args;
    const database = getDb(context.worktree);

    switch (action) {
      // ============================================================
      // SAVE
      // ============================================================
      case "save": {
        if (!key) throw new Error("key é obrigatório");
        if (!value) throw new Error("value é obrigatório");

        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        const now = new Date().toISOString();

        database
          .prepare(
            `INSERT OR REPLACE INTO memories (key, scope, value, agent, sessionID, savedAt)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(key, scope, JSON.stringify(parsed), context.agent ?? null, context.sessionID ?? null, now);

        return JSON.stringify({ status: "saved", key, scope });
      }

      // ============================================================
      // LOAD
      // ============================================================
      case "load": {
        if (!key) throw new Error("key é obrigatório");

        const row = database
          .prepare("SELECT * FROM memories WHERE key = ? AND scope = ?")
          .get(key, scope) as any;

        if (!row) {
          return JSON.stringify({
            status: "not_found",
            key,
            scope,
            message: "Nenhum dado encontrado para esta chave/escopo",
          });
        }

        return JSON.stringify({
          status: "loaded",
          key,
          scope,
          data: {
            key: row.key,
            scope: row.scope,
            value: tryParseJson(row.value),
            savedAt: row.savedAt,
            agent: row.agent,
            sessionID: row.sessionID,
          },
        });
      }

      // ============================================================
      // SEARCH (FTS5)
      // ============================================================
      case "search": {
        if (!query) throw new Error("query é obrigatório");

        // Sanitize FTS5 query: escape special chars, add wildcard
        const sanitized = query
          .replace(/['"]/g, "")
          .split(/\s+/)
          .map((w) => `"${w}"*`)
          .join(" AND ");

        const rows = database
          .prepare(
            `SELECT m.key, m.scope, m.value, m.agent, m.savedAt,
                    rank as score
             FROM memories_fts f
             JOIN memories m ON m.rowid = f.rowid
             WHERE memories_fts MATCH ?
             ORDER BY rank
             LIMIT ?`,
          )
          .all(sanitized, limit ?? 10) as any[];

        return JSON.stringify({
          status: "searched",
          query,
          count: rows.length,
          results: rows.map((r: any) => ({
            key: r.key,
            scope: r.scope,
            savedAt: r.savedAt,
            agent: r.agent,
            score: r.score,
            summary: JSON.stringify(tryParseJson(r.value)).slice(0, 200),
          })),
        });
      }

      // ============================================================
      // LIST
      // ============================================================
      case "list": {
        const rows = database
          .prepare(
            `SELECT key, scope, agent, savedAt FROM memories
             ORDER BY savedAt DESC LIMIT ?`,
          )
          .all(limit ?? 10) as any[];

        return JSON.stringify({
          status: "listed",
          count: rows.length,
          entries: rows.map((r: any) => ({
            key: r.key,
            scope: r.scope,
            savedAt: r.savedAt,
            agent: r.agent,
          })),
        });
      }

      // ============================================================
      // DELETE
      // ============================================================
      case "delete": {
        if (!key) throw new Error("key é obrigatório");

        const result = database
          .prepare("DELETE FROM memories WHERE key = ? AND scope = ?")
          .run(key, scope);

        return JSON.stringify({
          status: result.changes > 0 ? "deleted" : "not_found",
          key,
          scope,
        });
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  },
});
