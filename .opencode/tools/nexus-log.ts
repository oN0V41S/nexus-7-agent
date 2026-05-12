import { tool } from "@opencode-ai/plugin/tool";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Nexus Log Tool
 *
 * Structured logging for the harness ecosystem.
 * Writes timestamped, level-prefixed log entries to .opencode/logs/
 * with automatic rotation and categorization.
 */

type LogLevel = "info" | "warn" | "error" | "debug" | "trace";

const LOG_DIR = ".opencode/logs";

function ensureLogDir(baseDir: string): string {
  const dir = path.join(baseDir, LOG_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getLogFile(logDir: string, category: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(logDir, `${category}-${date}.log`);
}

function formatLogEntry(level: LogLevel, message: string, meta: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
}

export default tool({
  description: "Registra eventos estruturados no log do harness Nexus. Usado para observabilidade e debugging do pipeline.",
  args: {
    level: tool.schema
      .enum(["info", "warn", "error", "debug", "trace"])
      .describe("Nível de severidade do log"),
    message: tool.schema
      .string()
      .describe("Mensagem descritiva do evento"),
    category: tool.schema
      .string()
      .default("harness")
      .describe("Categoria para organização (ex: pipeline, tool, agent, session)"),
    metadata: tool.schema
      .string()
      .optional()
      .describe("JSON opcional com metadados estruturados do evento"),
  },
  async execute(args, context) {
    const { level, message, category, metadata } = args;
    const meta = metadata ? JSON.parse(metadata) : {};

    const logDir = ensureLogDir(context.worktree);
    const logFile = getLogFile(logDir, category);

    const entry = formatLogEntry(level, message, {
      ...meta,
      agent: context.agent,
      sessionID: context.sessionID,
    });

    fs.appendFileSync(logFile, entry, "utf-8");

    return JSON.stringify({
      status: "logged",
      level,
      category,
      file: logFile,
      timestamp: new Date().toISOString(),
    });
  },
});
