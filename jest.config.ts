import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
        diagnostics: false,
      },
    ],
  },
  roots: ["<rootDir>"],
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/__tests__/**/*.spec.ts",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@opencode-ai/plugin/tool$": "<rootDir>/__mocks__/@opencode-ai/plugin/tool.ts",
  },
  clearMocks: true,
  restoreMocks: true,
  resetModules: true,
  collectCoverageFrom: [
    ".opencode/tools/**/*.ts",
    ".opencode/plugins/**/*.ts",
    ".opencode/mcp/**/*.ts",
    "!**/node_modules/**",
    "!**/__mocks__/**",
    "!**/__tests__/**",
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
    // Per-file thresholds for fixed/active files
    ".opencode/tools/nexus-handoff.ts": {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    ".opencode/tools/nexus-log.ts": {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    ".opencode/tools/nexus-memory.ts": {
      branches: 50,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    ".opencode/tools/spec-validator.ts": {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};

export default config;
