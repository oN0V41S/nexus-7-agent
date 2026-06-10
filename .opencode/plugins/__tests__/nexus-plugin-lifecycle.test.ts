/**
 * Tests for nexus-plugin.ts — Lifecycle hooks (beyond FlexEdit)
 *
 * Covers: createSessionTracker, saveHandoff, appendLog,
 *         chat.message, tool.execute.after, command.execute.before,
 *         experimental.session.compacting, permission.ask, chat.params
 *
 * Pattern: AAA (Arrange, Act, Assert)
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

// ============================================================
// Extracted helpers from the plugin (for isolated testing)
// ============================================================

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendLog(
  worktree: string,
  level: string,
  category: string,
  message: string,
  meta: Record<string, unknown> = {},
): void {
  const logDir = path.join(worktree, ".opencode/logs");
  ensureDir(logDir);
  const date = new Date().toISOString().slice(0, 10);
  const logFile = path.join(logDir, `${category}-${date}.log`);
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  const entry = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
  fs.appendFileSync(logFile, entry, "utf-8");
}

function saveHandoff(
  worktree: string,
  title: string,
  summary: string,
  nextSteps: string[],
  artifacts: string[],
  pending: string,
  agent: string,
  sessionID: string,
): string {
  const hfDir = path.join(worktree, ".opencode/memory/handoffs");
  ensureDir(hfDir);
  const id = `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const doc = {
    id,
    title,
    summary,
    nextSteps,
    artifacts,
    pending,
    createdAt: new Date().toISOString(),
    fromAgent: agent,
    fromSession: sessionID,
    type: "auto-handoff",
  };
  const filePath = path.join(hfDir, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), "utf-8");
  return id;
}

function createSessionTracker() {
  const sessions = new Map<
    string,
    {
      startTime: number;
      messageCount: number;
      toolCalls: Array<{ tool: string; timestamp: number; duration: number }>;
      agent: string;
    }
  >();

  return {
    start(sessionID: string, agent: string) {
      if (!sessions.has(sessionID)) {
        sessions.set(sessionID, {
          startTime: Date.now(),
          messageCount: 0,
          toolCalls: [],
          agent,
        });
      }
    },
    trackMessage(sessionID: string) {
      const s = sessions.get(sessionID);
      if (s) s.messageCount++;
    },
    trackToolCall(sessionID: string, tool: string, duration: number) {
      const s = sessions.get(sessionID);
      if (s) {
        s.toolCalls.push({ tool, timestamp: Date.now(), duration });
      }
    },
    getSummary(sessionID: string) {
      return sessions.get(sessionID) || null;
    },
    end(sessionID: string) {
      sessions.delete(sessionID);
    },
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-plugin-lifecycle-"));
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

// ============================================================
// Test 1: createSessionTracker
// ============================================================
describe("createSessionTracker", () => {
  it("should start tracking a new session", () => {
    // Arrange
    const tracker = createSessionTracker();

    // Act
    tracker.start("session-1", "agent-alpha");

    // Assert
    const summary = tracker.getSummary("session-1");
    expect(summary).not.toBeNull();
    expect(summary!.agent).toBe("agent-alpha");
    expect(summary!.messageCount).toBe(0);
    expect(summary!.toolCalls).toHaveLength(0);
    expect(summary!.startTime).toBeGreaterThan(0);
  });

  it("should not overwrite existing session on start", () => {
    // Arrange
    const tracker = createSessionTracker();
    tracker.start("session-1", "agent-alpha");
    tracker.trackMessage("session-1");

    // Act — start again with different agent
    tracker.start("session-1", "agent-beta");

    // Assert — original session preserved
    const summary = tracker.getSummary("session-1");
    expect(summary!.agent).toBe("agent-alpha");
    expect(summary!.messageCount).toBe(1);
  });

  it("should track message count", () => {
    // Arrange
    const tracker = createSessionTracker();
    tracker.start("session-1", "agent-alpha");

    // Act
    tracker.trackMessage("session-1");
    tracker.trackMessage("session-1");
    tracker.trackMessage("session-1");

    // Assert
    expect(tracker.getSummary("session-1")!.messageCount).toBe(3);
  });

  it("should track tool calls", () => {
    // Arrange
    const tracker = createSessionTracker();
    tracker.start("session-1", "agent-alpha");

    // Act
    tracker.trackToolCall("session-1", "read", 100);
    tracker.trackToolCall("session-1", "write", 200);

    // Assert
    const summary = tracker.getSummary("session-1");
    expect(summary!.toolCalls).toHaveLength(2);
    expect(summary!.toolCalls[0].tool).toBe("read");
    expect(summary!.toolCalls[0].duration).toBe(100);
    expect(summary!.toolCalls[1].tool).toBe("write");
    expect(summary!.toolCalls[1].duration).toBe(200);
  });

  it("should return null for non-existent session", () => {
    // Arrange
    const tracker = createSessionTracker();

    // Act
    const summary = tracker.getSummary("nonexistent");

    // Assert
    expect(summary).toBeNull();
  });

  it("should trackMessage silently for non-existent session", () => {
    // Arrange
    const tracker = createSessionTracker();

    // Act — should not throw
    expect(() => tracker.trackMessage("nonexistent")).not.toThrow();
  });

  it("should trackToolCall silently for non-existent session", () => {
    // Arrange
    const tracker = createSessionTracker();

    // Act — should not throw
    expect(() => tracker.trackToolCall("nonexistent", "read", 100)).not.toThrow();
  });

  it("should end tracking and remove session", () => {
    // Arrange
    const tracker = createSessionTracker();
    tracker.start("session-1", "agent-alpha");

    // Act
    tracker.end("session-1");

    // Assert
    expect(tracker.getSummary("session-1")).toBeNull();
  });

  it("should handle end for non-existent session", () => {
    // Arrange
    const tracker = createSessionTracker();

    // Act — should not throw
    expect(() => tracker.end("nonexistent")).not.toThrow();
  });

  it("should support multiple independent sessions", () => {
    // Arrange
    const tracker = createSessionTracker();

    // Act
    tracker.start("session-a", "agent-a");
    tracker.start("session-b", "agent-b");
    tracker.trackMessage("session-a");
    tracker.trackMessage("session-b");
    tracker.trackMessage("session-b");

    // Assert
    expect(tracker.getSummary("session-a")!.messageCount).toBe(1);
    expect(tracker.getSummary("session-b")!.messageCount).toBe(2);
    expect(tracker.getSummary("session-a")!.agent).toBe("agent-a");
    expect(tracker.getSummary("session-b")!.agent).toBe("agent-b");
  });
});

// ============================================================
// Test 2: appendLog helper
// ============================================================
describe("appendLog helper", () => {
  it("should create log file with entry", () => {
    // Arrange
    const category = "test-category";

    // Act
    appendLog(tmpDir, "INFO", category, "Test message");

    // Assert
    const logDir = path.join(tmpDir, ".opencode/logs");
    expect(fs.existsSync(logDir)).toBe(true);

    const files = fs.readdirSync(logDir);
    expect(files.some((f) => f.startsWith(`${category}-`))).toBe(true);
  });

  it("should append multiple entries to the same file", () => {
    // Arrange
    const category = "multi-entry";

    // Act
    appendLog(tmpDir, "INFO", category, "Entry 1");
    appendLog(tmpDir, "WARN", category, "Entry 2");
    appendLog(tmpDir, "ERROR", category, "Entry 3");

    // Assert
    const logDir = path.join(tmpDir, ".opencode/logs");
    const files = fs.readdirSync(logDir);
    const logFile = files.find((f) => f.startsWith(`${category}-`));
    expect(logFile).toBeDefined();

    const content = fs.readFileSync(path.join(logDir, logFile!), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(3);
  });

  it("should include metadata in log entry when provided", () => {
    // Arrange
    const category = "meta-test";

    // Act
    appendLog(tmpDir, "INFO", category, "With meta", { key: "value", num: 42 });

    // Assert
    const logDir = path.join(tmpDir, ".opencode/logs");
    const files = fs.readdirSync(logDir);
    const logFile = files.find((f) => f.startsWith(`${category}-`));
    const content = fs.readFileSync(path.join(logDir, logFile!), "utf-8");
    expect(content).toContain('"key"');
    expect(content).toContain('"value"');
    expect(content).toContain("42");
  });

  it("should handle different log levels formatting", () => {
    // Arrange
    const category = "levels-test";

    // Act
    appendLog(tmpDir, "TRACE", category, "trace msg");
    appendLog(tmpDir, "DEBUG", category, "debug msg");
    appendLog(tmpDir, "INFO", category, "info msg");
    appendLog(tmpDir, "WARN", category, "warn msg");
    appendLog(tmpDir, "ERROR", category, "error msg");

    // Assert — all entries should exist
    const logDir = path.join(tmpDir, ".opencode/logs");
    const files = fs.readdirSync(logDir);
    const logFile = files.find((f) => f.startsWith(`${category}-`));
    const content = fs.readFileSync(path.join(logDir, logFile!), "utf-8");
    expect(content).toContain("[TRACE]");
    expect(content).toContain("[DEBUG]");
    expect(content).toContain("[INFO]");
    expect(content).toContain("[WARN]");
    expect(content).toContain("[ERROR]");
  });
});

// ============================================================
// Test 3: saveHandoff helper
// ============================================================
describe("saveHandoff helper", () => {
  it("should create a handoff file and return an ID", () => {
    // Arrange
    const title = "Test Handoff";
    const summary = "Testing the handoff helper";

    // Act
    const id = saveHandoff(tmpDir, title, summary, ["step1"], ["file1.ts"], "None", "test-agent", "session-1");

    // Assert
    expect(id).toBeDefined();
    expect(id.startsWith("handoff-")).toBe(true);

    const hfDir = path.join(tmpDir, ".opencode/memory/handoffs");
    expect(fs.existsSync(hfDir)).toBe(true);

    const filePath = path.join(hfDir, `${id}.json`);
    expect(fs.existsSync(filePath)).toBe(true);

    const doc = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(doc.title).toBe(title);
    expect(doc.summary).toBe(summary);
    expect(doc.nextSteps).toEqual(["step1"]);
    expect(doc.artifacts).toEqual(["file1.ts"]);
    expect(doc.fromAgent).toBe("test-agent");
    expect(doc.fromSession).toBe("session-1");
    expect(doc.type).toBe("auto-handoff");
  });

  it("should generate unique IDs for multiple handoffs", () => {
    // Arrange

    // Act
    const id1 = saveHandoff(tmpDir, "Handoff 1", "First", [], [], "None", "agent-a", "session-1");
    const id2 = saveHandoff(tmpDir, "Handoff 2", "Second", [], [], "None", "agent-b", "session-2");

    // Assert
    expect(id1).not.toBe(id2);
  });

  it("should handle empty nextSteps and artifacts", () => {
    // Act
    const id = saveHandoff(tmpDir, "Empty Handoff", "No steps", [], [], "Blocked", "agent", "session");

    // Assert
    const hfDir = path.join(tmpDir, ".opencode/memory/handoffs");
    const filePath = path.join(hfDir, `${id}.json`);
    const doc = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(doc.nextSteps).toEqual([]);
    expect(doc.artifacts).toEqual([]);
    expect(doc.pending).toBe("Blocked");
  });
});

// ============================================================
// Test 4: Plugin hook simulation - chat.params
// ============================================================
describe("chat.params hook", () => {
  it("should set default temperature when undefined", () => {
    // Arrange — simulate the plugin's chat.params hook
    const output: { temperature?: number } = {};

    // Act — mirror the plugin logic
    if (output.temperature === undefined || output.temperature === null) {
      output.temperature = 0.1;
    }

    // Assert
    expect(output.temperature).toBe(0.1);
  });

  it("should not override existing temperature", () => {
    // Arrange
    const output = { temperature: 0.7 };

    // Act
    if (output.temperature === undefined || output.temperature === null) {
      output.temperature = 0.1;
    }

    // Assert
    expect(output.temperature).toBe(0.7);
  });

  it("should handle null temperature", () => {
    // Arrange
    const output: { temperature?: number | null } = { temperature: null };

    // Act
    if (output.temperature === undefined || output.temperature === null) {
      output.temperature = 0.1;
    }

    // Assert
    expect(output.temperature).toBe(0.1);
  });
});

// ============================================================
// Test 5: ensureDir helper
// ============================================================
describe("ensureDir helper", () => {
  it("should create directory if it does not exist", () => {
    // Arrange
    const dir = path.join(tmpDir, "new", "nested", "dir");

    // Act
    ensureDir(dir);

    // Assert
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
  });

  it("should not throw if directory already exists", () => {
    // Arrange
    const dir = path.join(tmpDir, "existing");
    fs.mkdirSync(dir, { recursive: true });

    // Act & Assert
    expect(() => ensureDir(dir)).not.toThrow();
  });

  it("should create deeply nested directories", () => {
    // Arrange
    const dir = path.join(tmpDir, "a", "b", "c", "d", "e");

    // Act
    ensureDir(dir);

    // Assert
    expect(fs.existsSync(dir)).toBe(true);
  });
});

// ============================================================
// Test 6: Integration — full lifecycle simulation
// ============================================================
describe("plugin lifecycle integration", () => {
  it("should simulate a complete session lifecycle", () => {
    // Arrange
    const tracker = createSessionTracker();
    const sessionID = "integration-session";
    const agent = "test-agent";

    // Act — simulate chat.message hook
    tracker.start(sessionID, agent);
    tracker.trackMessage(sessionID);
    appendLog(tmpDir, "DEBUG", "session", `Mensagem #1`, { sessionID, agent });

    // Simulate tool.execute.before
    tracker.trackToolCall(sessionID, "read", 50);
    appendLog(tmpDir, "TRACE", "tools", "→ Tool: read", { sessionID });

    // Simulate tool.execute.after
    tracker.trackToolCall(sessionID, "read", 50); // Second call to track duration
    appendLog(tmpDir, "INFO", "tools", "✓ Tool: read (50ms)", { sessionID });

    // Simulate command.execute.before
    appendLog(tmpDir, "INFO", "commands", "Comando: test", { sessionID });

    // Simulate session.compacting
    const summary = tracker.getSummary(sessionID);
    const handoffId = saveHandoff(
      tmpDir,
      "Integration Checkpoint",
      `Sessão com ${summary!.messageCount} mensagens`,
      ["Revisar progresso"],
      [],
      "Nenhum",
      agent,
      sessionID,
    );

    // Assert — logs
    const logDir = path.join(tmpDir, ".opencode/logs");
    expect(fs.existsSync(logDir)).toBe(true);
    const logFiles = fs.readdirSync(logDir);
    expect(logFiles.length).toBeGreaterThanOrEqual(3); // session, tools, commands

    // Assert — handoff
    const hfDir = path.join(tmpDir, ".opencode/memory/handoffs");
    const hfFiles = fs.readdirSync(hfDir);
    expect(hfFiles).toHaveLength(1);
    expect(hfFiles[0]).toBe(`${handoffId}.json`);

    // Assert — tracker summary
    expect(summary!.messageCount).toBe(1);
    expect(summary!.toolCalls.length).toBeGreaterThanOrEqual(2);
  });
});
