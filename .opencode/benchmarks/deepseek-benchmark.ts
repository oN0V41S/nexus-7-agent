#!/usr/bin/env npx tsx
/**
 * Nexus DeepSeek Optimization — Benchmark Rápido
 *
 * Testa os 3 módulos implementados:
 * - ContextManager: tracking, resumo, priorização
 * - CacheManager: set/get, hit rate, persistência
 * - MetricsCollector: gravação, query, export
 *
 * Execute: npx tsx .opencode/benchmarks/deepseek-benchmark.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ContextManager } from "../plugins/context-manager";
import { CacheManager } from "../plugins/cache-manager";
import { MetricsCollector } from "../plugins/metrics-collector";

// ============================================================
// Config
// ============================================================

const WORKTREE = "/tmp/nexus-benchmark";
const ITERATIONS = 1000;

// ============================================================
// Helpers
// ============================================================

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanup() {
  if (fs.existsSync(WORKTREE)) {
    fs.rmSync(WORKTREE, { recursive: true, force: true });
  }
}

function header(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

function bench(label: string, fn: () => void, iterations: number = ITERATIONS): number {
  // Warmup
  for (let i = 0; i < Math.min(100, iterations); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgUs = (elapsed / iterations) * 1000;

  console.log(`  ${label.padEnd(40)} ${avgUs.toFixed(2).padStart(10)} µs/op  ${opsPerSec.toFixed(0).padStart(10)} ops/s`);
  return elapsed;
}

// ============================================================
// Sample Data
// ============================================================

const SAMPLE_MESSAGES = [
  "Decidimos usar gemini-2.5-pro como orquestrador principal do pipeline.",
  "Implementei o ContextManager com resumo automático a cada 10 mensagens.",
  "```typescript\nconst x = 42;\n```\nCódigo de exemplo para teste.",
  "A tarefa é otimizar o deepseek-v4-flash para execução de código.",
  "Precisamos de 50% de redução no consumo de tokens.",
  "O sistema de cache deve usar TTL de 30 minutos para respostas.",
  "Bug encontrado: FlexEdit não está matcheando whitespace variations.",
  "Arquitetura dual: gemini para orquestração, deepseek para execução.",
  "Status: implementação concluída, aguardando review.",
  "O benchmark mostrou latência de 2.3ms por operação de cache.",
];

const SAMPLE_CODE = [
  "function hello() { return 'world'; }",
  "const ctx = new ContextManager(worktree);",
  "export class CacheManager { get(key: string) {} }",
  "interface Metrics { latency: number; throughput: number; }",
  "if (condition) { return optimize(); } else { return fallback(); }",
];

const TOOLS = ["read", "write", "edit", "bash", "glob", "grep", "task", "skill"];
const AGENTS = ["orchestrator", "fixer", "explorer", "quality-assurance-analyst", "cbm-agent"];

// ============================================================
// Benchmark: ContextManager
// ============================================================

function benchContextManager() {
  header("ContextManager (REQ-001)");

  const ctx = new ContextManager(WORKTREE, {
    summaryInterval: 5,
    maxMessages: 50,
    maxTokens: 150000,
    enablePrioritization: true,
  });

  let totalTokens = 0;

  const trackTime = bench("trackMessage()", () => {
    const msg = SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)];
    const role = Math.random() > 0.5 ? "user" : "assistant";
    const tools = Math.random() > 0.7 ? [TOOLS[Math.floor(Math.random() * TOOLS.length)]] : [];
    ctx.trackMessage("bench-session", role, msg, tools);
  });

  const stats = ctx.getSessionStats("bench-session");
  if (stats) totalTokens = stats.totalTokens;

  const summaryTime = bench("generateSummary()", () => {
    ctx.generateSummary("bench-session");
  });

  const contextTime = bench("getOptimizedContext()", () => {
    ctx.getOptimizedContext("bench-session");
  });

  const optimizedCtx = ctx.getOptimizedContext("bench-session");

  console.log(`\n  Resultados:`);
  console.log(`    Mensagens trackeadas: ${stats?.totalMessages || 0}`);
  console.log(`    Tokens estimados:     ${totalTokens}`);
  console.log(`    Resumos gerados:      ${stats?.summariesCount || 0}`);
  console.log(`    Contexto otimizado:   ${optimizedCtx.length} entradas`);
  console.log(`    Distribuição:         críticas=${stats?.importanceDistribution.critical} altas=${stats?.importanceDistribution.high} médias=${stats?.importanceDistribution.medium} baixas=${stats?.importanceDistribution.low}`);

  return { trackTime, summaryTime, contextTime, totalTokens };
}

// ============================================================
// Benchmark: CacheManager
// ============================================================

function benchCacheManager() {
  header("CacheManager (REQ-003)");

  const cache = new CacheManager(WORKTREE, {
    maxEntries: 500,
    maxSizeBytes: 10 * 1024 * 1024,
    enablePersistence: false,
  });

  let hits = 0;
  let misses = 0;

  const setTime = bench("set()", () => {
    const key = `code:${Math.random().toString(36).slice(2, 10)}`;
    const value = SAMPLE_CODE[Math.floor(Math.random() * SAMPLE_CODE.length)];
    cache.set(key, value, "code");
  });

  const getTime = bench("get() [hit]", () => {
    const key = `code:${Math.random().toString(36).slice(2, 10)}`;
    cache.set(key, "test-value", "code");
    const result = cache.get(key);
    if (result) hits++;
  });

  const missTime = bench("get() [miss]", () => {
    const key = `nonexistent:${Math.random()}`;
    const result = cache.get(key);
    if (!result) misses++;
  });

  const getOrCreateTime = bench("getOrCreate()", () => {
    const key = `response:${Math.random().toString(36).slice(2, 10)}`;
    cache.getOrCreate(key, () => {
      return SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)];
    }, "response");
  });

  const stats = cache.getStats();

  console.log(`\n  Resultados:`);
  console.log(`    Entradas:            ${stats.totalEntries}`);
  console.log(`    Hits/Misses:         ${stats.hits}/${stats.misses}`);
  console.log(`    Hit Rate:            ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`    Tokens economizados: ~${stats.estimatedTokensSaved}`);
  console.log(`    Tamanho:             ${(stats.totalSizeBytes / 1024).toFixed(1)} KB`);

  return { setTime, getTime, missTime, getOrCreateTime, stats };
}

// ============================================================
// Benchmark: MetricsCollector
// ============================================================

function benchMetricsCollector() {
  header("MetricsCollector (REQ-004)");

  const metrics = new MetricsCollector(WORKTREE);

  const recordTime = bench("recordToolCall()", () => {
    const tool = TOOLS[Math.floor(Math.random() * TOOLS.length)];
    const duration = Math.random() * 500 + 10;
    const success = Math.random() > 0.1;
    const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
    metrics.recordToolCall(tool, duration, success, agent);
  });

  const recordTokensTime = bench("recordTokens()", () => {
    const tokens = Math.floor(Math.random() * 50000) + 1000;
    metrics.recordTokens(`session-${Math.floor(Math.random() * 10)}`, tokens);
  });

  const recordErrorTime = bench("recordError()", () => {
    const tool = TOOLS[Math.floor(Math.random() * TOOLS.length)];
    const errors = ["timeout", "permission denied", "file not found", "syntax error"];
    const error = errors[Math.floor(Math.random() * errors.length)];
    metrics.recordError(tool, error, AGENTS[0]);
  });

  const dailyTime = bench("getDailySummary()", () => {
    metrics.getDailySummary();
  });

  const agentTime = bench("getAgentMetrics()", () => {
    metrics.getAgentMetrics(AGENTS[Math.floor(Math.random() * AGENTS.length)]);
  });

  const csvTime = bench("exportCSV()", () => {
    metrics.exportCSV("daily");
  });

  const daily = metrics.getDailySummary();
  const csv = metrics.exportCSV("daily");

  console.log(`\n  Resultados:`);
  console.log(`    Total tool calls:    ${daily.performance.totalToolCalls}`);
  console.log(`    Taxa de sucesso:     ${daily.quality.patternAdherenceRate}%`);
  console.log(`    Latência avg:        ${daily.performance.avgDurationMs}ms`);
  console.log(`    Latência p95:        ${daily.performance.p95DurationMs}ms`);
  console.log(`    Latência p99:        ${daily.performance.p99DurationMs}ms`);
  console.log(`    Throughput:          ${daily.performance.throughputTokensPerSec} ops/s`);
  console.log(`    Total errors:        ${daily.quality.totalErrors}`);
  console.log(`    FlexEdit rate:       ${daily.quality.flexEditSuccessRate}%`);
  console.log(`    Tokens totais:       ${daily.cost.totalTokens}`);
  console.log(`    Custo estimado:      $${daily.cost.estimatedCostUSD}`);
  console.log(`    CSV tamanho:         ${csv.length} chars`);

  return { recordTime, dailyTime, csvTime, daily };
}

// ============================================================
// Main
// ============================================================

function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Nexus DeepSeek Optimization — Benchmark                ║");
  console.log("║  Iterações por teste: " + ITERATIONS.toString().padEnd(33) + "║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  ensureDir(WORKTREE);

  const ctxResult = benchContextManager();
  const cacheResult = benchCacheManager();
  const metricsResult = benchMetricsCollector();

  // ============================================================
  // Resumo Final
  // ============================================================

  header("RESUMO DO BENCHMARK");

  console.log("\n  ContextManager:");
  console.log(`    trackMessage:    ${(ctxResult.trackTime / ITERATIONS * 1000).toFixed(2)} µs/op`);
  console.log(`    generateSummary: ${(ctxResult.summaryTime / ITERATIONS * 1000).toFixed(2)} µs/op`);
  console.log(`    getContext:      ${(ctxResult.contextTime / ITERATIONS * 1000).toFixed(2)} µs/op`);

  console.log("\n  CacheManager:");
  console.log(`    set:             ${(cacheResult.setTime / ITERATIONS * 1000).toFixed(2)} µs/op`);
  console.log(`    get (hit):       ${(cacheResult.getTime / ITERATIONS * 1000).toFixed(2)} µs/op`);
  console.log(`    get (miss):      ${(cacheResult.missTime / ITERATIONS * 1000).toFixed(2)} µs/op`);
  console.log(`    getOrCreate:     ${(cacheResult.getOrCreateTime / ITERATIONS * 1000).toFixed(2)} µs/op`);
  console.log(`    hit rate:        ${(cacheResult.stats.hitRate * 100).toFixed(1)}%`);

  console.log("\n  MetricsCollector:");
  console.log(`    recordToolCall:  ${(metricsResult.recordTime / ITERATIONS * 1000).toFixed(2)} µs/op`);
  console.log(`    recordTokens:    ${(metricsResult.recordTokensTime / ITERATIONS * 1000).toFixed(2)} µs/op`);
  console.log(`    getDailySummary: ${(metricsResult.dailyTime / ITERATIONS * 1000).toFixed(2)} µs/op`);
  console.log(`    exportCSV:       ${(metricsResult.csvTime / ITERATIONS * 1000).toFixed(2)} µs/op`);

  const totalOps = ITERATIONS * 7; // 7 operações testadas
  const totalTime = ctxResult.trackTime + ctxResult.summaryTime + ctxResult.contextTime +
    cacheResult.setTime + cacheResult.getTime + cacheResult.missTime + cacheResult.getOrCreateTime;

  console.log(`\n  Total: ${totalOps} operações em ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`  Throughput geral: ${((totalOps / totalTime) * 1000).toFixed(0)} ops/s`);

  // Cleanup
  cleanup();
  console.log("\n  ✓ Benchmark concluído e temporários limpos.\n");
}

main();
