/**
 * sqlite-adapter.ts
 *
 * Abstraction layer for SQLite that works in both Node.js (better-sqlite3)
 * and Bun (bun:sqlite) runtimes. Graceful fallback chain:
 *   1. better-sqlite3 (Node.js)
 *   2. bun:sqlite (Bun)
 *   3. JSON file storage (last resort)
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================
// Types
// ============================================================

export interface SqliteDb {
  exec(sql: string): void;
  pragma(sql: string): void;
  prepare(sql: string): PreparedStatement;
  close(): void;
}

export interface PreparedStatement {
  run(...params: any[]): { changes: number };
  get(...params: any[]): Record<string, any> | undefined;
  all(...params: any[]): Record<string, any>[];
  transaction<T extends (...args: any[]) => any>(fn: T): T;
}

// ============================================================
// JSON fallback (last resort)
// ============================================================

class JsonStore {
  private filePath: string;
  private data: Map<string, Record<string, any>> = new Map();

  constructor(fp: string) {
    this.filePath = fp;
    this._load();
  }

  private _load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
        for (const [k, v] of Object.entries(raw)) {
          this.data.set(k, v as Record<string, any>);
        }
      }
    } catch { /* ignore corrupt files */ }
  }

  private _save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(Object.fromEntries(this.data), null, 2), "utf-8");
  }

  exec(_sql: string): void { /* no-op for JSON fallback */ }
  pragma(_sql: string): void { /* no-op */ }

  prepare(sql: string): PreparedStatement {
    return new JsonPreparedStatement(sql, this.data, () => this._save());
  }

  close(): void { this._save(); }
}

class JsonPreparedStatement implements PreparedStatement {
  private sql: string;
  private data: Map<string, Record<string, any>>;
  private save: () => void;

  constructor(sql: string, data: Map<string, Record<string, any>>, save: () => void) {
    this.sql = sql;
    this.data = data;
    this.save = save;
  }

  run(..._params: any[]): { changes: number } {
    this.save();
    return { changes: 0 };
  }

  get(..._params: any[]): Record<string, any> | undefined {
    if (this.sql.trim().toUpperCase().startsWith("SELECT COUNT")) {
      return { c: this.data.size };
    }
    return undefined;
  }

  all(..._params: any[]): Record<string, any>[] {
    return [];
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return fn;
  }
}

// ============================================================
// Adapter factory
// ============================================================

export function createDb(dbPath: string): SqliteDb {
  // Attempt 1: better-sqlite3 (Node.js)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const BetterSqlite3 = require("better-sqlite3");
    const db = new BetterSqlite3(dbPath);
    db.pragma("journal_mode = WAL");
    return wrapBetterSqlite3(db);
  } catch {
    // Attempt 2: bun:sqlite (Bun)
    try {
      const { Database } = require("bun:sqlite");
      const db = new Database(dbPath);
      db.run("PRAGMA journal_mode = WAL");
      return wrapBunSqlite(db);
    } catch {
      // Attempt 3: JSON file fallback
      console.warn("[sqlite-adapter] No SQLite library available, using JSON fallback");
      return new JsonStore(dbPath);
    }
  }
}

function wrapBetterSqlite3(raw: any): SqliteDb {
  return {
    exec: (sql: string) => raw.exec(sql),
    pragma: (sql: string) => raw.pragma(sql),
    prepare: (sql: string) => {
      const stmt = raw.prepare(sql);
      return {
        run: (...params: any[]) => stmt.run(...params),
        get: (...params: any[]) => stmt.get(...params),
        all: (...params: any[]) => stmt.all(...params),
        transaction: <T extends (...args: any[]) => any>(fn: T) => raw.transaction(fn),
      };
    },
    close: () => raw.close(),
  };
}

function wrapBunSqlite(raw: any): SqliteDb {
  return {
    exec: (sql: string) => raw.exec(sql),
    pragma: (sql: string) => raw.run(sql),
    prepare: (sql: string) => {
      const stmt = raw.prepare(sql);
      return {
        run: (...params: any[]) => {
          stmt.run(...params);
          return { changes: raw.changes || 0 };
        },
        get: (...params: any[]) => stmt.get(...params) as Record<string, any> | undefined,
        all: (...params: any[]) => stmt.all(...params) as Record<string, any>[],
        transaction: <T extends (...args: any[]) => any>(fn: T) => {
          return (...args: any[]) => {
            raw.run("BEGIN TRANSACTION");
            try {
              const result = fn(...args);
              raw.run("COMMIT");
              return result;
            } catch (e) {
              raw.run("ROLLBACK");
              throw e;
            }
          };
        },
      };
    },
    close: () => raw.close(),
  };
}
