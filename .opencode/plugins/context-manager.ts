/**
 * Context Manager — Gerenciamento de Contexto para DeepSeek-V4
 *
 * REQ-001: Sistema de gerenciamento de contexto para evitar perda
 * de informações em conversas longas.
 *
 * Funcionalidades:
 * - Rastreamento de mensagens por sessão
 * - Resumo automático a cada N mensagens (configurável)
 * - Priorização de contexto por relevância
 * - Injeção de contexto otimizado no compacting
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================
// Types
// ============================================================

interface MessageEntry {
  id: string;
  timestamp: number;
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
  importance: "critical" | "high" | "medium" | "low";
}

interface ContextSummary {
  keyPoints: string[];
  decisions: string[];
  codeChanges: string[];
  pendingTasks: string[];
  timestamp: string;
  messageRange: { from: number; to: number };
}

interface SessionContext {
  messages: MessageEntry[];
  summaries: ContextSummary[];
  lastSummaryAt: number;
  totalTokens: number;
}

interface ContextConfig {
  /** Número de mensagens entre resumos automáticos */
  summaryInterval: number;
  /** Limite máximo de mensagens antes de forçar resumo */
  maxMessages: number;
  /** Limite de tokens do contexto mantido */
  maxTokens: number;
  /** Habilitar priorização por relevância */
  enablePrioritization: boolean;
}

// ============================================================
// Default Config
// ============================================================

const DEFAULT_CONFIG: ContextConfig = {
  summaryInterval: 10,
  maxMessages: 50,
  maxTokens: 150000, // 150k dos 200k do DeepSeek
  enablePrioritization: true,
};

// ============================================================
// Importância de mensagens
// ============================================================

const IMPORTANCE_PATTERNS: Array<{ pattern: RegExp; importance: MessageEntry["importance"] }> = [
  // Decisões arquiteturais (prioridade máxima)
  { pattern: /(?:decid|decidiu|decisão|arquitetura|escolh|optou por)/i, importance: "critical" },
  // Código gerado/modificado
  { pattern: /(?:```[\s\S]*```|write|edit|implement|criou|modificou|adicionou)/i, importance: "high" },
  // Instruções de tarefa
  { pattern: /(?:tarefa|requisito|spec|plano|implementar|fazer|criar)/i, importance: "medium" },
  // Discussão geral
  { pattern: /.*/, importance: "low" },
];

// ============================================================
// Context Manager
// ============================================================

export class ContextManager {
  private sessions = new Map<string, SessionContext>();
  private config: ContextConfig;
  private worktree: string;

  constructor(worktree: string, config: Partial<ContextConfig> = {}) {
    this.worktree = worktree;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Registra uma mensagem na sessão
   */
  trackMessage(
    sessionID: string,
    role: "user" | "assistant",
    content: string,
    toolCalls: string[] = [],
  ): void {
    const session = this.getOrCreateSession(sessionID);

    const importance = this.classifyImportance(content);

    session.messages.push({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      role,
      content,
      toolCalls,
      importance,
    });

    session.totalTokens += this.estimateTokens(content);

    // Verifica se precisa resumir
    if (session.messages.length - session.lastSummaryAt >= this.config.summaryInterval) {
      this.generateSummary(sessionID);
    }
  }

  /**
   * Gera resumo automático das mensagens recentes
   */
  generateSummary(sessionID: string): ContextSummary | null {
    const session = this.sessions.get(sessionID);
    if (!session || session.messages.length === 0) return null;

    const recentMessages = session.messages.slice(session.lastSummaryAt);
    if (recentMessages.length === 0) return null;

    const keyPoints: string[] = [];
    const decisions: string[] = [];
    const codeChanges: string[] = [];
    const pendingTasks: string[] = [];

    for (const msg of recentMessages) {
      const content = msg.content;

      // Extrai pontos-chave
      if (msg.importance === "critical" || msg.importance === "high") {
        const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 10);
        keyPoints.push(...sentences.slice(0, 3).map((s) => s.trim()));
      }

      // Extrai decisões
      if (msg.importance === "critical") {
        const decisionMatch = content.match(/(?:decid|decidiu|decisão|escolh|optou)[^.!?]*[.!?]/gi);
        if (decisionMatch) {
          decisions.push(...decisionMatch.map((d) => d.trim()));
        }
      }

      // Extrai mudanças de código
      if (msg.toolCalls?.some((t) => ["write", "edit", "bash"].includes(t))) {
        const codeMatch = content.match(/```[\s\S]*?```/g);
        if (codeMatch) {
          codeChanges.push(`Tool call: ${msg.toolCalls.join(", ")}`);
        }
      }

      // Extrai tarefas pendentes
      const taskMatch = content.match(/(?:TODO|pendente|falta|precisa|deve|tarefa)[^.!?]*[.!?]/gi);
      if (taskMatch) {
        pendingTasks.push(...taskMatch.map((t) => t.trim()));
      }
    }

    const summary: ContextSummary = {
      keyPoints: [...new Set(keyPoints)].slice(0, 10),
      decisions: [...new Set(decisions)].slice(0, 5),
      codeChanges: [...new Set(codeChanges)].slice(0, 5),
      pendingTasks: [...new Set(pendingTasks)].slice(0, 5),
      timestamp: new Date().toISOString(),
      messageRange: {
        from: session.lastSummaryAt,
        to: session.messages.length,
      },
    };

    session.summaries.push(summary);
    session.lastSummaryAt = session.messages.length;

    // Salva resumo em disco
    this.saveSummary(sessionID, summary);

    return summary;
  }

  /**
   * Retorna contexto otimizado para injeção no compacting
   */
  getOptimizedContext(sessionID: string): string[] {
    const session = this.sessions.get(sessionID);
    if (!session) return [];

    const context: string[] = [];

    // 1. Injeta resumos anteriores
    for (const summary of session.summaries.slice(-3)) {
      context.push(`[Resumo ${summary.timestamp}]\n${this.formatSummary(summary)}`);
    }

    // 2. Injeta mensagens recentes (últimas 5) com priorização
    const recentMessages = session.messages.slice(-5);
    if (this.config.enablePrioritization) {
      recentMessages.sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.importance] - order[b.importance];
      });
    }

    for (const msg of recentMessages) {
      const prefix = msg.role === "user" ? "[Usuário]" : "[Assistente]";
      const truncated = msg.content.slice(0, 500) + (msg.content.length > 500 ? "..." : "");
      context.push(`${prefix} (importância: ${msg.importance})\n${truncated}`);
    }

    // 3. Tarefas pendentes
    const allPending = session.summaries.flatMap((s) => s.pendingTasks);
    if (allPending.length > 0) {
      context.push(`[Tarefas Pendentes]\n${allPending.slice(-5).join("\n")}`);
    }

    // 4. Estatísticas
    context.push(
      `[Estatísticas] ${session.messages.length} mensagens, ${session.summaries.length} resumos, ~${session.totalTokens} tokens`,
    );

    return context;
  }

  /**
   * Retorna estatísticas da sessão
   */
  getSessionStats(sessionID: string) {
    const session = this.sessions.get(sessionID);
    if (!session) return null;

    const importanceCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const msg of session.messages) {
      importanceCounts[msg.importance]++;
    }

    return {
      totalMessages: session.messages.length,
      totalTokens: session.totalTokens,
      summariesCount: session.summaries.length,
      importanceDistribution: importanceCounts,
      messagesSinceLastSummary: session.messages.length - session.lastSummaryAt,
    };
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private getOrCreateSession(sessionID: string): SessionContext {
    if (!this.sessions.has(sessionID)) {
      this.sessions.set(sessionID, {
        messages: [],
        summaries: [],
        lastSummaryAt: 0,
        totalTokens: 0,
      });
    }
    return this.sessions.get(sessionID)!;
  }

  private classifyImportance(content: string): MessageEntry["importance"] {
    for (const { pattern, importance } of IMPORTANCE_PATTERNS) {
      if (pattern.test(content)) {
        return importance;
      }
    }
    return "low";
  }

  private estimateTokens(text: string): number {
    // Estimativa: ~4 caracteres por token
    return Math.ceil(text.length / 4);
  }

  private formatSummary(summary: ContextSummary): string {
    const lines: string[] = [];
    if (summary.keyPoints.length > 0) {
      lines.push(`Pontos-chave: ${summary.keyPoints.slice(0, 3).join("; ")}`);
    }
    if (summary.decisions.length > 0) {
      lines.push(`Decisões: ${summary.decisions.join("; ")}`);
    }
    if (summary.codeChanges.length > 0) {
      lines.push(`Mudanças: ${summary.codeChanges.join("; ")}`);
    }
    return lines.join("\n");
  }

  private saveSummary(sessionID: string, summary: ContextSummary): void {
    try {
      const summaryDir = path.join(this.worktree, ".opencode/memory/summaries");
      if (!fs.existsSync(summaryDir)) {
        fs.mkdirSync(summaryDir, { recursive: true });
      }
      const filePath = path.join(summaryDir, `${sessionID}-${Date.now()}.json`);
      fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), "utf-8");
    } catch {
      // Falha silenciosa — não deve bloquear o pipeline
    }
  }
}
