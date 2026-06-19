/**
 * Nexus Plugin — Observability & Lifecycle Hooks v4
 *
 * Camada 2 do ecossistema Nexus 7 Agent.
 *
 * v4: Integração completa dos módulos de otimização:
 * - ContextManager (REQ-001): Gerenciamento de contexto
 * - CacheManager (REQ-003): Cache de respostas
 * - MetricsCollector (REQ-004): Métricas e monitoramento
 *
 * Hooks:
 * - tool.execute.before → logging + timed execution + FlexEdit
 * - tool.execute.after  → auto-observação + métricas (REQ-004)
 * - command.execute.before → logging de comandos
 * - chat.message        → rastreamento + context tracking (REQ-001)
 * - experimental.session.compacting → contexto otimizado + auto-handoff
 * - permission.ask      → registro de permissões
 * - chat.params         → tuning de parâmetros por agente
 */

import type { Plugin } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import { ContextManager } from "./context-manager";
import { CacheManager } from "./cache-manager";
import { MetricsCollector } from "./metrics-collector";

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
  const contextManager = new ContextManager(worktree);
  const cacheManager = new CacheManager(worktree);
  const metrics = new MetricsCollector(worktree);

  // Load cache from disk
  cacheManager.load();

  appendLog(worktree, "INFO", "plugin", "Nexus Plugin v4 iniciado (ContextManager + Cache + Metrics)", {
    directory: ctx.directory,
  });

  return {
    // ============================================================
    // Sessão: rastreamento de mensagens + context tracking
    // ============================================================

    "chat.message": async (input, output) => {
      // Inicializa sessão se nova
      tracker.start(input.sessionID, input.agent || "unknown");

      // Conta mensagens
      tracker.trackMessage(input.sessionID);

      // REQ-001: Track message in ContextManager
      const content = output.parts?.map((p: any) => p.text || "").join("") || "";
      const toolCalls = output.parts
        ?.filter((p: any) => p.type === "tool-invocation")
        .map((p: any) => p.toolInvocation?.toolName || "unknown") || [];
      
      contextManager.trackMessage(
        input.sessionID,
        "assistant",
        content,
        toolCalls,
      );

      appendLog(worktree, "DEBUG", "session", `Mensagem #${tracker.getSummary(input.sessionID)?.messageCount || "?"}`, {
        sessionID: input.sessionID,
        agent: input.agent,
        messageID: input.messageID,
        partsCount: output.parts?.length || 0,
      });
    },

    // ============================================================
    // Ferramentas: timed execution + auto-observação + métricas
    // ============================================================

    "tool.execute.before": async (input, _output) => {
      tracker.start(input.sessionID, "unknown");
      appendLog(worktree, "TRACE", "tools", `→ Tool: ${input.tool}`, {
        sessionID: input.sessionID,
        callID: input.callID,
      });

      // =============================================================
      // FlexEdit: flexible matching for the edit tool
      // =============================================================

      if (input.tool === "edit") {
        const args = input.arguments as { filePath?: string; oldString?: string; newString?: string };
        const filePathArg = args.filePath;
        const modelOldString = args.oldString;

        if (filePathArg && modelOldString) {
          try {
            const resolvedPath = path.isAbsolute(filePathArg)
              ? filePathArg
              : path.join(worktree, filePathArg);

            if (!fs.existsSync(resolvedPath)) {
              appendLog(worktree, "WARN", "plugin", "FlexEdit: file not found", {
                filePath: filePathArg,
                resolvedPath,
              });
            } else {
              const content = fs.readFileSync(resolvedPath, "utf-8");

              if (!content.includes(modelOldString)) {
                if (modelOldString.trim().length < 5) {
                  appendLog(worktree, "WARN", "plugin", "FlexEdit: oldString too short, skipping", {
                    oldString: modelOldString,
                    filePath: resolvedPath,
                  });
                } else {
                  const lines = modelOldString.split("\n");
                  const parts = lines
                    .map((line) => {
                      const trimmed = line.trim();
                      if (trimmed === "") return null;
                      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                      const flexInternal = escaped.replace(/[ \t]+/g, "[ \\t]*");
                      return `[ \\t]*${flexInternal}[ \\t]*`;
                    })
                    .filter((p): p is string => p !== null);

                  const pattern = parts.join("(?:\\r?\\n)+");
                  const regex = new RegExp(pattern, "g");
                  const matches = content.match(regex);

                  if (matches && matches.length === 1) {
                    const matchedOriginal = matches[0];
                    args.oldString = matchedOriginal;

                    appendLog(worktree, "INFO", "plugin", "FlexEdit: matched and corrected oldString", {
                      filePath: resolvedPath,
                      modelLength: modelOldString.length,
                      matchedLength: matchedOriginal.length,
                    });
                  } else if (matches && matches.length > 1) {
                    appendLog(worktree, "WARN", "plugin", "FlexEdit: multiple matches, aborting", {
                      count: matches.length,
                      filePath: resolvedPath,
                    });
                  } else {
                    appendLog(worktree, "WARN", "plugin", "FlexEdit: no matches found", {
                      filePath: resolvedPath,
                    });
                  }
                }
              }
            }
          } catch (err) {
            appendLog(worktree, "ERROR", "plugin", `FlexEdit error: ${err instanceof Error ? err.message : String(err)}`, {
              filePath: filePathArg,
            });
          }
        }
      }
    },

    "tool.execute.after": async (input, output) => {
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

        // REQ-004: Record metrics
        const success = !output.error;
        metrics.recordToolCall(input.tool, duration, success, input.agent || "unknown");

        // REQ-004: Record FlexEdit stats
        if (input.tool === "edit") {
          const args = input.arguments as { oldString?: string };
          metrics.recordFlexEdit(
            output.output?.includes("matched and corrected") || false,
            success,
          );
        }

        const relevantTools = ["write", "edit", "bash", "task", "skill"];
        if (relevantTools.includes(input.tool) && output.title) {
          appendLog(
            worktree,
            "INFO",
            "observations",
            `Tool: ${input.tool} — ${output.title}`,
            {
              tool: input.tool,
              title: output.title,
              outputSize: output.output?.length || 0,
              sessionID: input.sessionID,
              agent: input.agent || "plugin",
              duration,
            },
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
    // Compaction: contexto otimizado (REQ-001) + auto-handoff
    // ============================================================

    "experimental.session.compacting": async (input, output) => {
      const summary = tracker.getSummary(input.sessionID);

      // Contexto do harness
      output.context.push(
        "[Nexus Harness] Projeto usa harness de 6 estágios: SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT.",
      );
      output.context.push(
        "[Nexus Harness] Sub-agents: @security-secret-auditor, @quality-assurance-analyst, @docs-architect, @cbm-agent.",
      );
      output.context.push(
        "[Nexus Harness] Models: orquestradores usam gemini-2.5-pro, sub-agents usam deepseek-v4-flash-free.",
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

        // REQ-001: Injeta contexto otimizado do ContextManager
        const optimizedContext = contextManager.getOptimizedContext(input.sessionID);
        if (optimizedContext.length > 0) {
          output.context.push("[Nexus ContextManager] Contexto otimizado:");
          for (const ctx of optimizedContext) {
            output.context.push(ctx);
          }
        }

        // Estatísticas do contexto
        const stats = contextManager.getSessionStats(input.sessionID);
        if (stats) {
          output.context.push(
            `[Nexus ContextManager] Stats: ${stats.totalMessages} msgs, ~${stats.totalTokens} tokens, ` +
            `críticas: ${stats.importanceDistribution.critical}, altas: ${stats.importanceDistribution.high}`,
          );
        }

        // REQ-004: Injeta métricas no contexto
        const dailyMetrics = metrics.getDailySummary();
        if (dailyMetrics) {
          output.context.push(
            `[Nexus Metrics] Hoje: ${dailyMetrics.totalToolCalls} tool calls, ` +
            `taxa de sucesso: ${dailyMetrics.successRate.toFixed(1)}%, ` +
            `latência avg: ${dailyMetrics.avgLatency.toFixed(0)}ms`,
          );
        }

        // REQ-003: Injeta stats do cache
        const cacheStats = cacheManager.getStats();
        if (cacheStats.totalEntries > 0) {
          output.context.push(
            `[Nexus Cache] ${cacheStats.totalEntries} entradas, ` +
            `hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%, ` +
            `~${cacheStats.estimatedTokensSaved} tokens economizados`,
          );
        }

        // Auto-handoff
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

        // Persiste métricas e cache
        metrics.save();
        cacheManager.save();

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
      if (output.temperature === undefined || output.temperature === null) {
        output.temperature = 0.1;
      }
    },
  };
};

export default NexusPlugin;
