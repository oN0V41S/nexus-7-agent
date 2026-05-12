/**
 * Nexus Plugin — Observability & Lifecycle Hooks
 *
 * Camada 2 do ecossistema Nexus 7 Agent.
 * Fornece hooks de observabilidade, logging automático,
 * contexto de compactação e rastreamento de ferramentas.
 *
 * Hooks implementados:
 * - tool.execute.before  → logging de chamadas de ferramentas
 * - tool.execute.after   → resultado e métricas
 * - command.execute.before → logging de comandos
 * - experimental.session.compacting → contexto adicional
 * - chat.message → rastreamento de mensagens
 * - permission.ask → registro de solicitações de permissão
 */

import type { Plugin } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendLog(worktree: string, level: string, category: string, message: string, meta: Record<string, unknown> = {}): void {
  const logDir = path.join(worktree, ".opencode/logs");
  ensureDir(logDir);

  const date = new Date().toISOString().slice(0, 10);
  const logFile = path.join(logDir, `${category}-${date}.log`);
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  const entry = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

  fs.appendFileSync(logFile, entry, "utf-8");
}

const NexusPlugin: Plugin = async (ctx) => {
  const worktree = ctx.worktree;

  // Log inicial do plugin
  appendLog(worktree, "INFO", "plugin", "Nexus Plugin iniciado", {
    directory: ctx.directory,
  });

  return {
    // ============================================================
    // Observabilidade: log de execução de ferramentas
    // ============================================================

    "tool.execute.before": async (input, output) => {
      appendLog(worktree, "TRACE", "tools", `Tool chamada: ${input.tool}`, {
        sessionID: input.sessionID,
        callID: input.callID,
      });
    },

    "tool.execute.after": async (input, output) => {
      appendLog(worktree, "INFO", "tools", `Tool executada: ${input.tool}`, {
        sessionID: input.sessionID,
        callID: input.callID,
        title: output.title,
        outputSize: output.output?.length || 0,
      });
    },

    // ============================================================
    // Observabilidade: log de comandos
    // ============================================================

    "command.execute.before": async (input, output) => {
      appendLog(worktree, "INFO", "commands", `Comando executado: ${input.command}`, {
        sessionID: input.sessionID,
        arguments: input.arguments,
      });
    },

    // ============================================================
    // Contexto de compactação: preserva informações do harness
    // ============================================================

    "experimental.session.compacting": async (input, output) => {
      output.context.push(
        "[Nexus Harness] Este projeto usa o harness Nexus de 5 estágios: PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT.",
      );
      output.context.push(
        "[Nexus Harness] Sub-agents disponíveis: @security-secret-auditor, @quality-assurance-analyst, @docs-architect.",
      );
      output.context.push(
        "[Nexus Harness] Use /pipeline para iniciar o ciclo completo ou a skill harness-workflow para detalhes.",
      );
    },

    // ============================================================
    // Rastreamento de mensagens do chat
    // ============================================================

    "chat.message": async (input, output) => {
      appendLog(worktree, "DEBUG", "session", `Mensagem recebida`, {
        sessionID: input.sessionID,
        agent: input.agent,
        messageID: input.messageID,
        partsCount: output.parts?.length || 0,
      });
    },

    // ============================================================
    // Permissões
    // ============================================================

    "permission.ask": async (input, output) => {
      appendLog(worktree, "WARN", "permissions", `Permissão solicitada: ${input.permission}`, {
        patterns: input.patterns,
      });
    },
  };
};

export default NexusPlugin;
