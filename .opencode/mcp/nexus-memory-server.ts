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
import { getMongoAdapter, type MongoAdapter } from "../tools/mongodb-adapter";

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

  return db;
}

// ============================================================
// Tool Definitions (shared between initialize and tools/list)
// ============================================================

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "nexus_memory_save",
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
  {
    name: "nexus_memory_load",
    description: "Load data from Nexus memory store",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Unique key to load" },
        scope: { type: "string", default: "session" },
      },
      required: ["key"],
    },
  },
  {
    name: "nexus_memory_search",
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
  {
    name: "nexus_memory_list",
    description: "List recent memory entries",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 10, description: "Max entries to return" },
      },
    },
  },
  {
    name: "nexus_memory_delete",
    description: "Delete a memory entry",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key to delete" },
        scope: { type: "string", default: "session" },
      },
      required: ["key"],
    },
  },
];

// ============================================================
// Handoff Tool Definitions
// ============================================================

const HANDOFF_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "nexus_handoff_save",
    description: "Save a handoff document locally and optionally to MongoDB",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique handoff ID" },
        title: { type: "string", description: "Handoff title" },
        summary: { type: "string", description: "Summary of work done" },
        nextSteps: { type: "array", items: { type: "string" }, description: "Next steps" },
        artifacts: { type: "array", items: { type: "string" }, description: "Generated artifacts" },
        pending: { type: "string", description: "Pending decisions" },
        fromAgent: { type: "string", description: "Source agent" },
        fromSession: { type: "string", description: "Source session ID" },
        type: { type: "string", enum: ["manual", "auto"], default: "manual" },
      },
      required: ["id", "title", "summary"],
    },
  },
  {
    name: "nexus_handoff_load",
    description: "Load a handoff by ID (checks local first, then MongoDB)",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Handoff ID to load" },
      },
      required: ["id"],
    },
  },
  {
    name: "nexus_handoff_list",
    description: "List recent handoffs (merges local and remote)",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 10, description: "Max handoffs to return" },
        source: { type: "string", enum: ["local", "remote", "all"], default: "all" },
      },
    },
  },
];

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

  nexus_handoff_save: (params) => {
    const { id, title, summary, nextSteps = [], artifacts = [], pending = "None", fromAgent, fromSession, type = "manual" } = params;
    if (!id) throw new Error("id is required");
    if (!title) throw new Error("title is required");
    if (!summary) throw new Error("summary is required");

    const handoff = {
      id,
      title,
      summary,
      nextSteps,
      artifacts,
      pending,
      fromAgent: fromAgent || "unknown",
      fromSession: fromSession || null,
      type,
      createdAt: new Date().toISOString(),
    };

    // Save locally
    const localPath = path.join(process.cwd(), ".opencode/memory/handoffs", `${id}.json`);
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify(handoff, null, 2), "utf-8");

    // Save to MongoDB if configured
    let remote = false;
    if (mongoAdapter && mongoAdapter.isConnected()) {
      try {
        mongoAdapter.insertOne("handoffs", handoff);
        remote = true;
      } catch (err) {
        console.error("[MCP] MongoDB handoff save failed:", err);
      }
    }

    return { status: "saved", id, local: true, remote };
  },

  nexus_handoff_load: (params) => {
    const { id } = params;
    if (!id) throw new Error("id is required");

    // Try local first
    const localPath = path.join(process.cwd(), ".opencode/memory/handoffs", `${id}.json`);
    if (fs.existsSync(localPath)) {
      const content = JSON.parse(fs.readFileSync(localPath, "utf-8"));
      return { status: "loaded", handoff: content, source: "local" };
    }

    // Try MongoDB
    if (mongoAdapter && mongoAdapter.isConnected()) {
      try {
        const doc = mongoAdapter.findOne("handoffs", { id });
        if (doc) {
          return { status: "loaded", handoff: doc, source: "remote" };
        }
      } catch (err) {
        console.error("[MCP] MongoDB handoff load failed:", err);
      }
    }

    return { status: "not_found", id };
  },

  nexus_handoff_list: (params) => {
    const { limit = 10, source = "all" } = params;

    const handoffs: any[] = [];

    // Local handoffs
    if (source === "all" || source === "local") {
      const hfDir = path.join(process.cwd(), ".opencode/memory/handoffs");
      if (fs.existsSync(hfDir)) {
        const files = fs.readdirSync(hfDir).filter(f => f.endsWith(".json"));
        for (const file of files.slice(0, limit)) {
          try {
            const content = JSON.parse(fs.readFileSync(path.join(hfDir, file), "utf-8"));
            handoffs.push({ ...content, _source: "local" });
          } catch { /* skip */ }
        }
      }
    }

    // MongoDB handoffs
    if ((source === "all" || source === "remote") && mongoAdapter && mongoAdapter.isConnected()) {
      try {
        const remoteHandoffs = mongoAdapter.find("handoffs", {}, { limit, sort: { createdAt: -1 } });
        handoffs.push(...remoteHandoffs.map(h => ({ ...h, _source: "remote" })));
      } catch (err) {
        console.error("[MCP] MongoDB handoff list failed:", err);
      }
    }

    // Deduplicate by ID (local takes precedence)
    const seen = new Set<string>();
    const unique = handoffs.filter(h => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    });

    // Sort by createdAt descending
    unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      status: "listed",
      count: Math.min(unique.length, limit),
      entries: unique.slice(0, limit),
    };
  },
};

// ============================================================
// MongoDB (optional)
// ============================================================

let mongoAdapter: MongoAdapter | null = null;

async function initMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("[MCP] MONGODB_URI not set, running in local-only mode");
    return;
  }

  try {
    mongoAdapter = await getMongoAdapter();
    console.log("[MCP] Connected to MongoDB:", uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@"));
  } catch (err) {
    console.error("[MCP] MongoDB connection failed, falling back to local-only:", err);
    mongoAdapter = null;
  }
}

// Call during startup
initMongo().catch(console.error);

// ============================================================
// MCP Lifecycle
// ============================================================

// Handle incoming JSON-RPC requests
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
      sendResponse({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "nexus-memory-server", version: "1.0.0" },
          capabilities: {
            tools: {}, // Signal tool support; actual definitions in tools/list
          },
        },
      });
      continue;
    }

    // --- notifications/initialized ---
    if (request.method === "notifications/initialized") {
      // No response needed per JSON-RPC for notifications
      continue;
    }

    // --- tools/list ---
    if (request.method === "tools/list") {
      sendResponse({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: [...TOOL_DEFINITIONS, ...HANDOFF_TOOL_DEFINITIONS],
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

    // --- unknown ---
    sendError(request.id, -32601, `Method not found: ${request.method}`);
  }
});

process.stdin.on("end", () => {
  if (db) db.close();
  process.exit(0);
});
