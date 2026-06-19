/**
 * Tests for nexus-handoff.ts — Fix: JSON.parse crash on plain strings.
 *
 * The fix adds safeParseArray() which handles:
 * 1. Valid JSON array strings → parsed as array
 * 2. Plain strings → wrapped in array
 * 3. null/undefined → empty array
 * 4. Valid JSON but not array → wrapped in array via String()
 *
 * Pattern: AAA (Arrange, Act, Assert)
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

import nexusHandoffTool from "../nexus-handoff";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-handoff-test-"));
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
// Test 1: safeParseArray with valid JSON array strings
// ============================================================
describe("safeParseArray (via create action - nextSteps)", () => {
  it("should parse valid JSON array string for nextSteps", async () => {
    // Arrange
    const ctx = createContext();
    const nextStepsArr = ["Step 1", "Step 2", "Implement feature X"];

    // Act
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Test Handoff",
        summary: "Testing safeParseArray",
        nextSteps: JSON.stringify(nextStepsArr),
        artifacts: JSON.stringify([]),
        pending: "None",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("created");
    expect(parsed.handoff.nextSteps).toEqual(nextStepsArr);
  });

  it("should parse valid JSON array string for artifacts", async () => {
    // Arrange
    const ctx = createContext();
    const artifactsArr = ["file1.ts", "file2.ts"];

    // Act
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Artifact Test",
        summary: "Testing artifacts parsing",
        nextSteps: JSON.stringify([]),
        artifacts: JSON.stringify(artifactsArr),
        pending: "None",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.handoff.artifacts).toEqual(artifactsArr);
  });
});

// ============================================================
// Test 2: safeParseArray with plain strings (THE FIX)
// ============================================================
describe("safeParseArray with plain strings (the fix)", () => {
  it("should handle plain string in nextSteps without crashing", async () => {
    // Arrange — this is exactly the scenario that caused the crash
    const ctx = createContext();
    const plainString = "Review the implementation and continue";

    // Act — before the fix, JSON.parse("Review the...") would throw
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Plain String Test",
        summary: "Testing plain string input",
        nextSteps: plainString,
        artifacts: JSON.stringify([]),
        pending: "None",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("created");
    expect(parsed.handoff.nextSteps).toEqual([plainString]);
  });

  it("should handle plain string in artifacts without crashing", async () => {
    // Arrange
    const ctx = createContext();
    const plainString = "src/index.ts";

    // Act
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Plain Artifacts Test",
        summary: "Testing plain artifacts input",
        nextSteps: JSON.stringify([]),
        artifacts: plainString,
        pending: "None",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.handoff.artifacts).toEqual([plainString]);
  });

  it("should handle multiline plain strings", async () => {
    // Arrange
    const ctx = createContext();
    const multiline = "Step one\nStep two\nStep three";

    // Act
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Multiline Test",
        summary: "Testing multiline string",
        nextSteps: multiline,
        artifacts: JSON.stringify([]),
        pending: "None",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.handoff.nextSteps).toEqual([multiline]);
  });
});

// ============================================================
// Test 3: safeParseArray with null/undefined
// ============================================================
describe("safeParseArray with null/undefined", () => {
  it("should handle undefined nextSteps", async () => {
    // Arrange
    const ctx = createContext();

    // Act
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Undefined Test",
        summary: "Testing undefined nextSteps",
        // nextSteps not provided
        artifacts: JSON.stringify([]),
        pending: "None",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.handoff.nextSteps).toEqual([]);
  });

  it("should handle undefined artifacts", async () => {
    const ctx = createContext();
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Undefined Artifacts",
        summary: "Testing undefined artifacts",
        nextSteps: JSON.stringify([]),
        // artifacts not provided
        pending: "None",
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.handoff.artifacts).toEqual([]);
  });

  it("should handle null nextSteps", async () => {
    const ctx = createContext();
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Null Test",
        summary: "Testing null nextSteps",
        nextSteps: null as any,
        artifacts: JSON.stringify([]),
        pending: "None",
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.handoff.nextSteps).toEqual([]);
  });

  it("should handle empty string nextSteps", async () => {
    const ctx = createContext();
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Empty String Test",
        summary: "Testing empty string",
        nextSteps: "",
        artifacts: JSON.stringify([]),
        pending: "None",
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.handoff.nextSteps).toEqual([]);
  });
});

// ============================================================
// Test 4: safeParseArray with valid JSON but not an array
// ============================================================
describe("safeParseArray with non-array JSON", () => {
  it("should wrap JSON object in an array via String()", async () => {
    // Arrange
    const ctx = createContext();
    const jsonObj = JSON.stringify({ key: "value" });

    // Act — JSON.parse succeeds but result is not an array
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "JSON Object Test",
        summary: "Testing JSON object input",
        nextSteps: jsonObj,
        artifacts: JSON.stringify([]),
        pending: "None",
      },
      ctx,
    );

    // Assert — when JSON is valid but not array, String(parsed) yields "[object Object]"
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed.handoff.nextSteps)).toBe(true);
    expect(parsed.handoff.nextSteps.length).toBe(1);
  });

  it("should wrap number JSON in an array", async () => {
    const ctx = createContext();
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Number Test",
        summary: "Testing number input",
        nextSteps: "42",
        artifacts: JSON.stringify([]),
        pending: "None",
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed.handoff.nextSteps)).toBe(true);
    expect(parsed.handoff.nextSteps).toEqual(["42"]);
  });
});

// ============================================================
// Test 5: Other operations
// ============================================================
describe("nexus-handoff other operations", () => {
  it("should list handoffs", async () => {
    // Arrange — create one first
    const ctx = createContext();
    await nexusHandoffTool.execute(
      {
        action: "create",
        title: "List Test",
        summary: "For listing",
        nextSteps: JSON.stringify(["a"]),
        artifacts: JSON.stringify([]),
        pending: "None",
      },
      ctx,
    );

    // Act
    const result = await nexusHandoffTool.execute(
      {
        action: "list",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("listed");
    expect(parsed.count).toBeGreaterThanOrEqual(1);
  });

  it("should apply a handoff", async () => {
    // Arrange — create one
    const ctx = createContext();
    const createResult = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Apply Test",
        summary: "For applying",
        nextSteps: JSON.stringify(["step1"]),
        artifacts: JSON.stringify([]),
        pending: "Review needed",
      },
      ctx,
    );
    const { id } = JSON.parse(createResult);

    // Act
    const result = await nexusHandoffTool.execute(
      {
        action: "apply",
        handoffId: id,
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("applied");
    expect(parsed.handoff.title).toBe("Apply Test");
  });

  it("should return not_found for missing handoffId in apply", async () => {
    const ctx = createContext();
    const result = await nexusHandoffTool.execute(
      {
        action: "apply",
        handoffId: "nonexistent-id",
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("not_found");
  });

  it("should reject create without title", async () => {
    const ctx = createContext();
    await expect(
      nexusHandoffTool.execute(
        {
          action: "create",
          // title missing
        } as any,
        ctx,
      ),
    ).rejects.toThrow("title é obrigatório");
  });

  it("should reject unknown action", async () => {
    const ctx = createContext();
    await expect(
      nexusHandoffTool.execute(
        {
          action: "unknown" as any,
        },
        ctx,
      ),
    ).rejects.toThrow("Ação desconhecida");
  });
});

// ============================================================
// Test 6: Remote sync option (with mocked MongoDB)
// ============================================================

// Mock the mongodb-adapter module
jest.mock("../mongodb-adapter", () => {
  const mockAdapter = {
    isConnected: jest.fn().mockReturnValue(true),
    insertOne: jest.fn().mockResolvedValue({ toString: () => "mock-id" }),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    close: jest.fn(),
  };

  return {
    getMongoAdapter: jest.fn().mockResolvedValue(mockAdapter),
    __mockAdapter: mockAdapter,
  };
});

describe("nexus-handoff with remote sync", () => {
  let mockAdapter: any;

  beforeEach(async () => {
    const mod = await import("../mongodb-adapter");
    mockAdapter = (mod as any).__mockAdapter;
    mockAdapter.insertOne.mockClear();
    mockAdapter.find.mockClear();
    mockAdapter.findOne.mockClear();
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
  });

  afterEach(() => {
    delete process.env.MONGODB_URI;
  });

  it("should save handoff with syncToMongo option", async () => {
    // Arrange
    const ctx = createContext();

    // Act
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Remote Sync Test",
        summary: "Testing remote sync",
        nextSteps: JSON.stringify(["step1"]),
        artifacts: JSON.stringify([]),
        pending: "None",
        syncToMongo: "true",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("created");
    expect(parsed).toHaveProperty("localId");
    expect(parsed.remoteSynced).toBe(true);
    expect(mockAdapter.insertOne).toHaveBeenCalledWith("handoffs", expect.objectContaining({ title: "Remote Sync Test" }));
  });

  it("should list handoffs from both local and remote", async () => {
    // Arrange
    const ctx = createContext();

    // Act
    const result = await nexusHandoffTool.execute(
      {
        action: "list",
        source: "all",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("listed");
    expect(parsed).toHaveProperty("localCount");
    expect(parsed).toHaveProperty("remoteCount");
  });

  it("should fallback to local when syncToMongo fails", async () => {
    // Arrange
    const ctx = createContext();
    mockAdapter.isConnected.mockReturnValueOnce(false);

    // Act
    const result = await nexusHandoffTool.execute(
      {
        action: "create",
        title: "Fallback Test",
        summary: "Testing fallback",
        nextSteps: JSON.stringify([]),
        artifacts: JSON.stringify([]),
        pending: "None",
        syncToMongo: "true",
      },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("created");
    expect(parsed.remoteSynced).toBe(false);
  });
});
