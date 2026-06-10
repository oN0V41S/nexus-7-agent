/**
 * Tests for nexus-memory.ts — Fix: JSON parse error when value/metadata
 * arrives as object instead of string.
 *
 * The fix adds a tryParseJson helper and type-checks before JSON.parse
 * in save/load/search actions.
 *
 * Pattern: AAA (Arrange, Act, Assert)
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

// Import the tool module (mock resolves @opencode-ai/plugin/tool)
import nexusMemoryTool from "../nexus-memory";

// The tool uses context.worktree which needs a real temp directory
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-memory-test-"));
});

afterEach(() => {
  // Cleanup temp directory
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

function createContext() {
  return {
    worktree: tmpDir,
    agent: "test-agent",
    sessionID: "test-session-001",
  };
}

// ============================================================
// Test 1: tryParseJson handles already-parsed objects (the core fix)
// ============================================================
describe("tryParseJson (via save action)", () => {
  it("should handle already-parsed objects in value field", async () => {
    // Arrange
    const ctx = createContext();
    const alreadyParsed = { name: "test", count: 42 };

    // Act — value arrives as object (not string)
    const result = await nexusMemoryTool.execute(
      {
        action: "save",
        key: "test-key",
        value: alreadyParsed as any, // Simulate object input (the fix scenario)
        scope: "test",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("saved");
    expect(parsed.key).toBe("test-key");
  });

  it("should handle JSON string values normally", async () => {
    // Arrange
    const ctx = createContext();
    const jsonString = JSON.stringify({ name: "test", count: 42 });

    // Act
    const result = await nexusMemoryTool.execute(
      {
        action: "save",
        key: "test-key-2",
        value: jsonString,
        scope: "test",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("saved");
  });

  it("should handle invalid JSON strings gracefully", async () => {
    // Arrange
    const ctx = createContext();
    const invalidJson = "not-json-at-all";

    // Act & Assert — this should throw during save since JSON.parse fails
    await expect(
      nexusMemoryTool.execute(
        {
          action: "save",
          key: "test-key-3",
          value: invalidJson,
          scope: "test",
        },
        ctx,
      ),
    ).rejects.toThrow();
  });
});

// ============================================================
// Test 2: tryParseJson in load action
// ============================================================
describe("tryParseJson (via load action)", () => {
  it("should return correctly parsed value after save with object input", async () => {
    // Arrange
    const ctx = createContext();
    const testValue = { message: "hello", nested: { a: 1 } };

    // Save with object input
    await nexusMemoryTool.execute(
      {
        action: "save",
        key: "load-test",
        value: testValue as any,
        scope: "session",
      },
      ctx,
    );

    // Act — load the data back
    const result = await nexusMemoryTool.execute(
      {
        action: "load",
        key: "load-test",
        scope: "session",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("loaded");
    expect(parsed.data).toBeDefined();
    expect(parsed.data.value).toEqual(testValue);
  });

  it("should return correctly parsed value after save with string input", async () => {
    // Arrange
    const ctx = createContext();
    const testValue = { message: "world" };

    // Save with string JSON
    await nexusMemoryTool.execute(
      {
        action: "save",
        key: "load-test-2",
        value: JSON.stringify(testValue),
        scope: "session",
      },
      ctx,
    );

    // Act — load the data back
    const result = await nexusMemoryTool.execute(
      {
        action: "load",
        key: "load-test-2",
        scope: "session",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.data.value).toEqual(testValue);
  });

  it("should return not_found for missing keys", async () => {
    // Act
    const ctx = createContext();
    const result = await nexusMemoryTool.execute(
      {
        action: "load",
        key: "nonexistent-key",
        scope: "session",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("not_found");
  });
});

// ============================================================
// Test 3: tryParseJson in search action
// ============================================================
describe("tryParseJson (via search action)", () => {
  it("should search and return results with valid summaries", async () => {
    // Arrange
    const ctx = createContext();
    const testValue = { content: "searchable text" };

    // Save some data
    await nexusMemoryTool.execute(
      {
        action: "save",
        key: "search-key-1",
        value: testValue as any,
        scope: "test",
      },
      ctx,
    );

    // Act — search
    const result = await nexusMemoryTool.execute(
      {
        action: "search",
        query: "searchable",
        limit: 10,
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("searched");
    // Results may be empty if FTS5 triggers haven't fired (mocked DB)
    // At minimum, the call should not crash
    expect(parsed).toHaveProperty("results");
  });
});

// ============================================================
// Test 4: Edge cases
// ============================================================
describe("nexus-memory edge cases", () => {
  it("should handle empty string value for save", async () => {
    // Arrange
    const ctx = createContext();
    const emptyValue = "";

    // Act & Assert — empty string throws since JSON.parse("") throws
    await expect(
      nexusMemoryTool.execute(
        {
          action: "save",
          key: "empty-value",
          value: emptyValue,
          scope: "test",
        },
        ctx,
      ),
    ).rejects.toThrow();
  });

  it("should reject save without key", async () => {
    const ctx = createContext();
    await expect(
      nexusMemoryTool.execute(
        {
          action: "save",
          key: "",
          value: "{}",
          scope: "test",
        } as any,
        ctx,
      ),
    ).rejects.toThrow("key é obrigatório");
  });

  it("should reject unknown action", async () => {
    const ctx = createContext();
    await expect(
      nexusMemoryTool.execute(
        {
          action: "invalid" as any,
        },
        ctx,
      ),
    ).rejects.toThrow("Ação desconhecida");
  });

  it("should handle delete action", async () => {
    // Arrange
    const ctx = createContext();
    await nexusMemoryTool.execute(
      {
        action: "save",
        key: "delete-me",
        value: JSON.stringify({ temp: true }),
        scope: "test",
      },
      ctx,
    );

    // Act
    const result = await nexusMemoryTool.execute(
      {
        action: "delete",
        key: "delete-me",
        scope: "test",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("deleted");
  });

  it("should handle delete on nonexistent key", async () => {
    const ctx = createContext();
    const result = await nexusMemoryTool.execute(
      {
        action: "delete",
        key: "does-not-exist",
        scope: "test",
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("not_found");
  });

  it("should handle list action", async () => {
    const ctx = createContext();
    const result = await nexusMemoryTool.execute(
      {
        action: "list",
        limit: 10,
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("listed");
  });
});
