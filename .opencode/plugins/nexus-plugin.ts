/**
 * Nexus Plugin — Observability & Lifecycle Hooks v2
 *
 * Camada 2 do ecossistema Nexus 7 Agent.
 * Inspirado pelo modelo de lifecycle hooks do claude-mem e ECC.
 *
 * Hooks implementados:
 * - tool.execute.before → logging + timed execution
 * - tool.execute.after  → auto-observação + métricas
 * - command.execute.before → logging de comandos
 * - chat.message        → rastreamento de sessão
 * - experimental.session.compacting → contexto + auto-handoff
 * - permission.ask      → registro de permissões
 * - chat.params         → tuning de parâmetros por agente
 */

import type { Plugin } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================
// Helpers
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

function saveMemory(
  worktree: string,
  key: string,
  value: unknown,
  scope: string,
  agent: string,
  sessionID: string,
): void {
  const memDir = path.join(worktree, ".opencode/memory");
  ensureDir(memDir);
  const entry = {
    key,
    scope,
    value,
    savedAt: new Date().toISOString(),
    agent,
    sessionID,
  };
  const filePath = path.join(memDir, `${scope}--${key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
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

// ============================================================
// Session tracker (stateful within process lifetime)
// ============================================================

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

// ============================================================
// Plugin
// ============================================================

const NexusPlugin: Plugin = async (ctx) => {
  const worktree = ctx.worktree;
  const tracker = createSessionTracker();

  appendLog(worktree, "INFO", "plugin", "Nexus Plugin v2 iniciado", {
    directory: ctx.directory,
  });

  return {
    // ============================================================
    // Sessão: rastreamento de mensagens (proxy de SessionStart)
    // ============================================================

    "chat.message": async (input, output) => {
      // Inicializa sessão se nova
      tracker.start(input.sessionID, input.agent || "unknown");

      // Conta mensagens
      tracker.trackMessage(input.sessionID);

      appendLog(worktree, "DEBUG", "session", `Mensagem #${tracker.getSummary(input.sessionID)?.messageCount || "?"}`, {
        sessionID: input.sessionID,
        agent: input.agent,
        messageID: input.messageID,
        partsCount: output.parts?.length || 0,
      });
    },

    // ============================================================
    // Ferramentas: timed execution + auto-observação
    // ============================================================

    "tool.execute.before": async (input, _output) => {
      tracker.start(input.sessionID, "unknown");
      appendLog(worktree, "TRACE", "tools", `→ Tool: ${input.tool}`, {
        sessionID: input.sessionID,
        callID: input.callID,
      });
    },

    "tool.execute.after": async (input, output) => {
      // Métricas
      const summary = tracker.getSummary(input.sessionID);
      if (summary) {
        const allCalls = summary.toolCalls;
        const lastCall = allCalls.length > 0 ? allCalls[allCalls.length - 1] : null;
        const duration = lastCall ? lastCall.duration : 0;

        appendLog(worktree, "INFO", "tools", `✓ Tool: ${input.tool} (${duration}ms)`, {
          sessionID: input.sessionID,
          callID: input.callID,
          title: output.title,
          outputSize: output.output?.length || 0,
        });

        // Auto-observação: salva na memória chamadas de ferramentas relevantes
        const relevantTools = ["write", "edit", "bash", "task", "skill"];
        if (relevantTools.includes(input.tool) && output.title) {
          saveMemory(
            worktree,
            `tool-${input.callID}`,
            {
              type: "tool_observation",
              tool: input.tool,
              title: output.title,
              outputSize: output.output?.length || 0,
              sessionID: input.sessionID,
            },
            "observations",
            input.agent || "plugin",
            input.sessionID,
          );
        }
      }
    },

    // ============================================================
    // Comandos
    // ============================================================

    "command.execute.before": async (input, _output) => {
      appendLog(worktree, "INFO", "commands", `Comando: ${input.command}`, {
        sessionID: input.sessionID,
        arguments: input.arguments,
      });

      // Auto-handoff em /pipeline
      if (input.command === "pipeline") {
        saveHandoff(
          worktree,
          `Pipeline iniciado: ${input.arguments}`,
          `Iniciando pipeline harness para: ${input.arguments}`,
          ["PLAN → análise de requisitos"],
          [],
          "Aguardando conclusão do pipeline",
          "orchestrator",
          input.sessionID,
        );
      }
    },

    // ============================================================
    // Compaction: contexto + auto-handoff
    // ============================================================

    "experimental.session.compacting": async (input, output) => {
      const summary = tracker.getSummary(input.sessionID);

      // Contexto do harness
      output.context.push(
        "[Nexus Harness] Projeto usa harness de 6 estágios: SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT.",
      );
      output.context.push(
        "[Nexus Harness] Sub-agents: @security-secret-auditor, @quality-assurance-analyst, @docs-architect.",
      );
      output.context.push(
        "[Nexus Harness] Tools: nexus-log (log), nexus-memory (memória), nexus-handoff (handoff).",
      );
      output.context.push(
        "[Nexus Harness] Use /pipeline para ciclo completo, /commit-&-docs para commit com docs.",
      );

      if (summary) {
        output.context.push(
          `[Nexus Sessão] ${summary.messageCount} mensagens, ${summary.toolCalls.length} ferramentas executadas.`,
        );

        // Auto-handoff: salva estado da sessão ao compactar
        const recentTools = summary.toolCalls.slice(-5).map((t) => t.tool);
        const handoffId = saveHandoff(
          worktree,
          `Checkpoint automático - ${new Date().toLocaleString()}`,
          `Sessão com ${summary.messageCount} mensagens e ${summary.toolCalls.length} tools. Ferramentas recentes: ${recentTools.join(", ")}`,
          ["Revisar progresso e continuar"],
          [],
          "Nenhum",
          summary.agent,
          input.sessionID,
        );

        output.context.push(
          `[Nexus Handoff] Handoff automático salvo: ${handoffId}. Use nexus-handoff action=apply handoffId=${handoffId} para retomar.`,
        );

        appendLog(worktree, "INFO", "session", `Sessão compactada - handoff: ${handoffId}`, {
          sessionID: input.sessionID,
          messageCount: summary.messageCount,
          toolCallCount: summary.toolCalls.length,
        });
      }
    },

    // ============================================================
    // Permissões
    // ============================================================

    "permission.ask": async (input, _output) => {
      appendLog(worktree, "WARN", "permissions", `Permissão: ${input.permission}`, {
        patterns: input.patterns,
        always: input.always,
      });
    },

    // ============================================================
    // Parâmetros do modelo (tuning por agente)
    // ============================================================

    "chat.params": async (_input, output) => {
      // Garante temperatura padrão para o orquestrador
      if (output.temperature === undefined || output.temperature === null) {
        output.temperature = 0.1;
      }
    },
  };
};

export default NexusPlugin;
