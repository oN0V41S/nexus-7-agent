/**
 * Metrics Collector — Sistema de Métricas para o Harness Nexus 7 Agent
 *
 * Coleta, agrega e exporta métricas de performance, qualidade e custo
 * do pipeline de orquestração de agentes.
 *
 * Integração:
 *   - Instancie no nexus-plugin.ts e chame record*() nos hooks apropriados
 *   - Persiste em .opencode/logs/metrics-YYYY-MM-DD.json
 *   - Exporta CSV para análise externa
 *
 * Métricas coletadas:
 *   - Performance: latência por ferramenta, throughput, tempo por agente
 *   - Qualidade: taxa de erro, aderência a padrões, taxa de sucesso de edits
 *   - Custo: tokens por sessão, custo estimado por tarefa
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================
// Types
// ============================================================

interface ToolCallRecord {
  tool: string;
  duration: number;
  success: boolean;
  agent: string;
  timestamp: number;
}

interface TokenRecord {
  sessionID: string;
  estimated: number;
  timestamp: number;
}

interface ErrorRecord {
  tool: string;
  error: string;
  agent: string;
  timestamp: number;
}

interface FlexEditRecord {
  tool: string;
  matched: boolean;
  multipleMatches: boolean;
  timestamp: number;
}

/** Métricas agregadas de um único dia */
export interface DailyMetrics {
  date: string;
  performance: {
    totalToolCalls: number;
    avgDurationMs: number;
    p95DurationMs: number;
    p99DurationMs: number;
    throughputTokensPerSec: number;
    agentResponseTimes: Record<string, { total: number; avgMs: number }>;
  };
  quality: {
    totalErrors: number;
    errorRate: number;
    errorsByTool: Record<string, number>;
    flexEditSuccessRate: number;
    totalEdits: number;
    successfulEdits: number;
    patternAdherenceRate: number;
  };
  cost: {
    totalTokens: number;
    estimatedCostUSD: number;
    tokensBySession: Record<string, number>;
    cacheSavingsEstimate: number;
  };
  sessions: number;
}

/** Métricas agregadas de uma semana */
export interface WeeklyMetrics {
  weekStart: string;
  weekEnd: string;
  days: DailyMetrics[];
  totals: {
    toolCalls: number;
    errors: number;
    tokens: number;
    estimatedCostUSD: number;
  };
  dailyAverages: {
    toolCalls: number;
    errors: number;
    tokens: number;
  };
}

/** Métricas por agente */
export interface AgentMetrics {
  agent: string;
  totalToolCalls: number;
  avgDurationMs: number;
  errorRate: number;
  totalErrors: number;
  mostUsedTools: Array<{ tool: string; count: number }>;
}

// ============================================================
// Model pricing (USD per 1M tokens) — estimativas
// ============================================================

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "deepseek-v4-flash-free": { input: 0, output: 0 },
  "gemini-2.5-pro": { input: 1.25, output: 5.0 },
  "default": { input: 0.5, output: 1.5 },
};

// ============================================================
// Helpers
// ============================================================

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function metricsPath(worktree: string, date: string): string {
  return path.join(worktree, ".opencode/logs", `metrics-${date}.json`);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ============================================================
// MetricsCollector
// ============================================================

export class MetricsCollector {
  private worktree: string;
  private toolCalls: ToolCallRecord[] = [];
  private tokens: TokenRecord[] = [];
  private errors: ErrorRecord[] = [];
  private flexEdits: FlexEditRecord[] = [];

  constructor(worktree: string) {
    this.worktree = worktree;
  }

  // ============================================================
  // Recording
  // ============================================================

  /**
   * Registra uma chamada de ferramenta com duração e sucesso.
   * @param tool - Nome da ferramenta (ex: "edit", "bash", "write")
   * @param duration - Duração em milissegundos
   * @param success - Se a chamada foi bem-sucedida
   * @param agent - Nome do agente que executou
   */
  recordToolCall(tool: string, duration: number, success: boolean, agent: string): void {
    this.toolCalls.push({
      tool,
      duration,
      success,
      agent,
      timestamp: Date.now(),
    });
  }

  /**
   * Registra estimativa de tokens consumidos em uma sessão.
   * @param sessionID - Identificador da sessão
   * @param estimated - Número estimado de tokens
   */
  recordTokens(sessionID: string, estimated: number): void {
    this.tokens.push({
      sessionID,
      estimated,
      timestamp: Date.now(),
    });
  }

  /**
   * Registra um erro occurred durante execução de ferramenta.
   * @param tool - Ferramenta que gerou o erro
   * @param error - Descrição do erro
   * @param agent - Agente que estava executando
   */
  recordError(tool: string, error: string, agent: string): void {
    this.errors.push({
      tool,
      error,
      agent,
      timestamp: Date.now(),
    });
  }

  /**
   * Registra resultado de um FlexEdit (match correção do edit tool).
   * @param matched - Se o FlexEdit encontrou match único
   * @param multipleMatches - Se encontrou múltiplos matches
   */
  recordFlexEdit(matched: boolean, multipleMatches: boolean): void {
    this.flexEdits.push({
      tool: "edit",
      matched,
      multipleMatches,
      timestamp: Date.now(),
    });
  }

  // ============================================================
  // Query
  // ============================================================

  /**
   * Retorna resumo diário de métricas.
   * @param date - Data no formato YYYY-MM-DD (padrão: hoje)
   */
  getDailySummary(date?: string): DailyMetrics {
    const targetDate = date || today();
    const dayStart = new Date(targetDate + "T00:00:00Z").getTime();
    const dayEnd = new Date(targetDate + "T23:59:59Z").getTime();

    const dayToolCalls = this.toolCalls.filter(
      (r) => r.timestamp >= dayStart && r.timestamp <= dayEnd,
    );
    const dayTokens = this.tokens.filter(
      (r) => r.timestamp >= dayStart && r.timestamp <= dayEnd,
    );
    const dayErrors = this.errors.filter(
      (r) => r.timestamp >= dayStart && r.timestamp <= dayEnd,
    );
    const dayFlexEdits = this.flexEdits.filter(
      (r) => r.timestamp >= dayStart && r.timestamp <= dayEnd,
    );

    // Performance
    const durations = dayToolCalls.map((r) => r.duration).sort((a, b) => a - b);
    const avgDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    const agentResponseTimes: Record<string, { total: number; avgMs: number }> = {};
    const byAgent = new Map<string, number[]>();
    for (const tc of dayToolCalls) {
      if (!byAgent.has(tc.agent)) byAgent.set(tc.agent, []);
      byAgent.get(tc.agent)!.push(tc.duration);
    }
    for (const [agent, times] of byAgent) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      agentResponseTimes[agent] = { total: times.length, avgMs: Math.round(avg) };
    }

    // Tokens throughput estimado (tokens / segundo total)
    const totalTokensDay = dayTokens.reduce((a, r) => a + r.estimated, 0);
    const totalDurationSec =
      durations.reduce((a, b) => a + b, 0) / 1000;
    const throughput = totalDurationSec > 0 ? totalTokensDay / totalDurationSec : 0;

    // Qualidade
    const errorsByTool: Record<string, number> = {};
    for (const e of dayErrors) {
      errorsByTool[e.tool] = (errorsByTool[e.tool] || 0) + 1;
    }
    const totalEdits = dayFlexEdits.length;
    const successfulEdits = dayFlexEdits.filter((e) => e.matched).length;
    const editSuccessRate = totalEdits > 0 ? successfulEdits / totalEdits : 1;
    const errorRate =
      dayToolCalls.length > 0
        ? dayErrors.length / dayToolCalls.length
        : 0;

    // Aderência a padrões: % de tool calls bem-sucedidas
    const successfulCalls = dayToolCalls.filter((r) => r.success).length;
    const patternAdherence =
      dayToolCalls.length > 0 ? successfulCalls / dayToolCalls.length : 1;

    // Custo
    const tokensBySession: Record<string, number> = {};
    for (const t of dayTokens) {
      tokensBySession[t.sessionID] = (tokensBySession[t.sessionID] || 0) + t.estimated;
    }
    const estimatedCost = this.estimateCost(totalTokensDay);

    const uniqueSessions = new Set(dayTokens.map((t) => t.sessionID));

    return {
      date: targetDate,
      performance: {
        totalToolCalls: dayToolCalls.length,
        avgDurationMs: Math.round(avgDuration),
        p95DurationMs: percentile(durations, 95),
        p99DurationMs: percentile(durations, 99),
        throughputTokensPerSec: Math.round(throughput),
        agentResponseTimes,
      },
      quality: {
        totalErrors: dayErrors.length,
        errorRate: Math.round(errorRate * 10000) / 100,
        errorsByTool,
        flexEditSuccessRate: Math.round(editSuccessRate * 10000) / 100,
        totalEdits,
        successfulEdits,
        patternAdherenceRate: Math.round(patternAdherence * 10000) / 100,
      },
      cost: {
        totalTokens: totalTokensDay,
        estimatedCostUSD: Math.round(estimatedCost * 10000) / 10000,
        tokensBySession,
        cacheSavingsEstimate: 0,
      },
      sessions: uniqueSessions.size,
    };
  }

  /**
   * Retorna métricas agregadas de uma semana (7 dias até hoje).
   */
  getWeeklySummary(): WeeklyMetrics {
    const now = new Date();
    const days: DailyMetrics[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(this.getDailySummary(d.toISOString().slice(0, 10)));
    }

    const totals = days.reduce(
      (acc, d) => ({
        toolCalls: acc.toolCalls + d.performance.totalToolCalls,
        errors: acc.errors + d.quality.totalErrors,
        tokens: acc.tokens + d.cost.totalTokens,
        estimatedCostUSD:
          Math.round((acc.estimatedCostUSD + d.cost.estimatedCostUSD) * 10000) / 10000,
      }),
      { toolCalls: 0, errors: 0, tokens: 0, estimatedCostUSD: 0 },
    );

    return {
      weekStart: days[0].date,
      weekEnd: days[days.length - 1].date,
      days,
      totals,
      dailyAverages: {
        toolCalls: Math.round(totals.toolCalls / 7),
        errors: Math.round(totals.errors / 7),
        tokens: Math.round(totals.tokens / 7),
      },
    };
  }

  /**
   * Retorna métricas específicas de um agente.
   * @param agent - Nome do agente
   */
  getAgentMetrics(agent: string): AgentMetrics {
    const agentCalls = this.toolCalls.filter((r) => r.agent === agent);
    const agentErrors = this.errors.filter((r) => r.agent === agent);

    const durations = agentCalls.map((r) => r.duration);
    const avgDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    // Contagem por ferramenta
    const toolCounts = new Map<string, number>();
    for (const tc of agentCalls) {
      toolCounts.set(tc.tool, (toolCounts.get(tc.tool) || 0) + 1);
    }
    const mostUsedTools = [...toolCounts.entries()]
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      agent,
      totalToolCalls: agentCalls.length,
      avgDurationMs: Math.round(avgDuration),
      errorRate:
        agentCalls.length > 0
          ? Math.round((agentErrors.length / agentCalls.length) * 10000) / 100
          : 0,
      totalErrors: agentErrors.length,
      mostUsedTools,
    };
  }

  // ============================================================
  // Export
  // ============================================================

  /**
   * Exporta métricas em formato CSV para um período.
   * @param period - "daily" (hoje), "weekly" (7 dias), ou data específica "YYYY-MM-DD"
   * @returns CSV string pronta para escrita em arquivo
   */
  exportCSV(period: string): string {
    let rows: Array<Record<string, string | number>> = [];

    if (period === "daily") {
      const summary = this.getDailySummary();
      rows.push(this.dailyMetricsToRow(summary));
    } else if (period === "weekly") {
      const summary = this.getWeeklySummary();
      rows = summary.days.map((d) => this.dailyMetricsToRow(d));
    } else {
      // Data específica YYYY-MM-DD
      const summary = this.getDailySummary(period);
      rows.push(this.dailyMetricsToRow(summary));
    }

    if (rows.length === 0) return "";

    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(headers.map((h) => String(row[h])).join(","));
    }
    return lines.join("\n");
  }

  /**
   * Salva as métricas em memória para o arquivo JSON diário.
   * Deve ser chamado no final de cada sessão ou periodicamente.
   */
  save(): void {
    const targetDate = today();
    const summary = this.getDailySummary(targetDate);
    const filePath = metricsPath(this.worktree, targetDate);

    ensureDir(path.dirname(filePath));

    let existing: DailyMetrics | null = null;
    if (fs.existsSync(filePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch {
        existing = null;
      }
    }

    // Merge com dados existentes (acumula)
    if (existing) {
      const merged = this.mergeDailyMetrics(existing, summary);
      fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
    } else {
      fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), "utf-8");
    }
  }

  /**
   * Salva CSV exportado em arquivo.
   * @param period - Período (ver exportCSV)
   * @param outDir - Diretório de saída (padrão: .opencode/logs/)
   * @returns Caminho do arquivo salvo
   */
  exportCSVToFile(period: string, outDir?: string): string {
    const dir = outDir || path.join(this.worktree, ".opencode/logs");
    ensureDir(dir);
    const filename = `metrics-export-${today()}-${period}.csv`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, this.exportCSV(period), "utf-8");
    return filePath;
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private estimateCost(totalTokens: number): number {
    const pricing = MODEL_PRICING["default"];
    // Estimativa: 50% input, 50% output
    const inputTokens = totalTokens * 0.5;
    const outputTokens = totalTokens * 0.5;
    return (
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output
    );
  }

  private dailyMetricsToRow(m: DailyMetrics): Record<string, string | number> {
    return {
      date: m.date,
      toolCalls: m.performance.totalToolCalls,
      avgDurationMs: m.performance.avgDurationMs,
      p95DurationMs: m.performance.p95DurationMs,
      throughput: m.performance.throughputTokensPerSec,
      errors: m.quality.totalErrors,
      errorRate: m.quality.errorRate,
      flexEditRate: m.quality.flexEditSuccessRate,
      patternAdherence: m.quality.patternAdherenceRate,
      tokens: m.cost.totalTokens,
      costUSD: m.cost.estimatedCostUSD,
      sessions: m.sessions,
    };
  }

  private mergeDailyMetrics(a: DailyMetrics, b: DailyMetrics): DailyMetrics {
    // Merge dois DailyMetrics do mesmo dia (acumula contagens)
    return {
      date: a.date,
      performance: {
        totalToolCalls: a.performance.totalToolCalls + b.performance.totalToolCalls,
        avgDurationMs: Math.round(
          (a.performance.avgDurationMs + b.performance.avgDurationMs) / 2,
        ),
        p95DurationMs: Math.max(a.performance.p95DurationMs, b.performance.p95DurationMs),
        p99DurationMs: Math.max(a.performance.p99DurationMs, b.performance.p99DurationMs),
        throughputTokensPerSec: Math.round(
          (a.performance.throughputTokensPerSec + b.performance.throughputTokensPerSec) / 2,
        ),
        agentResponseTimes: {
          ...a.performance.agentResponseTimes,
          ...b.performance.agentResponseTimes,
        },
      },
      quality: {
        totalErrors: a.quality.totalErrors + b.quality.totalErrors,
        errorRate:
          (a.performance.totalToolCalls + b.performance.totalToolCalls) > 0
            ? Math.round(
                ((a.quality.totalErrors + b.quality.totalErrors) /
                  (a.performance.totalToolCalls + b.performance.totalToolCalls)) *
                  10000,
              ) / 100
            : 0,
        errorsByTool: this.mergeCounts(a.quality.errorsByTool, b.quality.errorsByTool),
        flexEditSuccessRate: Math.round(
          ((a.quality.flexEditSuccessRate + b.quality.flexEditSuccessRate) / 2) * 10000,
        ) / 100,
        totalEdits: a.quality.totalEdits + b.quality.totalEdits,
        successfulEdits: a.quality.successfulEdits + b.quality.successfulEdits,
        patternAdherenceRate: Math.round(
          ((a.quality.patternAdherenceRate + b.quality.patternAdherenceRate) / 2) * 10000,
        ) / 100,
      },
      cost: {
        totalTokens: a.cost.totalTokens + b.cost.totalTokens,
        estimatedCostUSD:
          Math.round((a.cost.estimatedCostUSD + b.cost.estimatedCostUSD) * 10000) / 10000,
        tokensBySession: {
          ...a.cost.tokensBySession,
          ...b.cost.tokensBySession,
        },
        cacheSavingsEstimate:
          a.cost.cacheSavingsEstimate + b.cost.cacheSavingsEstimate,
      },
      sessions: a.sessions + b.sessions,
    };
  }

  private mergeCounts(
    a: Record<string, number>,
    b: Record<string, number>,
  ): Record<string, number> {
    const result: Record<string, number> = { ...a };
    for (const [key, val] of Object.entries(b)) {
      result[key] = (result[key] || 0) + val;
    }
    return result;
  }
}
