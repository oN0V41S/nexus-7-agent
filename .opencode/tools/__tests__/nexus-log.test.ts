/**
 * Tests for nexus-log.ts — Fix: type-check metadata before JSON.parse
 *
 * The fix changes:
 *   const meta = metadata ? JSON.parse(metadata) : {};
 * to:
 *   const meta = metadata ? (typeof metadata === "string" ? JSON.parse(metadata) : metadata) : {};
 *
 * This prevents "Unable to parse JSON string" error when metadata
 * arrives as a JS object instead of a JSON string.
 *
 * Pattern: AAA (Arrange, Act, Assert)
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

import nexusLogTool from "../nexus-log";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-log-test-"));
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
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
// Test 1: Metadata as already-parsed object (THE FIX)
// ============================================================
describe("metadata as already-parsed object (the fix)", () => {
  it("should handle metadata as JS object without crashing", async () => {
    // Arrange — metadata arrives as object (the bug scenario)
    const ctx = createContext();
    const metadataObj = { key: "value", count: 42 };

    // Act
    const result = await nexusLogTool.execute(
      {
        level: "info",
        message: "Test message",
        category: "test",
        metadata: metadataObj as any, // Object, not string
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("logged");
  });

  it("should handle complex nested metadata objects", async () => {
    const ctx = createContext();
    const complexMeta = {
      user: "john",
      action: "login",
      details: { ip: "127.0.0.1", browser: "Chrome" },
      tags: ["auth", "security"],
    };

    const result = await nexusLogTool.execute(
      {
        level: "info",
        message: "User login",
        category: "auth",
        metadata: complexMeta as any,
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("logged");
  });

  it("should handle metadata with null/undefined values", async () => {
    const ctx = createContext();
    const metaWithNull = { a: null, b: undefined, c: "valid" };

    const result = await nexusLogTool.execute(
      {
        level: "warn",
        message: "Test with nulls",
        category: "test",
        metadata: metaWithNull as any,
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("logged");
  });

  it("should handle metadata with arrays", async () => {
    const ctx = createContext();
    const metaWithArray = { items: [1, 2, 3], names: ["a", "b"] };

    const result = await nexusLogTool.execute(
      {
        level: "info",
        message: "Array metadata",
        category: "test",
        metadata: metaWithArray as any,
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("logged");
  });
});

// ============================================================
// Test 2: Metadata as JSON string (legacy behavior)
// ============================================================
describe("metadata as JSON string (legacy)", () => {
  it("should parse JSON string metadata", async () => {
    const ctx = createContext();
    const metaString = JSON.stringify({ key: "value" });

    const result = await nexusLogTool.execute(
      {
        level: "info",
        message: "Legacy string metadata",
        category: "test",
        metadata: metaString,
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("logged");
  });

  it("should handle invalid JSON string gracefully", async () => {
    const ctx = createContext();
    const invalidJson = "not-valid-json{";

    // JSON.parse will throw on invalid JSON string
    await expect(
      nexusLogTool.execute(
        {
          level: "error",
          message: "Invalid JSON test",
          category: "test",
          metadata: invalidJson,
        },
        ctx,
      ),
    ).rejects.toThrow();
  });
});

// ============================================================
// Test 3: No metadata
// ============================================================
describe("no metadata", () => {
  it("should work without metadata", async () => {
    const ctx = createContext();

    const result = await nexusLogTool.execute(
      {
        level: "info",
        message: "No metadata",
        category: "test",
        // metadata not provided
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("logged");
  });

  it("should work with empty metadata string", async () => {
    const ctx = createContext();

    const result = await nexusLogTool.execute(
      {
        level: "debug",
        message: "Empty metadata",
        category: "test",
        metadata: "",
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("logged");
  });

  it("should work with undefined metadata", async () => {
    const ctx = createContext();

    const result = await nexusLogTool.execute(
      {
        level: "trace",
        message: "Undefined metadata",
        category: "test",
        metadata: undefined,
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("logged");
  });
});

// ============================================================
// Test 4: Log file creation
// ============================================================
describe("log file creation", () => {
  it("should create log file on disk", async () => {
    const ctx = createContext();

    await nexusLogTool.execute(
      {
        level: "info",
        message: "File creation test",
        category: "file-test",
        metadata: JSON.stringify({ test: true }),
      },
      ctx,
    );

    // Assert — log file should exist
    const logDir = path.join(tmpDir, ".opencode/logs");
    expect(fs.existsSync(logDir)).toBe(true);

    const files = fs.readdirSync(logDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.startsWith("file-test-"))).toBe(true);
  });

  it("should append to log file", async () => {
    const ctx = createContext();

    // Log twice
    await nexusLogTool.execute(
      {
        level: "info",
        message: "First entry",
        category: "append-test",
      },
      ctx,
    );

    await nexusLogTool.execute(
      {
        level: "warn",
        message: "Second entry",
        category: "append-test",
      },
      ctx,
    );

    // Assert — file should have 2 entries
    const logDir = path.join(tmpDir, ".opencode/logs");
    const files = fs.readdirSync(logDir);
    const logFile = files.find((f) => f.startsWith("append-test-"));
    expect(logFile).toBeDefined();

    const content = fs.readFileSync(path.join(logDir, logFile!), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(2);
  });
});
