/**
 * Tests for nexus-memory-server.ts — MCP JSON-RPC protocol
 *
 * Covers: initialize, tools/list, tools/call for all 5 tools,
 *         error handling, schema validation
 *
 * Since the MCP server reads from stdin and writes to stdout,
 * we test the handler functions and protocol logic directly.
 *
 * Pattern: AAA (Arrange, Act, Assert)
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { createDb, type SqliteDb } from "../../tools/sqlite-adapter";

// ============================================================
// Tool Definitions (mirrored from server for testing)
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
// Handler factory (mirrored from server)
// ============================================================

interface MongoAdapterMock {
  insertOne: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  isConnected: () => boolean;
}

function createHandlers(db: SqliteDb, mongoAdapter: MongoAdapterMock | null = null) {
  return {
    nexus_memory_save: (params: any) => {
      const { key, value, scope = "session" } = params;
      if (!key) throw new Error("key is required");
      if (!value) throw new Error("value is required");

      const parsed = typeof value === "string" ? JSON.parse(value) : value;

      db.prepare(
        `INSERT OR REPLACE INTO memories (key, scope, value, agent, sessionID, savedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(key, scope, JSON.stringify(parsed), "mcp-server", null, new Date().toISOString());

      return { status: "saved", key, scope };
    },

    nexus_memory_load: (params: any) => {
      const { key, scope = "session" } = params;
      if (!key) throw new Error("key is required");

      const row = db.prepare("SELECT * FROM memories WHERE key = ? AND scope = ?").get(key, scope);

      if (!row) return { status: "not_found", key, scope };
      return { status: "loaded", key, scope, data: row };
    },

    nexus_memory_search: (params: any) => {
      const { query, limit = 10 } = params;
      if (!query) throw new Error("query is required");

      const sanitized = query
        .replace(/['"]/g, "")
        .split(/\s+/)
        .map((w: string) => `"${w}"*`)
        .join(" AND ");

      const rows = db.prepare(
        `SELECT m.key, m.scope, m.value, m.agent, m.savedAt, rank as score
         FROM memories_fts f JOIN memories m ON m.rowid = f.rowid
         WHERE memories_fts MATCH ? ORDER BY rank LIMIT ?`,
      ).all(sanitized, limit);

      return { status: "searched", query, count: rows.length, results: rows };
    },

    nexus_memory_list: (params: any) => {
      const { limit = 10 } = params;
      const rows = db.prepare("SELECT key, scope, agent, savedAt FROM memories ORDER BY savedAt DESC LIMIT ?").all(limit);
      return { status: "listed", count: rows.length, entries: rows };
    },

    nexus_memory_delete: (params: any) => {
      const { key, scope = "session" } = params;
      if (!key) throw new Error("key is required");

      const result = db.prepare("DELETE FROM memories WHERE key = ? AND scope = ?").run(key, scope);
      return { status: result.changes > 0 ? "deleted" : "not_found", key, scope };
    },

    nexus_handoff_save: (params: any) => {
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

    nexus_handoff_load: (params: any) => {
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

    nexus_handoff_list: (params: any) => {
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
          handoffs.push(...remoteHandoffs.map((h: any) => ({ ...h, _source: "remote" })));
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
}

// ============================================================
// Schema validation helpers
// ============================================================

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string };
}

function createInitializeResponse(id: string | number): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "nexus-memory-server", version: "1.0.0" },
      capabilities: { tools: {} },
    },
  };
}

function createToolListResponse(id: string | number): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: { tools: [...TOOL_DEFINITIONS, ...HANDOFF_TOOL_DEFINITIONS] },
  };
}

function createToolCallResponse(id: string | number, result: any): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
  };
}

function createErrorResponse(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

let tmpDir: string;
let dbPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-mcp-test-"));
  dbPath = path.join(tmpDir, "nexus-memory.db");
  // Clean up handoff files to ensure test isolation
  const hfDir = path.join(process.cwd(), ".opencode/memory/handoffs");
  if (fs.existsSync(hfDir)) {
    const files = fs.readdirSync(hfDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      fs.unlinkSync(path.join(hfDir, file));
    }
  }
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

function setupTestDb(): SqliteDb {
  const db = createDb(dbPath);

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
// Test 1: JSON-RPC Initialize
// ============================================================
describe("MCP Initialize", () => {
  it("should return valid initialize response with protocol version", () => {
    // Arrange
    const requestId = 1;

    // Act
    const response = createInitializeResponse(requestId);

    // Assert
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(requestId);
    expect(response.result).toBeDefined();
    expect(response.result.protocolVersion).toBe("2024-11-05");
    expect(response.result.serverInfo.name).toBe("nexus-memory-server");
    expect(response.result.serverInfo.version).toBe("1.0.0");
    expect(response.result.capabilities).toHaveProperty("tools");
  });
});

// ============================================================
// Test 2: Tools/List
// ============================================================
describe("MCP tools/list", () => {
  it("should return 5 tool definitions", () => {
    // Arrange & Act
    const response = createToolListResponse("req-1");

    // Assert
    expect(response.result.tools).toHaveLength(8) // 5 memory + 3 handoff;
  });

  it("should have nexus_memory_save with required key and value", () => {
    const response = createToolListResponse(1);
    const saveTool = response.result.tools.find((t: ToolDefinition) => t.name === "nexus_memory_save");
    expect(saveTool).toBeDefined();
    expect(saveTool.inputSchema.required).toContain("key");
    expect(saveTool.inputSchema.required).toContain("value");
  });

  it("should have nexus_memory_load with required key", () => {
    const response = createToolListResponse(1);
    const loadTool = response.result.tools.find((t: ToolDefinition) => t.name === "nexus_memory_load");
    expect(loadTool).toBeDefined();
    expect(loadTool.inputSchema.required).toContain("key");
  });

  it("should have nexus_memory_search with required query", () => {
    const response = createToolListResponse(1);
    const searchTool = response.result.tools.find((t: ToolDefinition) => t.name === "nexus_memory_search");
    expect(searchTool).toBeDefined();
    expect(searchTool.inputSchema.required).toContain("query");
  });

  it("should have nexus_memory_delete with required key", () => {
    const response = createToolListResponse(1);
    const deleteTool = response.result.tools.find((t: ToolDefinition) => t.name === "nexus_memory_delete");
    expect(deleteTool).toBeDefined();
    expect(deleteTool.inputSchema.required).toContain("key");
  });

  it("should have nexus_memory_list without required fields", () => {
    const response = createToolListResponse(1);
    const listTool = response.result.tools.find((t: ToolDefinition) => t.name === "nexus_memory_list");
    expect(listTool).toBeDefined();
    expect(listTool.inputSchema.required).toBeUndefined();
  });
});

// ============================================================
// Test 3: Handler - nexus_memory_save
// ============================================================
describe("handler - nexus_memory_save", () => {
  it("should save a memory entry and return saved status", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Act
    const result = handlers.nexus_memory_save({
      key: "test-key",
      value: JSON.stringify({ data: "hello" }),
      scope: "session",
    });

    // Assert
    expect(result.status).toBe("saved");
    expect(result.key).toBe("test-key");
    expect(result.scope).toBe("session");
  });

  it("should accept already-parsed objects as value", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Act — value as object, not string
    const result = handlers.nexus_memory_save({
      key: "obj-key",
      value: { nested: { a: 1 } },
      scope: "project",
    });

    // Assert
    expect(result.status).toBe("saved");
  });

  it("should reject save without key", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Act & Assert
    expect(() =>
      handlers.nexus_memory_save({
        value: JSON.stringify({ x: 1 }),
        scope: "session",
      }),
    ).toThrow("key is required");
  });

  it("should reject save without value", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Act & Assert
    expect(() =>
      handlers.nexus_memory_save({
        key: "no-value",
        scope: "session",
      }),
    ).toThrow("value is required");
  });

  it("should default scope to session", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Act — no scope provided
    const result = handlers.nexus_memory_save({
      key: "default-scope",
      value: JSON.stringify({}),
    });

    // Assert
    expect(result.scope).toBe("session");
  });
});

// ============================================================
// Test 4: Handler - nexus_memory_load
// ============================================================
describe("handler - nexus_memory_load", () => {
  it("should load a saved memory entry", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Save first
    handlers.nexus_memory_save({
      key: "load-key",
      value: JSON.stringify({ message: "stored data" }),
      scope: "session",
    });

    // Act
    const result = handlers.nexus_memory_load({ key: "load-key", scope: "session" });

    // Assert
    expect(result.status).toBe("loaded");
    expect(result.key).toBe("load-key");
    expect(result.data).toBeDefined();
  });

  it("should return not_found for missing key", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Act
    const result = handlers.nexus_memory_load({ key: "nonexistent", scope: "session" });

    // Assert
    expect(result.status).toBe("not_found");
  });

  it("should reject load without key", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Act & Assert
    expect(() => handlers.nexus_memory_load({ scope: "session" })).toThrow("key is required");
  });
});

// ============================================================
// Test 5: Handler - nexus_memory_delete
// ============================================================
describe("handler - nexus_memory_delete", () => {
  it("should delete an existing entry", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    handlers.nexus_memory_save({
      key: "delete-me",
      value: JSON.stringify({ temp: true }),
      scope: "session",
    });

    // Act
    const result = handlers.nexus_memory_delete({ key: "delete-me", scope: "session" });

    // Assert
    expect(result.status).toBe("deleted");
  });

  it("should return not_found for non-existent key", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Act
    const result = handlers.nexus_memory_delete({ key: "does-not-exist", scope: "session" });

    // Assert
    expect(result.status).toBe("not_found");
  });

  it("should reject delete without key", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Act & Assert
    expect(() => handlers.nexus_memory_delete({ scope: "session" })).toThrow("key is required");
  });

  it("should verify deletion was permanent", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    handlers.nexus_memory_save({
      key: "verify-delete",
      value: JSON.stringify({ data: "gone" }),
      scope: "session",
    });

    // Act
    handlers.nexus_memory_delete({ key: "verify-delete", scope: "session" });

    // Assert — should not be loadable anymore
    const loadResult = handlers.nexus_memory_load({ key: "verify-delete", scope: "session" });
    expect(loadResult.status).toBe("not_found");
  });
});

// ============================================================
// Test 6: Handler - nexus_memory_list
// ============================================================
describe("handler - nexus_memory_list", () => {
  it("should list recent entries", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    handlers.nexus_memory_save({
      key: "list-key-1",
      value: JSON.stringify({ n: 1 }),
      scope: "session",
    });
    handlers.nexus_memory_save({
      key: "list-key-2",
      value: JSON.stringify({ n: 2 }),
      scope: "project",
    });

    // Act
    const result = handlers.nexus_memory_list({ limit: 10 });

    // Assert
    expect(result.status).toBe("listed");
    expect(result.count).toBeGreaterThanOrEqual(2);
    expect(result.entries.length).toBeGreaterThanOrEqual(2);
  });

  it("should respect the limit parameter", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    for (let i = 0; i < 5; i++) {
      handlers.nexus_memory_save({
        key: `limit-key-${i}`,
        value: JSON.stringify({ i }),
        scope: "session",
      });
    }

    // Act
    const result = handlers.nexus_memory_list({ limit: 2 });

    // Assert
    expect(result.entries.length).toBeLessThanOrEqual(2);
  });
});

// ============================================================
// Test 7: Handler - nexus_memory_search
// ============================================================
describe("handler - nexus_memory_search", () => {
  it("should search for saved entries", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    handlers.nexus_memory_save({
      key: "search-target",
      value: JSON.stringify({ content: "unique searchable text" }),
      scope: "session",
    });

    // Act
    const result = handlers.nexus_memory_search({ query: "searchable", limit: 10 });

    // Assert
    expect(result.status).toBe("searched");
    expect(result.query).toBe("searchable");
    expect(result).toHaveProperty("count");
    expect(result).toHaveProperty("results");
  });

  it("should reject search without query", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Act & Assert
    expect(() => handlers.nexus_memory_search({ limit: 10 })).toThrow("query is required");
  });

  it("should sanitize search query properly", () => {
    // Sanitize should remove quotes and format for FTS5
    const query = "hello 'world' test";
    const sanitized = query
      .replace(/['"]/g, "")
      .split(/\s+/)
      .map((w: string) => `"${w}"*`)
      .join(" AND ");

    expect(sanitized).toBe('"hello"* AND "world"* AND "test"*');
  });
});

// ============================================================
// Test 8: JSON-RPC error responses
// ============================================================
describe("JSON-RPC error responses", () => {
  it("should create error response with -32601 for unknown method", () => {
    // Arrange & Act
    const error = createErrorResponse(1, -32601, "Method not found: unknown_method");

    // Assert
    expect(error.error.code).toBe(-32601);
    expect(error.error.message).toContain("Method not found");
  });

  it("should create error response with -32603 for internal error", () => {
    // Arrange & Act
    const error = createErrorResponse("req-1", -32603, "Internal error: something broke");

    // Assert
    expect(error.error.code).toBe(-32603);
  });

  it("should handle null id in error responses", () => {
    // Act
    const error = createErrorResponse(null, -32700, "Parse error");

    // Assert
    expect(error.id).toBeNull();
  });

  it("should format tool call response correctly", () => {
    // Arrange
    const toolResult = { status: "saved", key: "test", scope: "session" };

    // Act
    const response = createToolCallResponse("call-1", toolResult);

    // Assert — MCP format spec
    expect(response.result.content).toHaveLength(1);
    expect(response.result.content[0].type).toBe("text");
    const parsed = JSON.parse(response.result.content[0].text);
    expect(parsed.status).toBe("saved");
  });
});

// ============================================================
// Test 9: End-to-end: save → load → delete cycle
// ============================================================
describe("end-to-end: save → load → delete cycle", () => {
  it("should complete a full CRUD cycle", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);
    const testData = { user: "john", role: "admin" };

    // Act & Assert — CREATE
    const saveResult = handlers.nexus_memory_save({
      key: "crud-test",
      value: JSON.stringify(testData),
      scope: "project",
    });
    expect(saveResult.status).toBe("saved");

    // READ
    const loadResult = handlers.nexus_memory_load({ key: "crud-test", scope: "project" });
    expect(loadResult.status).toBe("loaded");

    // DELETE
    const deleteResult = handlers.nexus_memory_delete({ key: "crud-test", scope: "project" });
    expect(deleteResult.status).toBe("deleted");

    // VERIFY deletion
    const afterDelete = handlers.nexus_memory_load({ key: "crud-test", scope: "project" });
    expect(afterDelete.status).toBe("not_found");
  });

  it("should handle multiple entries with same key but different scopes", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db);

    // Act
    handlers.nexus_memory_save({ key: "shared-key", value: JSON.stringify({ scope: "session" }), scope: "session" });
    handlers.nexus_memory_save({ key: "shared-key", value: JSON.stringify({ scope: "project" }), scope: "project" });
    handlers.nexus_memory_save({ key: "shared-key", value: JSON.stringify({ scope: "agent" }), scope: "agent" });

    // Assert
    const sessionLoad = handlers.nexus_memory_load({ key: "shared-key", scope: "session" });
    const projectLoad = handlers.nexus_memory_load({ key: "shared-key", scope: "project" });
    const agentLoad = handlers.nexus_memory_load({ key: "shared-key", scope: "agent" });

    expect(sessionLoad.status).toBe("loaded");
    expect(projectLoad.status).toBe("loaded");
    expect(agentLoad.status).toBe("loaded");
  });
});


// ============================================================
// Test 10: New handoff tools
// ============================================================

describe("MCP handoff tools", () => {
  it("should return 8 tool definitions (5 memory + 3 handoff)", () => {
    // Arrange & Act
    const response = createToolListResponse("req-handoff");

    // Assert
    expect(response.result.tools).toHaveLength(8);
  });

  it("should have nexus_handoff_save with required fields", () => {
    const response = createToolListResponse(1);
    const saveTool = response.result.tools.find((t: ToolDefinition) => t.name === "nexus_handoff_save");
    expect(saveTool).toBeDefined();
    expect(saveTool.inputSchema.required).toContain("id");
    expect(saveTool.inputSchema.required).toContain("title");
    expect(saveTool.inputSchema.required).toContain("summary");
  });

  it("should have nexus_handoff_load with required id", () => {
    const response = createToolListResponse(1);
    const loadTool = response.result.tools.find((t: ToolDefinition) => t.name === "nexus_handoff_load");
    expect(loadTool).toBeDefined();
    expect(loadTool.inputSchema.required).toContain("id");
  });

  it("should have nexus_handoff_list without required fields", () => {
    const response = createToolListResponse(1);
    const listTool = response.result.tools.find((t: ToolDefinition) => t.name === "nexus_handoff_list");
    expect(listTool).toBeDefined();
    expect(listTool.inputSchema.required).toBeUndefined();
  });
});

describe("handler - nexus_handoff_save", () => {
  it("should save handoff locally and return saved status", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db, null);

    // Act
    const result = handlers.nexus_handoff_save({
      id: "handoff-test-001",
      title: "Test Handoff",
      summary: "Test summary",
      nextSteps: ["Step 1", "Step 2"],
      artifacts: ["file.ts"],
      pending: "None",
      fromAgent: "test-agent",
      fromSession: "session-001",
    });

    // Assert
    expect(result.status).toBe("saved");
    expect(result.id).toBe("handoff-test-001");
    expect(result.remote).toBe(false);
  });

  it("should save handoff to both local and MongoDB when configured", async () => {
    // Arrange
    const db = setupTestDb();
    const mockMongo: MongoAdapterMock = {
      insertOne: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      find: jest.fn(),
      isConnected: () => true,
    };
    const handlers = createHandlers(db, mockMongo);

    // Act
    const result = handlers.nexus_handoff_save({
      id: "handoff-dual-001",
      title: "Dual Save",
      summary: "Saving to both",
      nextSteps: [],
      artifacts: [],
      pending: "None",
    });

    // Assert
    expect(result.status).toBe("saved");
    expect(result.remote).toBe(true);
    expect(mockMongo.insertOne).toHaveBeenCalledWith(
      "handoffs",
      expect.objectContaining({ id: "handoff-dual-001" }),
    );
  });
});

describe("handler - nexus_handoff_load", () => {
  it("should load handoff from local storage", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db, null);

    // Save first
    handlers.nexus_handoff_save({
      id: "load-test",
      title: "Load Test",
      summary: "Test",
      nextSteps: [],
      artifacts: [],
      pending: "None",
    });

    // Act
    const result = handlers.nexus_handoff_load({ id: "load-test" });

    // Assert
    expect(result.status).toBe("loaded");
    expect(result.handoff.title).toBe("Load Test");
  });

  it("should load from MongoDB when local not found", async () => {
    // Arrange
    const db = setupTestDb();
    const mockMongo: MongoAdapterMock = {
      insertOne: jest.fn(),
      findOne: jest.fn().mockReturnValue({
        id: "remote-only",
        title: "Remote Handoff",
        summary: "From MongoDB",
        nextSteps: [],
        artifacts: [],
        pending: "None",
        createdAt: new Date().toISOString(),
      }),
      find: jest.fn(),
      isConnected: () => true,
    };
    const handlers = createHandlers(db, mockMongo);

    // Act
    const result = handlers.nexus_handoff_load({ id: "remote-only" });

    // Assert
    expect(result.status).toBe("loaded");
    expect(result.handoff.title).toBe("Remote Handoff");
    expect(result.source).toBe("remote");
  });
});

describe("handler - nexus_handoff_list", () => {
  it("should list handoffs from local storage", () => {
    // Arrange
    const db = setupTestDb();
    const handlers = createHandlers(db, null);

    handlers.nexus_handoff_save({
      id: "list-1",
      title: "First",
      summary: "s1",
      nextSteps: [],
      artifacts: [],
      pending: "None",
    });
    handlers.nexus_handoff_save({
      id: "list-2",
      title: "Second",
      summary: "s2",
      nextSteps: [],
      artifacts: [],
      pending: "None",
    });

    // Act
    const result = handlers.nexus_handoff_list({ limit: 10 });

    // Assert
    expect(result.status).toBe("listed");
    expect(result.count).toBe(2);
  });

  it("should merge local and remote handoffs when MongoDB configured", async () => {
    // Arrange
    const db = setupTestDb();
    const mockMongo: MongoAdapterMock = {
      insertOne: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue([
        { id: "remote-1", title: "Remote", summary: "From cloud" },
      ]),
      isConnected: () => true,
    };
    const handlers = createHandlers(db, mockMongo);

    handlers.nexus_handoff_save({
      id: "local-1",
      title: "Local",
      summary: "From disk",
      nextSteps: [],
      artifacts: [],
      pending: "None",
    });

    // Act
    const result = handlers.nexus_handoff_list({ limit: 10 });

    // Assert
    expect(result.status).toBe("listed");
    expect(result.count).toBe(2);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "local-1" }),
        expect.objectContaining({ id: "remote-1" }),
      ]),
    );
  });
});
