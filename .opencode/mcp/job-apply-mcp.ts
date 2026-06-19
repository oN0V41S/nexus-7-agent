/**
 * Job Apply Agent — MCP Server
 *
 * Expõe as operações do Job Application Workflow como tools MCP.
 * Protocolo: stdio (JSON-RPC sobre stdin/stdout)
 *
 * Ferramentas expostas:
 * - job_search          → Busca vagas em múltiplas plataformas
 * - job_analyze         → Calcula match score (0-100%)
 * - job_consolidate     → Consolida PDFs em DOCX + PDF + KB
 * - job_kb              → Gera Knowledge Base .md do candidato
 * - job_adapt           → Gera currículo adaptado + carta
 * - job_apply           → Executa aplicação semiautomática
 * - job_track           → Gerencia histórico de candidaturas
 * - job_check_duplicate → Verifica duplicidade de candidatura
 */

import { spawnSync, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// Types
// ============================================================

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ToolProperty {
  type: string;
  description: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, ToolProperty>;
    required?: string[];
  };
}

// ============================================================
// Tool Definitions
// ============================================================

export const TOOLS: ToolDefinition[] = [
  {
    name: "job_search",
    description: "Busca vagas em múltiplas plataformas (LinkedIn, Glassdoor, Indeed, Monster)",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo de busca (ex: 'engenheiro de software')" },
        location: { type: "string", description: "Localização (ex: 'São Paulo')" },
        filters: { type: "string", description: "Filtros adicionais (opcional)" },
      },
      required: ["query", "location"],
    },
  },
  {
    name: "job_analyze",
    description: "Calcula match score entre perfil do candidato e vagas encontradas",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "ID da vaga específica para analisar (opcional — analisa todas se omitido)" },
      },
    },
  },
  {
    name: "job_consolidate",
    description: "Consolida PDFs de currículo em DOCX padronizado + PDF + Knowledge Base",
    inputSchema: {
      type: "object",
      properties: {
        pdf_paths: { type: "string", description: "Caminhos dos PDFs separados por espaço" },
        output_dir: { type: "string", description: "Diretório de saída (opcional)" },
      },
      required: ["pdf_paths"],
    },
  },
  {
    name: "job_kb",
    description: "Gera Knowledge Base .md completa do candidato a partir de PDFs ou DOCX",
    inputSchema: {
      type: "object",
      properties: {
        file_paths: { type: "string", description: "Caminhos dos arquivos separados por espaço" },
        json_flag: { type: "boolean", description: "Gerar também profile.json" },
        docx_flag: { type: "boolean", description: "Gerar também DOCX" },
        output_dir: { type: "string", description: "Diretório de saída (opcional)" },
      },
      required: ["file_paths"],
    },
  },
  {
    name: "job_adapt",
    description: "Gera currículo adaptado à vaga (DOCX + MD) e carta de apresentação (TXT)",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "ID da vaga alvo" },
      },
      required: ["job_id"],
    },
  },
  {
    name: "job_apply",
    description: "Executa aplicação semiautomática para uma vaga (requer aprovação humana)",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "ID da vaga para aplicar" },
        batch_threshold: { type: "number", description: "Se definido, aplica em lote para vagas com score >= threshold" },
      },
    },
  },
  {
    name: "job_track",
    description: "Gerencia o histórico de candidaturas: listar, exportar, atualizar status",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Ação: 'list', 'export', 'update'" },
        format: { type: "string", description: "Formato de exportação: 'csv' ou 'json' (apenas para action=export)" },
        job_id: { type: "string", description: "ID da candidatura para atualizar (apenas para action=update)" },
        status: {
          type: "string",
          description: "Novo status: applied, reviewing, interview, offer, rejected, accepted, ghosted, withdrawn",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "job_check_duplicate",
    description: "Verifica se já existe candidatura para empresa + vaga (evita duplicatas)",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string", description: "Nome da empresa" },
        title: { type: "string", description: "Título da vaga" },
      },
      required: ["company", "title"],
    },
  },
];

// ============================================================
// Python Subprocess Wrapper
// ============================================================

const PROJECT_ROOT = path.resolve(__dirname, "../..");

export function sanitizeArg(arg: string): string {
  // Remove shell-dangerous characters and protect against argument injection
  // spawnSync without shell:true does not expand shell chars, but we must
  // prevent --flag injection and path traversal via file path params
  return arg
    .replace(/^--?/, "")                           // Remove leading dashes (argument injection)
    .replace(/[;&|`$(){}[\]!#~*?\\\n\r\0]/g, "")  // Remove dangerous chars + null byte
    .replace(/\.\.\//g, "")                        // Remove path traversal ../
    .replace(/\.\.\\/g, "")                        // Remove path traversal ..\\ (Windows)
    .trim();
}

function buildArgs(toolName: string, params: Record<string, unknown>): string[] {
  const args: string[] = [];

  switch (toolName) {
    case "job_search":
      args.push(sanitizeArg(String(params.query)));
      args.push(sanitizeArg(String(params.location)));
      if (params.filters) args.push(sanitizeArg(String(params.filters)));
      break;
    case "job_analyze":
      if (params.job_id) args.push(sanitizeArg(String(params.job_id)));
      break;
    case "job_consolidate":
      (String(params.pdf_paths).split(/\s+/)).forEach((p) => args.push(sanitizeArg(p)));
      if (params.output_dir) { args.push("--output"); args.push(sanitizeArg(String(params.output_dir))); }
      break;
    case "job_kb":
      (String(params.file_paths).split(/\s+/)).forEach((p) => args.push(sanitizeArg(p)));
      if (params.json_flag) args.push("--json");
      if (params.docx_flag) args.push("--docx");
      if (params.output_dir) { args.push("--output"); args.push(sanitizeArg(String(params.output_dir))); }
      break;
    case "job_adapt":
      args.push(sanitizeArg(String(params.job_id)));
      break;
    case "job_apply":
      if (params.batch_threshold != null) {
        args.push("--batch");
        args.push(String(params.batch_threshold));
      } else if (params.job_id) {
        args.push(sanitizeArg(String(params.job_id)));
      }
      break;
    case "job_track":
      args.push(sanitizeArg(String(params.action)));
      if (params.format) args.push(sanitizeArg(String(params.format)));
      if (params.job_id) args.push(sanitizeArg(String(params.job_id)));
      if (params.status) args.push(sanitizeArg(String(params.status)));
      break;
  }

  return args;
}

function getPythonCommand(): string {
  try {
    execSync("python3 --version", { stdio: "ignore" });
    return "python3";
  } catch {
    try {
      execSync("python --version", { stdio: "ignore" });
      return "python";
    } catch {
      return "python3"; // default, will fail with clear error
    }
  }
}

function runPythonSubprocess(
  toolName: string,
  params: Record<string, unknown>,
  timeoutMs = 120_000,
): { stdout: string; stderr: string; status: number | null } {
  const python = getPythonCommand();
  let args: string[];

  if (toolName === "job_check_duplicate") {
    // Special: use helper script — no main.py command exists for dedup
    const scriptPath = path.join(PROJECT_ROOT, "scripts", "job_check_duplicate.py");
    args = [scriptPath, sanitizeArg(String(params.company)), sanitizeArg(String(params.title))];
  } else {
    const toolToCommand: Record<string, string> = {
      job_search: "search",
      job_analyze: "analyze",
      job_consolidate: "consolidate",
      job_kb: "kb",
      job_adapt: "adapt",
      job_apply: "apply",
      job_track: "track",
    };
    const mainCmd = toolToCommand[toolName];
    args = ["-m", "src.job_apply_agent", mainCmd, ...buildArgs(toolName, params)];
  }

  const result = spawnSync(python, args, {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    timeout: timeoutMs,
    // Only forward necessary env vars (avoid leaking credentials to subprocess)
    env: {
      PYTHONPATH: path.join(PROJECT_ROOT, "src"),
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_PATH: process.env.NODE_PATH,
      LANG: process.env.LANG,
      LC_ALL: process.env.LC_ALL,
    },
  });

  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status,
  };
}

// ============================================================
// JSON-RPC Handlers
// ============================================================

export function createHandlers() {
  return {
    initialize: (_params: unknown) => ({
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "job-apply-mcp",
        version: "0.1.0",
      },
    }),
    "tools/list": (_params: unknown) => ({
      tools: TOOLS,
    }),
    "tools/call": (params: Record<string, unknown>) => {
      const name = params?.name as string;
      const args = (params?.arguments || {}) as Record<string, unknown>;

      const toolDef = TOOLS.find((t) => t.name === name);
      if (!toolDef) {
        throw { code: -32601, message: `Tool not found: ${name}` };
      }

      const { stdout, stderr, status } = runPythonSubprocess(name, args);

      // Non-zero exit with no stdout means Python error
      if (status !== 0 && !stdout) {
        const sanitizedStderr = stderr.replace(PROJECT_ROOT, "[PROJECT_ROOT]");
        throw {
          code: -32000,
          message: `Python exited with code ${status}: ${sanitizedStderr.slice(0, 500)}`,
          data: { stderr: sanitizedStderr.slice(0, 1000) },
        };
      }

      // If we have stderr but no stdout, it's an error
      if (stderr && !stdout) {
        const sanitizedStderr = stderr.replace(PROJECT_ROOT, "[PROJECT_ROOT]");
        throw {
          code: -32000,
          message: `Python error: ${sanitizedStderr.slice(0, 500)}`,
          data: { stderr: sanitizedStderr.slice(0, 1000) },
        };
      }

      // Try to parse stdout as JSON
      try {
        const parsed = JSON.parse(stdout);
        return { content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }] };
      } catch {
        // Return as plain text
        return { content: [{ type: "text", text: stdout || stderr || "(empty output)" }] };
      }
    },
  };
}

// ============================================================
// JSON-RPC Communication
// ============================================================

function sendResponse(id: string | number | null, result: unknown) {
  const response: JsonRpcResponse = { jsonrpc: "2.0", id, result };
  process.stdout.write(JSON.stringify(response) + "\n");
}

function sendError(id: string | number | null, code: number, message: string, data?: unknown) {
  const response: JsonRpcResponse = { jsonrpc: "2.0", id, error: { code, message, data } };
  process.stdout.write(JSON.stringify(response) + "\n");
}

// ============================================================
// Main Loop
// ============================================================

const handlers = createHandlers();

let buffer = "";
process.stdin.on("data", (chunk: Buffer) => {
  buffer += chunk.toString();

  const lines = buffer.split("\n");
  // Keep incomplete last line in buffer
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line);
    } catch {
      sendError(null, -32700, "Parse error");
      continue;
    }

    // Handle initialize
    if (request.method === "initialize") {
      const result = handlers.initialize(request.params || {});
      sendResponse(request.id, result);
      continue;
    }

    // Handle notifications/initialized (no response needed)
    if (request.method === "notifications/initialized") {
      continue;
    }

    // Handle tools/list
    if (request.method === "tools/list") {
      const result = handlers["tools/list"](request.params || {});
      sendResponse(request.id, result);
      continue;
    }

    // Handle tools/call
    if (request.method === "tools/call") {
      try {
        const result = handlers["tools/call"](request.params || {});
        sendResponse(request.id, result);
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string; data?: unknown };
        sendError(
          request.id,
          error.code || -32603,
          error.message || "Internal error",
          error.data,
        );
      }
      continue;
    }

    // Unknown method
    sendError(request.id, -32601, `Method not found: ${request.method}`);
  }
});

process.stdin.on("end", () => {
  // Graceful shutdown
});
