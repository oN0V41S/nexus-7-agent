/**
 * Nexus Memory MCP Server
 *
 * Expõe o nexus-memory como servidor MCP (Model Context Protocol)
 * para que qualquer ferramenta MCP no ecossistema OpenCode consuma.
 *
 * Protocolo: stdio (JSON-RPC sobre stdin/stdout)
 * Schema: https://spec.modelcontextprotocol.io/
 *
 * Ferramentas expostas:
 * - nexus_memory_save    → Salva dado na memória
 * - nexus_memory_load    → Carrega dado da memória
 * - nexus_memory_search  → Busca textual com FTS5
 * - nexus_memory_list    → Lista entradas recentes
 * - nexus_memory_delete  → Remove entrada
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createDb, type SqliteDb } from "../tools/sqlite-adapter";

// ============================================================
// Config
// ============================================================

const MEMORY_DIR = ".opencode/memory";
const DB_FILE = "nexus-memory.db";

function resolveBaseDir(): string {
  // Try common locations
  const candidates = [
    process.cwd(),
    process.env.PROJECT_ROOT || "",
    process.env.HOME ? path.join(process.env.HOME, "project") : "",
  ].filter(Boolean);

  for (const dir of candidates) {
    const p = path.join(dir, MEMORY_DIR, DB_FILE);
    if (fs.existsSync(p)) return dir;
  }

  // Fallback to cwd — db will be created here
  return process.cwd();
}

// ============================================================
// Database
// ============================================================

let db: SqliteDb | null = null;

function getDb(): SqliteDb {
  if (db) return db;

  const baseDir = resolveBaseDir();
  const memDir = path.join(baseDir, MEMORY_DIR);
  if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });

  const dbPath = path.join(memDir, DB_FILE);
  db = createDb(dbPath);

  db.exec(`
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
      content='memories', content_rowid='rowid',
      tokenize='porter unicode61'
    );
  `);

  return db;
}

// ============================================================
// MCP Protocol (JSON-RPC over stdio)
// ============================================================

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string };
}

function sendResponse(msg: JsonRpcResponse): void {
  const raw = JSON.stringify(msg) + "\n";
  process.stdout.write(raw);
}

function sendError(id: string | number | null, code: number, message: string): void {
  sendResponse({ jsonrpc: "2.0", id, error: { code, message } });
}

// ============================================================
// Tool Handlers
// ============================================================

const handlers: Record<string, (params: any) => any> = {
  nexus_memory_save: (params) => {
    const { key, value, scope = "session" } = params;
    if (!key) throw new Error("key is required");
    if (!value) throw new Error("value is required");

    const database = getDb();
    const parsed = typeof value === "string" ? JSON.parse(value) : value;

    database
      .prepare(
        `INSERT OR REPLACE INTO memories (key, scope, value, agent, sessionID, savedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(key, scope, JSON.stringify(parsed), "mcp-server", null, new Date().toISOString());

    return { status: "saved", key, scope };
  },

  nexus_memory_load: (params) => {
    const { key, scope = "session" } = params;
    if (!key) throw new Error("key is required");

    const database = getDb();
    const row = database.prepare("SELECT * FROM memories WHERE key = ? AND scope = ?").get(key, scope);

    if (!row) return { status: "not_found", key, scope };
    return { status: "loaded", key, scope, data: row };
  },

  nexus_memory_search: (params) => {
    const { query, limit = 10 } = params;
    if (!query) throw new Error("query is required");

    const database = getDb();
    const sanitized = query
      .replace(/['"]/g, "")
      .split(/\s+/)
      .map((w: string) => `"${w}"*`)
      .join(" AND ");

    const rows = database
      .prepare(
        `SELECT m.key, m.scope, m.value, m.agent, m.savedAt, rank as score
         FROM memories_fts f JOIN memories m ON m.rowid = f.rowid
         WHERE memories_fts MATCH ? ORDER BY rank LIMIT ?`,
      )
      .all(sanitized, limit);

    return { status: "searched", query, count: rows.length, results: rows };
  },

  nexus_memory_list: (params) => {
    const { limit = 10 } = params;
    const database = getDb();
    const rows = database.prepare("SELECT key, scope, agent, savedAt FROM memories ORDER BY savedAt DESC LIMIT ?").all(limit);
    return { status: "listed", count: rows.length, entries: rows };
  },

  nexus_memory_delete: (params) => {
    const { key, scope = "session" } = params;
    if (!key) throw new Error("key is required");

    const database = getDb();
    const result = database.prepare("DELETE FROM memories WHERE key = ? AND scope = ?").run(key, scope);
    return { status: result.changes > 0 ? "deleted" : "not_found", key, scope };
  },
};

// ============================================================
// MCP Lifecycle
// ============================================================

// Handle incoming JSON-RPC requests
let initialized = false;

process.stdin.on("data", (chunk: Buffer) => {
  const lines = chunk.toString().split("\n").filter(Boolean);

  for (const line of lines) {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line);
    } catch {
      continue;
    }

    // --- initialize ---
    if (request.method === "initialize") {
      initialized = true;
      sendResponse({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "nexus-memory-server", version: "1.0.0" },
          capabilities: {
            tools: {
              nexus_memory_save: {
                description: "Save data to Nexus memory store",
                inputSchema: {
                  type: "object",
                  properties: {
                    key: { type: "string", description: "Unique key" },
                    value: { type: "string", description: "JSON value" },
                    scope: { type: "string", enum: ["session", "project", "agent", "observations"], default: "session" },
                  },
                  required: ["key", "value"],
                },
              },
              nexus_memory_load: {
                description: "Load data from Nexus memory store",
                inputSchema: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    scope: { type: "string", default: "session" },
                  },
                  required: ["key"],
                },
              },
              nexus_memory_search: {
                description: "Full-text search across Nexus memory (FTS5)",
                inputSchema: {
                  type: "object",
                  properties: {
                    query: { type: "string", description: "Search term" },
                    limit: { type: "number", default: 10 },
                  },
                  required: ["query"],
                },
              },
              nexus_memory_list: {
                description: "List recent memory entries",
                inputSchema: {
                  type: "object",
                  properties: {
                    limit: { type: "number", default: 10 },
                  },
                },
              },
              nexus_memory_delete: {
                description: "Delete a memory entry",
                inputSchema: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    scope: { type: "string", default: "session" },
                  },
                  required: ["key"],
                },
              },
            },
          },
        },
      });
      continue;
    }

    // --- tools/list ---
    if (request.method === "tools/list") {
      sendResponse({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: Object.keys(handlers).map((name) => ({
            name,
            description: handlers[name].toString().slice(0, 100),
          })),
        },
      });
      continue;
    }

    // --- tools/call ---
    if (request.method === "tools/call") {
      const { name, arguments: args } = request.params || {};
      const handler = handlers[name];
      if (!handler) {
        sendError(request.id, -32601, `Tool not found: ${name}`);
        continue;
      }

      try {
        const result = handler(args || {});
        sendResponse({
          jsonrpc: "2.0",
          id: request.id,
          result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
        });
      } catch (err: any) {
        sendError(request.id, -32603, err.message || "Internal error");
      }
      continue;
    }

    // --- notifications (no response) ---
    if (request.method === "notifications/initialized") continue;

    // --- unknown ---
    sendError(request.id, -32601, `Method not found: ${request.method}`);
  }
});

process.stdin.on("end", () => {
  if (db) db.close();
  process.exit(0);
});

// Signal ready
sendResponse({
  jsonrpc: "2.0",
  id: null,
  result: { server: "nexus-memory-server", status: "running" },
});
