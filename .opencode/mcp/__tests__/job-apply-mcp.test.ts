/**
 * Tests for Job Apply MCP Server
 *
 * Uses jest.mock at module level instead of jest.spyOn because
 * restoreMocks: true calls mockRestore after each test, and jest.spyOn
 * cannot redefine a non-configurable property after mockRestore.
 *
 * jest.mock factories are hoisted and their jest.fn() instances persist
 * across test runs (mockRestore on jest.fn() is equivalent to mockReset).
 */

jest.mock("child_process", () => {
  const mockSpawnSync = jest.fn();
  const mockExecSync = jest.fn();
  return {
    spawnSync: mockSpawnSync,
    execSync: mockExecSync,
  };
});

import * as childProcess from "child_process";

let server: typeof import("../job-apply-mcp");

beforeAll(async () => {
  server = await import("../job-apply-mcp");
});

describe("Job Apply MCP Server", () => {
  // Re-fetch mock reference in beforeEach — restoreMocks resets the mock
  // function's state, but the function itself remains usable.
  let spawnMock: jest.Mock;

  beforeEach(() => {
    spawnMock = childProcess.spawnSync as unknown as jest.Mock;
    spawnMock.mockReturnValue({
      stdout: "",
      stderr: "",
      status: 0,
      pid: 0,
      output: [],
      signal: null,
    } as unknown as childProcess.SpawnSyncReturns<string>);
  });

  describe("Tool Definitions", () => {
    it("should expose all 8 required tools", () => {
      const toolNames = server.TOOLS.map((t: { name: string }) => t.name);
      expect(toolNames).toEqual([
        "job_search",
        "job_analyze",
        "job_consolidate",
        "job_kb",
        "job_adapt",
        "job_apply",
        "job_track",
        "job_check_duplicate",
      ]);
    });

    it("should have required params for job_search", () => {
      const searchTool = server.TOOLS.find((t: { name: string }) => t.name === "job_search");
      expect(searchTool.inputSchema.required).toContain("query");
      expect(searchTool.inputSchema.required).toContain("location");
    });

    it("should have required params for job_consolidate", () => {
      const tool = server.TOOLS.find((t: { name: string }) => t.name === "job_consolidate");
      expect(tool.inputSchema.required).toContain("pdf_paths");
    });

    it("should have required params for job_kb", () => {
      const tool = server.TOOLS.find((t: { name: string }) => t.name === "job_kb");
      expect(tool.inputSchema.required).toContain("file_paths");
    });

    it("should have required params for job_adapt", () => {
      const tool = server.TOOLS.find((t: { name: string }) => t.name === "job_adapt");
      expect(tool.inputSchema.required).toContain("job_id");
    });

    it("should have required params for job_track", () => {
      const tool = server.TOOLS.find((t: { name: string }) => t.name === "job_track");
      expect(tool.inputSchema.required).toContain("action");
    });

    it("should have required params for job_check_duplicate", () => {
      const tool = server.TOOLS.find((t: { name: string }) => t.name === "job_check_duplicate");
      expect(tool.inputSchema.required).toContain("company");
      expect(tool.inputSchema.required).toContain("title");
    });
  });

  describe("sanitizeArg", () => {
    it("should remove shell-dangerous characters", () => {
      expect(server.sanitizeArg("safe")).toBe("safe");
      expect(server.sanitizeArg("a&b")).toBe("ab");
      expect(server.sanitizeArg("a;b")).toBe("ab");
      expect(server.sanitizeArg("a\`b")).toBe("ab");
      expect(server.sanitizeArg(" safe ")).toBe("safe");
    });

    it("should strip argument injection (leading dashes)", () => {
      expect(server.sanitizeArg("--help")).toBe("help");
      expect(server.sanitizeArg("--output /tmp/foo")).toBe("output /tmp/foo");
      expect(server.sanitizeArg("-o")).toBe("o");
      expect(server.sanitizeArg("--json --docx")).toBe("json --docx");  // Only leading dashes stripped
    });

    it("should prevent path traversal", () => {
      expect(server.sanitizeArg("../../etc/passwd")).toBe("etc/passwd");
      expect(server.sanitizeArg("../../../secret")).toBe("secret");
    });

    it("should handle combined attack vectors", () => {
      const result = server.sanitizeArg("--output ../../etc/out");
      expect(result).not.toContain("--");
      expect(result).not.toContain("../");
    });
  });

  describe("Request Handling", () => {
    it("should handle initialize request", () => {
      const handlers = server.createHandlers();
      const result = handlers.initialize({});
      expect(result).toBeDefined();
      expect(result.protocolVersion).toBe("2024-11-05");
      expect(result.serverInfo.name).toBe("job-apply-mcp");
    });

    it("should handle tools/list request", () => {
      const handlers = server.createHandlers();
      const result = handlers["tools/list"]({});
      expect(result.tools.length).toBe(8);
    });

    it("should return error for unknown tool", () => {
      const handlers = server.createHandlers();
      expect(() => {
        handlers["tools/call"]({ name: "unknown_tool", arguments: {} });
      }).toThrow();
    });

    it("should handle subprocess error gracefully", () => {
      spawnMock.mockReturnValueOnce({
        stdout: "",
        stderr: "Python error: module not found",
        status: 1,
      } as unknown as childProcess.SpawnSyncReturns<string>);

      const handlers = server.createHandlers();
      expect(() => {
        handlers["tools/call"]({
          name: "job_search",
          arguments: { query: "test", location: "SP" },
        });
      }).toThrow();
    });
  });

  describe("job_check_duplicate", () => {
    it("should return duplicate result from helper script", () => {
      spawnMock.mockReturnValue({
        stdout: JSON.stringify({ duplicate: true }),
        stderr: "",
        status: 0,
      } as unknown as childProcess.SpawnSyncReturns<string>);

      const handlers = server.createHandlers();
      const result = handlers["tools/call"]({
        name: "job_check_duplicate",
        arguments: { company: "Tech Corp", title: "Software Engineer" },
      });

      expect(result.content[0].text).toContain("duplicate");
      expect(result.content[0].text).toContain("true");
    });

    it("should return false for non-duplicate", () => {
      spawnMock.mockReturnValue({
        stdout: JSON.stringify({ duplicate: false }),
        stderr: "",
        status: 0,
      } as unknown as childProcess.SpawnSyncReturns<string>);

      const handlers = server.createHandlers();
      const result = handlers["tools/call"]({
        name: "job_check_duplicate",
        arguments: { company: "New Corp", title: "New Role" },
      });

      expect(result.content[0].text).toContain('"duplicate": false');
    });
  });

  describe("Tool Call Edge Cases", () => {
    it("should handle tools with no required params gracefully", () => {
      spawnMock.mockReturnValue({
        stdout: JSON.stringify([{ id: "1", company: "Test", title: "Role", score: 85 }]),
        stderr: "",
        status: 0,
      } as unknown as childProcess.SpawnSyncReturns<string>);

      const handlers = server.createHandlers();

      // job_analyze has no required params
      expect(() => {
        handlers["tools/call"]({ name: "job_analyze", arguments: {} });
      }).not.toThrow();
    });

    it("should handle subprocess timeout", () => {
      spawnMock.mockImplementationOnce(() => {
        throw Object.assign(new Error("ETIMEDOUT"), { code: "ETIMEDOUT" });
      });

      const handlers = server.createHandlers();
      expect(() => {
        handlers["tools/call"]({
          name: "job_search",
          arguments: { query: "test", location: "SP" },
        });
      }).toThrow();
    });

    it("should return structured JSON output when possible", () => {
      spawnMock.mockReturnValue({
        stdout: JSON.stringify([{ id: "li-0001", title: "Engineer", company: "Tech" }]),
        stderr: "",
        status: 0,
      } as unknown as childProcess.SpawnSyncReturns<string>);

      const handlers = server.createHandlers();
      const result = handlers["tools/call"]({
        name: "job_search",
        arguments: { query: "engineer", location: "SP" },
      });
      const text = result.content[0].text;
      const parsed = JSON.parse(text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].title).toBe("Engineer");
    });

    it("should handle non-JSON Python output as plain text", () => {
      spawnMock.mockReturnValue({
        stdout: "Resultado salvo em /tmp/output.md\nOperação concluída.",
        stderr: "",
        status: 0,
      } as unknown as childProcess.SpawnSyncReturns<string>);

      const handlers = server.createHandlers();
      const result = handlers["tools/call"]({
        name: "job_kb",
        arguments: { file_paths: "/tmp/resume.pdf" },
      });
      expect(result.content[0].text).toContain("Resultado salvo");
    });
  });
});
