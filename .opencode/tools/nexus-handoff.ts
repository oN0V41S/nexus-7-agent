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
  },
  async execute(args, context) {
    const { action, title, summary, nextSteps, artifacts, pending, handoffId } = args;
    const hfDir = ensureHandoffDir(context.worktree);

    switch (action) {
      case "create": {
        if (!title) throw new Error("title é obrigatório para action=create");

        const id = `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const doc = {
          id,
          title,
          summary: summary || "Sem resumo disponível",
          nextSteps: nextSteps ? JSON.parse(nextSteps) : [],
          artifacts: artifacts ? JSON.parse(artifacts) : [],
          pending: pending || "Nenhum",
          createdAt: new Date().toISOString(),
          fromAgent: context.agent,
          fromSession: context.sessionID,
        };

        const filePath = path.join(hfDir, `${id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), "utf-8");

        return JSON.stringify({
          status: "created",
          id,
          instructions: `Para retomar: use nexus-handoff com action=apply e handoffId=${id}`,
          handoff: doc,
        });
      }

      case "apply": {
        if (!handoffId) throw new Error("handoffId é obrigatório para action=apply");

        const filePath = path.join(hfDir, `${handoffId}.json`);
        if (!fs.existsSync(filePath)) {
          return JSON.stringify({
            status: "not_found",
            handoffId,
            message: "Handoff não encontrado. Use list para ver IDs disponíveis.",
          });
        }

        const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return JSON.stringify({
          status: "applied",
          handoff: content,
          context: `Retomando: ${content.title}\n\nResumo: ${content.summary}\n\nPróximos passos: ${content.nextSteps.join(", ")}\n\nPendências: ${content.pending}`,
        });
      }

      case "list": {
        const files = fs.readdirSync(hfDir).filter((f) => f.endsWith(".json"));
        const handoffs = files.map((f) => {
          const c = JSON.parse(fs.readFileSync(path.join(hfDir, f), "utf-8"));
          return {
            id: c.id,
            title: c.title,
            createdAt: c.createdAt,
            fromAgent: c.fromAgent,
            summary: c.summary.slice(0, 100) + (c.summary.length > 100 ? "..." : ""),
          };
        });

        return JSON.stringify({
          status: "listed",
          count: handoffs.length,
          handoffs,
        });
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  },
});
