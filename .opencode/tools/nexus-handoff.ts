import { tool } from "@opencode-ai/plugin/tool";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Nexus Handoff Tool
 *
 * Cria documentos de handoff para passar contexto entre sessões ou agentes.
 * Útil quando uma tarefa é longa demais para uma sessão ou precisa ser
 * delegada entre diferentes agentes do ecossistema.
 */

const HANDOFF_DIR = ".opencode/memory/handoffs";

function ensureHandoffDir(baseDir: string): string {
  const dir = path.join(baseDir, HANDOFF_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Safely parses a JSON array string. If parsing fails, treats the string
 * as a single item (or empty/undefined as empty array).
 */
function safeParseArray(input: string | undefined | null): string[] {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed;
    // Valid JSON but not an array — wrap in array
    return [String(parsed)];
  } catch {
    // Not valid JSON — treat as single string item
    return [input.trim()];
  }
}

export default tool({
  description: "Cria e aplica documentos de handoff para passar contexto entre sessões ou agentes do harness Nexus.",
  args: {
    action: tool.schema
      .enum(["create", "apply", "list"])
      .describe("Ação: create (criar handoff), apply (aplicar handoff), list (listar handoffs)"),
    title: tool.schema
      .string()
      .optional()
      .describe("Título do handoff (usado em create)"),
    summary: tool.schema
      .string()
      .optional()
      .describe("Resumo do que foi feito até agora (usado em create)"),
    nextSteps: tool.schema
      .string()
      .optional()
      .describe("Próximos passos planejados (usado em create, JSON array opcional)"),
    artifacts: tool.schema
      .string()
      .optional()
      .describe("Artefatos gerados (paths de arquivos, JSON array opcional)"),
    pending: tool.schema
      .string()
      .optional()
      .describe("Decisões pendentes ou bloqueios (usado em create)"),
    handoffId: tool.schema
      .string()
      .optional()
      .describe("ID do handoff para apply (usado em apply)"),
    syncToMongo: tool.schema
      .string()
      .optional()
      .describe("Sincronizar com MongoDB remoto: 'true' para sync, 'false' para local only"),
    source: tool.schema
      .string()
      .optional()
      .describe("Fonte para list: 'local', 'remote', 'all' (default: 'all')"),
  },
  async execute(args, context) {
    const { action, title, summary, nextSteps, artifacts, pending, handoffId, syncToMongo, source } = args;
    const hfDir = ensureHandoffDir(context.worktree);

    switch (action) {
      case "create": {
        if (!title) throw new Error("title é obrigatório para action=create");

        const id = `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const doc = {
          id,
          title,
          summary: summary || "Sem resumo disponível",
          nextSteps: safeParseArray(nextSteps),
          artifacts: safeParseArray(artifacts),
          pending: pending || "Nenhum",
          createdAt: new Date().toISOString(),
          fromAgent: context.agent,
          fromSession: context.sessionID,
        };

        // Save locally
        const filePath = path.join(hfDir, `${id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), "utf-8");

        // Save to MongoDB if requested
        let remoteSynced = false;
        if (syncToMongo === "true" && process.env.MONGODB_URI) {
          try {
            const { getMongoAdapter } = await import("./mongodb-adapter");
            const adapter = await getMongoAdapter();
            if (adapter && adapter.isConnected()) {
              await adapter.insertOne("handoffs", doc);
              remoteSynced = true;
            }
          } catch (err) {
            console.error("[Handoff] MongoDB sync failed:", err);
          }
        }

        return JSON.stringify({
          status: "created",
          id,
          localId: id,
          remoteSynced,
          instructions: `Para retomar: use nexus-handoff com action=apply e handoffId=${id}`,
          handoff: doc,
        });
      }

      case "apply": {
        if (!handoffId) throw new Error("handoffId é obrigatório para action=apply");

        // Try local first
        const filePath = path.join(hfDir, `${handoffId}.json`);
        if (fs.existsSync(filePath)) {
          const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          return JSON.stringify({
            status: "applied",
            handoff: content,
            source: "local",
            context: `Retomando: ${content.title}\n\nResumo: ${content.summary}\n\nPróximos passos: ${content.nextSteps.join(", ")}\n\nPendências: ${content.pending}`,
          });
        }

        // Try MongoDB
        if (process.env.MONGODB_URI) {
          try {
            const { getMongoAdapter } = await import("./mongodb-adapter");
            const adapter = await getMongoAdapter();
            if (adapter && adapter.isConnected()) {
              const doc = await adapter.findOne("handoffs", { id: handoffId });
              if (doc) {
                return JSON.stringify({
                  status: "applied",
                  handoff: doc,
                  source: "remote",
                  context: `Retomando: ${doc.title}\n\nResumo: ${doc.summary}`,
                });
              }
            }
          } catch (err) {
            console.error("[Handoff] MongoDB load failed:", err);
          }
        }

        return JSON.stringify({
          status: "not_found",
          handoffId,
          message: "Handoff não encontrado. Use list para ver IDs disponíveis.",
        });
      }

      case "list": {
        const handoffs: any[] = [];
        let localCount = 0;
        let remoteCount = 0;

        // Local handoffs
        if (source !== "remote") {
          const files = fs.readdirSync(hfDir).filter((f) => f.endsWith(".json"));
          for (const file of files) {
            try {
              const c = JSON.parse(fs.readFileSync(path.join(hfDir, file), "utf-8"));
              handoffs.push({ ...c, _source: "local" });
              localCount++;
            } catch { /* skip */ }
          }
        }

        // MongoDB handoffs
        if (source !== "local" && process.env.MONGODB_URI) {
          try {
            const { getMongoAdapter } = await import("./mongodb-adapter");
            const adapter = await getMongoAdapter();
            if (adapter && adapter.isConnected()) {
              const remoteHandoffs = await adapter.find("handoffs", {}, { limit: 50, sort: { createdAt: -1 } });
              handoffs.push(...remoteHandoffs.map(h => ({ ...h, _source: "remote" })));
              remoteCount = remoteHandoffs.length;
            }
          } catch (err) {
            console.error("[Handoff] MongoDB list failed:", err);
          }
        }

        // Deduplicate
        const seen = new Set<string>();
        const unique = handoffs.filter(h => {
          if (seen.has(h.id)) return false;
          seen.add(h.id);
          return true;
        });

        return JSON.stringify({
          status: "listed",
          count: unique.length,
          localCount,
          remoteCount,
          handoffs: unique.map(h => ({
            id: h.id,
            title: h.title,
            createdAt: h.createdAt,
            fromAgent: h.fromAgent,
            source: h._source,
            summary: h.summary?.slice(0, 100) + (h.summary?.length > 100 ? "..." : ""),
          })),
        });
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  },
});
