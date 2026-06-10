/**
 * Tests for FlexEdit interceptor in nexus-plugin.ts
 *
 * The FlexEdit interceptor builds a flexible regex pattern from the
 * LLM-generated oldString to handle whitespace variations (CRLF vs LF,
 * tabs vs spaces, trailing whitespace).
 *
 * Pattern: AAA (Arrange, Act, Assert)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ============================================================
// Extracted regex building logic from the plugin (for testing)
// ============================================================

/**
 * Builds a flexible regex pattern from a model-generated oldString.
 * Handles whitespace variations: CRLF vs LF, tabs vs spaces, trailing whitespace.
 */
function buildFlexEditRegex(modelOldString: string): RegExp {
  const lines = modelOldString.split("\n");
  const parts = lines
    .map((line: string) => {
      const trimmed = line.trim();
      if (trimmed === "") return null;
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const flexInternal = escaped.replace(/[ \t]+/g, "[ \\t]*");
      return `[ \\t]*${flexInternal}[ \\t]*`;
    })
    .filter((p): p is string => p !== null);

  const pattern = parts.join("(?:\\r?\\n)+");
  return new RegExp(pattern, "g");
}

/**
 * Simulates the FlexEdit matching logic from the plugin.
 * Checks short-string length BEFORE exact match to avoid false positives.
 */
function flexEditMatch(
  fileContent: string,
  modelOldString: string,
): { matched: boolean; matchCount: number; matchedText?: string } {
  // Skip very short strings (risk of false positives) — check BEFORE exact match
  if (modelOldString.trim().length < 5) {
    return { matched: false, matchCount: 0 };
  }

  // Skip if exact match exists
  if (fileContent.includes(modelOldString)) {
    return { matched: true, matchCount: 1, matchedText: modelOldString };
  }

  const regex = buildFlexEditRegex(modelOldString);
  const matches = fileContent.match(regex);

  if (!matches) {
    return { matched: false, matchCount: 0 };
  }

  if (matches.length === 1) {
    return { matched: true, matchCount: 1, matchedText: matches[0] };
  }

  return { matched: false, matchCount: matches.length };
}

// ============================================================
// Fixtures
// ============================================================

const SAMPLE_CODE = [
  'function hello() {',
  '  console.log("Hello, world!");',
  '  return 42;',
  '}',
  '',
  'function goodbye() {',
  '  console.log("Goodbye!");',
  '}',
].join("\n");

const SAMPLE_CODE_CRLF = SAMPLE_CODE.replace(/\n/g, "\r\n");
const SAMPLE_CODE_TABS = SAMPLE_CODE.replace(/  /g, "\t");
const SAMPLE_CODE_EXTRA_SPACES = SAMPLE_CODE.replace(/  /g, "    ");

// ============================================================
// Test 1: Exact match (no fix needed)
// ============================================================
describe("FlexEdit - exact match", () => {
  it("should detect exact match without needing regex", () => {
    // Arrange
    const target = '  console.log("Hello, world!");';

    // Act
    const result = flexEditMatch(SAMPLE_CODE, target);

    // Assert
    expect(result.matched).toBe(true);
    expect(result.matchCount).toBe(1);
  });
});

// ============================================================
// Test 2: Whitespace variations (the core fix)
// ============================================================
describe("FlexEdit - whitespace variations", () => {
  it("should match with trailing whitespace in oldString", () => {
    // Arrange — trailing spaces after the line
    const target = '  console.log("Hello, world!");  ';

    // Act
    const result = flexEditMatch(SAMPLE_CODE, target);

    // Assert
    expect(result.matched).toBe(true);
    expect(result.matchCount).toBe(1);
  });

  it("should match with leading whitespace variations", () => {
    // Arrange — extra indentation
    const target = '    console.log("Hello, world!");';

    // Act
    const result = flexEditMatch(SAMPLE_CODE, target);

    // Assert
    expect(result.matched).toBe(true);
    expect(result.matchCount).toBe(1);
  });

  it("should match with tabs instead of spaces", () => {
    // Arrange — oldString uses tabs
    const target = '\tconsole.log("Hello, world!");';

    // Act
    const result = flexEditMatch(SAMPLE_CODE_TABS, target);

    // Assert
    expect(result.matched).toBe(true);
    expect(result.matchCount).toBe(1);
  });

  it("should match multiline with different line endings", () => {
    // Arrange — oldString has LF but file has CRLF
    const target = 'function hello() {\n  console.log("Hello, world!");\n  return 42;\n}';

    // Act
    const result = flexEditMatch(SAMPLE_CODE_CRLF, target);

    // Assert
    expect(result.matched).toBe(true);
    expect(result.matchCount).toBe(1);
  });

  it("should match with different spacing styles", () => {
    // Arrange — oldString with 2-space indent, file with 4-space
    const target = 'function hello() {\n  console.log("Hello, world!");\n  return 42;\n}';

    // Act
    const result = flexEditMatch(SAMPLE_CODE_EXTRA_SPACES, target);

    // Assert
    expect(result.matched).toBe(true);
    expect(result.matchCount).toBe(1);
  });

  it("should match without trailing newline in oldString", () => {
    // Arrange — oldString without trailing newline, file has it
    const target = 'function hello() {\n  console.log("Hello, world!");\n  return 42;\n}';

    // Act — file has trailing newline
    const result = flexEditMatch(SAMPLE_CODE + "\n", target);

    // Assert
    expect(result.matched).toBe(true);
    expect(result.matchCount).toBe(1);
  });
});

// ============================================================
// Test 3: Multiple matches detection
// ============================================================
describe("FlexEdit - multiple matches", () => {
  it("should detect multiple matches and report count", () => {
    // Arrange — a pattern that matches multiple times
    const codeWithRepeats = "someFunction();\nsomeFunction();\nsomeFunction();";
    const target = "someFunction();";

    // Act — exact match path: each line matches exactly
    // For regex path: build the flexible regex and check for multiple matches
    const regex = buildFlexEditRegex(target);
    const matches = codeWithRepeats.match(regex);
    expect(matches!.length).toBeGreaterThan(1);
  });

  it("should handle empty file content", () => {
    // Act
    const result = flexEditMatch("", "sample content here");

    // Assert
    expect(result.matched).toBe(false);
    expect(result.matchCount).toBe(0);
  });
});

// ============================================================
// Test 4: Short string protection
// ============================================================
describe("FlexEdit - short string protection", () => {
  it("should skip strings shorter than 5 chars", () => {
    // Arrange
    const result = flexEditMatch("abc", "a");

    // Assert — "a" is < 5 chars, should skip even though "abc".includes("a") is true
    expect(result.matched).toBe(false);
    expect(result.matchCount).toBe(0);
  });

  it("should skip 4-char strings", () => {
    const result = flexEditMatch("abcd", "abcd");
    expect(result.matched).toBe(false);
    expect(result.matchCount).toBe(0);
  });

  it("should accept 5-char strings", () => {
    const result = flexEditMatch("abcde", "abcde");
    expect(result.matched).toBe(true);
    expect(result.matchCount).toBe(1);
  });
});

// ============================================================
// Test 5: Regex special characters
// ============================================================
describe("FlexEdit - regex special characters", () => {
  it("should escape regex special chars in the pattern", () => {
    // Arrange
    const content = "const regex = /hello.world*/;";
    const target = "const regex = /hello.world*/;";

    // Act
    const result = flexEditMatch(content, target);

    // Assert
    expect(result.matched).toBe(true);
  });

  it("should handle code with dollar signs and parentheses", () => {
    const content = 'const result = $("div.class").val();';
    const target = 'const result = $("div.class").val();';

    const result = flexEditMatch(content, target);
    expect(result.matched).toBe(true);
  });

  it("should handle code with curly braces", () => {
    const content = 'if (true) { return { key: "value" }; }';
    const target = 'if (true) { return { key: "value" }; }';

    const result = flexEditMatch(content, target);
    expect(result.matched).toBe(true);
  });
});

// ============================================================
// Test 6: buildFlexEditRegex direct tests
// ============================================================
describe("buildFlexEditRegex", () => {
  it("should produce a valid regex from a single line", () => {
    const regex = buildFlexEditRegex("hello world");
    expect(regex).toBeInstanceOf(RegExp);
    expect("hello world").toMatch(regex);
  });

  it("should produce a regex matching with flexible whitespace", () => {
    const regex = buildFlexEditRegex("hello world");
    expect("  hello   world  ").toMatch(regex);
  });

  it("should produce a regex matching multiline content", () => {
    const regex = buildFlexEditRegex("line1\nline2");
    expect("line1\nline2").toMatch(regex);
    expect("line1\r\nline2").toMatch(regex);
    expect("  line1\n  line2  ").toMatch(regex);
  });
});

// ============================================================
// Test 7: Edge cases
// ============================================================
describe("FlexEdit - edge cases", () => {
  it("should not match completely different content", () => {
    const content = "completely unrelated content here";
    const target = "something else entirely different";

    const result = flexEditMatch(content, target);
    expect(result.matched).toBe(false);
  });

  it("should match content with no indentation", () => {
    const content = "console.log('test');\nconsole.log('test2');";
    const target = "console.log('test');";

    const result = flexEditMatch(content, target);
    expect(result.matched).toBe(true);
    expect(result.matchedText).toBe("console.log('test');");
  });

  it("should preserve the matched text for replacement", () => {
    // This verifies we can correctly identify what to replace
    const content = "  hello\n  world\n";
    const target = "hello\nworld";

    const result = flexEditMatch(content, target);
    expect(result.matched).toBe(true);
    expect(result.matchedText).toBe("  hello\n  world");
  });
});
