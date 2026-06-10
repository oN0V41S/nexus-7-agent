/**
 * Tests for spec-validator.ts — Pure logic validation functions
 *
 * Covers: extractFrontmatter, extractRequirementIds, extractTestCaseIds,
 *         validateTestToRequirementMapping, validateStatus, validateVersion
 *
 * Pattern: AAA (Arrange, Act, Assert)
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

import specValidatorTool from "../spec-validator";

let tmpDir: string;
let specFile: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spec-validator-test-"));
  specFile = path.join(tmpDir, "test-spec.spec.md");
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

function writeSpec(content: string): void {
  fs.writeFileSync(specFile, content, "utf-8");
}

function joinLines(...lines: string[]): string {
  return lines.join("\n") + "\n";
}

// ============================================================
// Test 1: Basic validation with valid spec
// ============================================================
describe("spec-validator - valid spec", () => {
  it("should validate a complete spec with frontmatter and requirements", async () => {
    // Arrange
    const spec = joinLines(
      '---',
      'title: "Test Spec"',
      'status: draft',
      'version: "1.0.0"',
      '---',
      '# Test Spec',
      '',
      '## Requirements',
      '',
      '### REQ-001: Login',
      'The system must allow user login.',
      '',
      '### REQ-002: Logout',
      'The system must allow user logout.',
      '',
      '## Test Cases',
      '',
      '### CT-001.1: Valid login',
      'Should succeed with correct credentials.',
      '',
      '### CT-002.1: Logout',
      'Should clear session.',
    );
    writeSpec(spec);

    // Act
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: specFile, fix: false },
      ctx,
    );

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("valid");
    expect(parsed.summary.reqCount).toBe(2);
    expect(parsed.summary.tcCount).toBe(2);
    expect(parsed.errors).toHaveLength(0);
  });

  it("should reject unknown status values", async () => {
    const spec = joinLines(
      '---',
      'title: "Bad Status"',
      'status: invalid_status',
      'version: "1.0.0"',
      '---',
      '# Spec',
      'Nothing here.',
    );
    writeSpec(spec);
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: specFile, fix: false },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors.some((e: string) => e.includes("Invalid status"))).toBe(true);
  });

  it("should reject non-semver version", async () => {
    const spec = joinLines(
      '---',
      'title: "Bad Version"',
      'status: draft',
      'version: "abc"',
      '---',
      '# Spec',
      'Nothing here.',
    );
    writeSpec(spec);
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: specFile, fix: false },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.errors.some((e: string) => e.includes("Invalid version"))).toBe(true);
  });

  it("should warn on non-.md file extension", async () => {
    const spec = joinLines(
      '---',
      'title: "Bad Ext"',
      'status: draft',
      'version: "1.0.0"',
      '---',
      '# Spec',
    );
    const badFile = path.join(tmpDir, "test.txt");
    fs.writeFileSync(badFile, spec, "utf-8");

    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: badFile, fix: false },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.warnings.some((w: string) => w.includes('File extension is "'))).toBe(true);
  });
});

// ============================================================
// Test 2: Missing fields
// ============================================================
describe("spec-validator - missing fields", () => {
  it("should report missing title", async () => {
    const spec = joinLines(
      '---',
      'status: draft',
      'version: "1.0.0"',
      '---',
      '# Spec',
    );
    writeSpec(spec);
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: specFile, fix: false },
      ctx,
    );
    const parsed = JSON.parse(result);
    expect(parsed.errors.some((e: string) => e.includes("title"))).toBe(true);
  });

  it("should report missing status", async () => {
    const spec = joinLines(
      '---',
      'title: "No Status"',
      'version: "1.0.0"',
      '---',
      '# Spec',
    );
    writeSpec(spec);
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: specFile, fix: false },
      ctx,
    );
    const parsed = JSON.parse(result);
    expect(parsed.errors.some((e: string) => e.includes("status"))).toBe(true);
  });

  it("should report missing version", async () => {
    const spec = joinLines(
      '---',
      'title: "No Version"',
      'status: draft',
      '---',
      '# Spec',
    );
    writeSpec(spec);
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: specFile, fix: false },
      ctx,
    );
    const parsed = JSON.parse(result);
    expect(parsed.errors.some((e: string) => e.includes("version"))).toBe(true);
  });
});

// ============================================================
// Test 3: CT to REQ mapping validation
// ============================================================
describe("spec-validator - CT to REQ mapping", () => {
  it("should detect orphan test cases (CT without matching REQ)", async () => {
    // REQ-001 exists but CT-999.1 implies REQ-999 which is not present.
    // Important: do NOT mention "REQ-999" in the description text, as it
    // would be extracted and falsely satisfy the mapping.
    const spec = joinLines(
      '---',
      'title: "Orphan Test"',
      'status: draft',
      'version: "1.0.0"',
      '---',
      '# Spec',
      '',
      '## Requirements',
      '',
      '### REQ-001: Something',
      'A requirement.',
      '',
      '## Test Cases',
      '',
      '### CT-999.1: Orphan test',
      'This test has an orphan CT number without a matching section.',
    );
    writeSpec(spec);
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: specFile, fix: false },
      ctx,
    );

    const parsed = JSON.parse(result);
    // Should detect that CT-999.1 references REQ-999 which is missing
    expect(parsed.errors.some((e: string) => e.includes("CT-999.1"))).toBe(true);
  });

  it("should pass with valid CT to REQ mapping", async () => {
    const spec = joinLines(
      '---',
      'title: "Valid Mapping"',
      'status: draft',
      'version: "1.0.0"',
      '---',
      '# Spec',
      '',
      '## Requirements',
      '',
      '### REQ-001: Feature A',
      'Desc.',
      '',
      '### REQ-002: Feature B',
      'Desc.',
      '',
      '## Test Cases',
      '',
      '### CT-001.1: Test A1',
      'Test for REQ-001.',
      '',
      '### CT-001.2: Test A2',
      'Another test for REQ-001.',
      '',
      '### CT-002.1: Test B1',
      'Test for REQ-002.',
    );
    writeSpec(spec);
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: specFile, fix: false },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.summary.reqCount).toBe(2);
    expect(parsed.summary.tcCount).toBe(3);
  });
});

// ============================================================
// Test 4: File not found and edge cases
// ============================================================
describe("spec-validator - edge cases", () => {
  it("should handle file not found", async () => {
    const missingFile = path.join(tmpDir, "nonexistent.md");
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: missingFile, fix: false },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("error");
    expect(parsed.errors.some((e: string) => e.includes("not found"))).toBe(true);
  });

  it("should handle approved status with no REQ IDs as error", async () => {
    const spec = joinLines(
      '---',
      'title: "Approved but Empty"',
      'status: approved',
      'version: "1.0.0"',
      '---',
      '# Spec',
      'No requirements defined.',
    );
    writeSpec(spec);
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: specFile, fix: false },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.errors.some((e: string) => e.includes("approved") && e.includes("REQ"))).toBe(true);
  });

  it("should handle empty file content", async () => {
    writeSpec("");
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: specFile, fix: false },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it("should handle fix mode (update updated field)", async () => {
    const spec = joinLines(
      '---',
      'title: "Fixable Spec"',
      'status: draft',
      'version: "1.0.0"',
      '---',
      '# Spec',
      'Nothing here.',
    );
    writeSpec(spec);
    const ctx = createContext();
    const result = await specValidatorTool.execute(
      { filePath: specFile, fix: true },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("valid");
  });
});
