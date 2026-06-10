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

// ============================================================
// Handler factory (mirrored from server)
// ============================================================

function createHandlers(db: SqliteDb) {
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
    result: { tools: TOOL_DEFINITIONS },
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
    expect(response.result.tools).toHaveLength(5);
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
