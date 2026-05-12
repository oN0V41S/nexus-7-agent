import { tool } from "@opencode-ai/plugin/tool";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Nexus Memory Tool
 *
 * Persistência simples de contexto entre sessões.
 * Armazena pares chave-valor em .opencode/memory/ como arquivos JSON.
 * Permite salvar contexto de uma sessão e recuperá-lo em outra.
 */

const MEMORY_DIR = ".opencode/memory";

function ensureMemoryDir(baseDir: string): string {
  const dir = path.join(baseDir, MEMORY_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export default tool({
  description: "Persiste e recupera contexto entre sessões do harness Nexus. Memória chave-valor em .opencode/memory/.",
  args: {
    action: tool.schema
      .enum(["save", "load", "list", "delete", "search"])
      .describe("Ação: save (salvar), load (carregar), list (listar chaves), delete (remover), search (buscar texto)"),
    key: tool.schema
      .string()
      .optional()
      .describe("Chave única para o dado (usada em save/load/delete)"),
    value: tool.schema
      .string()
      .optional()
      .describe("Valor JSON para persistir (usado em save)"),
    scope: tool.schema
      .string()
      .default("session")
      .describe("Escopo: 'session' (vida curta), 'project' (vida longa), 'agent' (por agente)"),
    query: tool.schema
      .string()
      .optional()
      .describe("Termo de busca textual (usado em action=search)"),
    limit: tool.schema
      .number()
      .default(10)
      .describe("Limite de resultados (usado em search e list)"),
  },
  async execute(args, context) {
    const { action, key, value, scope, query, limit } = args;
    const memDir = ensureMemoryDir(context.worktree);

    switch (action) {
      case "save": {
        if (!key) throw new Error("key é obrigatório para action=save");
        if (!value) throw new Error("value é obrigatório para action=save");

        const entry = {
          key,
          scope,
          value: JSON.parse(value),
          savedAt: new Date().toISOString(),
          agent: context.agent,
          sessionID: context.sessionID,
        };

        const filePath = path.join(memDir, `${scope}--${key}.json`);
        fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");

        return JSON.stringify({
          status: "saved",
          key,
          scope,
          file: filePath,
        });
      }

      case "load": {
        if (!key) throw new Error("key é obrigatório para action=load");

        const filePath = path.join(memDir, `${scope}--${key}.json`);
        if (!fs.existsSync(filePath)) {
          return JSON.stringify({
            status: "not_found",
            key,
            scope,
            message: "Nenhum dado encontrado para esta chave/escopo",
          });
        }

        const content = fs.readFileSync(filePath, "utf-8");
        return JSON.stringify({
          status: "loaded",
          key,
          scope,
          data: JSON.parse(content),
        });
      }

      case "search": {
        if (!query) throw new Error("query é obrigatório para action=search");

        const files = fs.readdirSync(memDir).filter((f) => f.endsWith(".json"));
        const lowerQuery = query.toLowerCase();
        const results = files
          .map((f) => {
            try {
              const content = JSON.parse(fs.readFileSync(path.join(memDir, f), "utf-8"));
              const searchableText = JSON.stringify(content).toLowerCase();
              const score = searchableText.includes(lowerQuery)
                ? (searchableText.match(new RegExp(lowerQuery, "g")) || []).length
                : 0;
              return { file: f, score, entry: content };
            } catch {
              return null;
            }
          })
          .filter((r): r is NonNullable<typeof r> => r !== null && r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

        return JSON.stringify({
          status: "searched",
          query,
          count: results.length,
          results: results.map((r) => ({
            key: r.entry.key,
            scope: r.entry.scope,
            savedAt: r.entry.savedAt,
            agent: r.entry.agent,
            summary:
              typeof r.entry.value === "object" && r.entry.value !== null
                ? JSON.stringify(r.entry.value).slice(0, 200)
                : String(r.entry.value).slice(0, 200),
            score: r.score,
          })),
        });
      }

      case "list": {
        const files = fs.readdirSync(memDir).filter((f) => f.endsWith(".json"));
        const entries = files.map((f) => {
          const content = JSON.parse(fs.readFileSync(path.join(memDir, f), "utf-8"));
          return {
            key: content.key,
            scope: content.scope,
            savedAt: content.savedAt,
            agent: content.agent,
          };
        });
        return JSON.stringify({
          status: "listed",
          count: entries.length,
          totalFiles: files.length,
          entries: entries.slice(0, limit),
        });
      }

      case "delete": {
        if (!key) throw new Error("key é obrigatório para action=delete");

        const filePath = path.join(memDir, `${scope}--${key}.json`);
        if (!fs.existsSync(filePath)) {
          return JSON.stringify({
            status: "not_found",
            key,
            scope,
          });
        }

        fs.unlinkSync(filePath);
        return JSON.stringify({
          status: "deleted",
          key,
          scope,
        });
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  },
});
