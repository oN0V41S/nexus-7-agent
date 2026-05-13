/**
 * Nexus Dashboard Server
 *
 * UI visual para logs, memória, handoffs e agentes do ecossistema Nexus.
 * Servidor HTTP standalone que expõe uma interface web.
 *
 * Uso: node .opencode/dashboard/server.ts
 * Acessar: http://localhost:37777
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";

// ============================================================
// Config
// ============================================================

const PORT = parseInt(process.env.NEXUS_DASHBOARD_PORT || "37777", 10);
const WORKTREE = process.cwd();
const LOGS_DIR = path.join(WORKTREE, ".opencode/logs");
const MEMORY_DIR = path.join(WORKTREE, ".opencode/memory");
const HANDOFF_DIR = path.join(MEMORY_DIR, "handoffs");
const AGENTS_DIR = path.join(WORKTREE, ".opencode/agents");
const SKILLS_DIR = path.join(WORKTREE, ".opencode/skills");
const DB_PATH = path.join(MEMORY_DIR, "nexus-memory.db");

// ============================================================
// Data API
// ============================================================

function getLogs(): any[] {
  if (!fs.existsSync(LOGS_DIR)) return [];
  return fs.readdirSync(LOGS_DIR)
    .filter((f) => f.endsWith(".log"))
    .map((f) => {
      const filePath = path.join(LOGS_DIR, f);
      const content = fs.readFileSync(filePath, "utf-8").trim();
      const lines = content.split("\n").filter(Boolean).slice(-50);
      return {
        file: f,
        size: fs.statSync(filePath).size,
        lines: lines.length,
        lastEntries: lines.slice(-20).map((l) => {
          const match = l.match(/^\[(.+?)\]\s*\[(\w+)\]\s*(.+?)$/);
          if (match) {
            return { timestamp: match[1], level: match[2], message: match[3].slice(0, 200) };
          }
          return { timestamp: "", level: "INFO", message: l.slice(0, 200) };
        }),
      };
    });
}

function getMemoryStats(): any {
  if (!fs.existsSync(DB_PATH)) {
    return { status: "no_db", entries: 0 };
  }

  try {
    const BetterSqlite3 = require("better-sqlite3");
    const db = new BetterSqlite3(DB_PATH);
    const count = (db.prepare("SELECT COUNT(*) as c FROM memories").get() as any).c;
    const byScope = db.prepare("SELECT scope, COUNT(*) as c FROM memories GROUP BY scope ORDER BY c DESC").all();
    const recent = db.prepare("SELECT key, scope, agent, savedAt FROM memories ORDER BY savedAt DESC LIMIT 10").all();
    db.close();
    return { status: "ok", entries: count, byScope, recent };
  } catch {
    return { status: "error", entries: 0 };
  }
}

function getHandoffs(): any[] {
  if (!fs.existsSync(HANDOFF_DIR)) return [];
  return fs.readdirSync(HANDOFF_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const c = JSON.parse(fs.readFileSync(path.join(HANDOFF_DIR, f), "utf-8"));
        return {
          id: c.id,
          title: c.title,
          createdAt: c.createdAt,
          fromAgent: c.fromAgent,
          type: c.type || "manual",
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getAgents(): any[] {
  if (!fs.existsSync(AGENTS_DIR)) return [];
  return fs.readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const content = fs.readFileSync(path.join(AGENTS_DIR, f), "utf-8");
      const descMatch = content.match(/description:\s*["']?(.+?)["']?\n/);
      const modeMatch = content.match(/mode:\s*(\w+)/);
      return {
        name: f.replace(".md", ""),
        description: descMatch ? descMatch[1] : "Sem descrição",
        mode: modeMatch ? modeMatch[1] : "unknown",
      };
    });
}

function getSkills(): any[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs.readdirSync(SKILLS_DIR)
    .filter((f) => fs.statSync(path.join(SKILLS_DIR, f)).isDirectory())
    .map((name) => {
      const skillPath = path.join(SKILLS_DIR, name, "SKILL.md");
      if (!fs.existsSync(skillPath)) return { name, description: "Sem SKILL.md" };
      const content = fs.readFileSync(skillPath, "utf-8");
      const descMatch = content.match(/description:\s*["']?(.+?)["']?\n/);
      return {
        name,
        description: descMatch ? descMatch[1] : "Sem descrição",
      };
    });
}

// ============================================================
// HTML Template
// ============================================================

function renderDashboard(): string {
  const logs = getLogs();
  const memory = getMemoryStats();
  const handoffs = getHandoffs();
  const agents = getAgents();
  const skills = getSkills();

  const logRows = logs.map(
    (l) => `<tr>
      <td>${l.file}</td>
      <td>${(l.size / 1024).toFixed(1)} KB</td>
      <td>${l.lines}</td>
      <td><pre class="log-preview">${l.lastEntries.map((e: any) => `<span class="level-${e.level.toLowerCase()}">[${e.level}]</span> ${e.message}`).join("\n")}</pre></td>
    </tr>`,
  ).join("");

  const memScopes = memory.byScope
    ? (memory.byScope as any[]).map((s: any) => `<span class="badge">${s.scope}: ${s.c}</span>`).join("")
    : "";

  const handoffCards = handoffs.map(
    (h) => `<div class="card">
      <div class="card-title">${h.title}</div>
      <div class="card-meta">${h.createdAt} | ${h.fromAgent} | ${h.type}</div>
      <div class="card-id">${h.id}</div>
    </div>`,
  ).join("");

  const agentRows = agents.map(
    (a) => `<tr>
      <td><code>@${a.name}</code></td>
      <td><span class="badge ${a.mode}">${a.mode}</span></td>
      <td>${a.description}</td>
    </tr>`,
  ).join("");

  const skillRows = skills.map(
    (s) => `<tr><td><code>${s.name}</code></td><td>${s.description}</td></tr>`,
  ).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexus Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 20px;
    }
    h1 { color: #58a6ff; font-size: 1.5rem; margin-bottom: 20px; }
    h2 { color: #8b949e; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 10px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 15px; }
    .stat-number { font-size: 2rem; font-weight: 600; color: #58a6ff; }
    .stat-label { font-size: 0.8rem; color: #8b949e; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; background: #161b22; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #30363d; }
    th { background: #1c2128; color: #8b949e; font-size: 0.8rem; text-transform: uppercase; }
    td { font-size: 0.85rem; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 12px;
      font-size: 0.75rem; font-weight: 500; margin: 2px;
    }
    .badge.primary { background: #1f6feb33; color: #58a6ff; }
    .badge.subagent { background: #23863633; color: #3fb950; }
    .badge.sub { background: #23863633; color: #3fb950; }
    .badge.session { background: #1f6feb33; color: #58a6ff; }
    .badge.observations { background: #9e6a0333; color: #d29922; }
    .badge.project { background: #bc8cff33; color: #bc8cff; }
    pre.log-preview { font-size: 0.75rem; line-height: 1.4; max-height: 120px; overflow-y: auto; white-space: pre-wrap; }
    .level-info { color: #8b949e; }
    .level-warn { color: #d29922; }
    .level-error { color: #f85149; }
    .level-debug { color: #58a6ff; }
    .level-trace { color: #484f58; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px; }
    .card-title { color: #c9d1d9; font-weight: 500; }
    .card-meta { color: #8b949e; font-size: 0.8rem; margin: 4px 0; }
    .card-id { font-size: 0.7rem; color: #484f58; font-family: monospace; }
    .handoff-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
    .status-ok { color: #3fb950; }
    .status-error { color: #f85149; }
    .text-muted { color: #8b949e; }
    .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .refresh-btn {
      background: #238636; color: white; border: none; padding: 6px 16px;
      border-radius: 6px; cursor: pointer; font-size: 0.85rem;
    }
    .refresh-btn:hover { background: #2ea043; }
    .footer { text-align: center; color: #484f58; font-size: 0.75rem; margin-top: 30px; padding: 20px; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #161b22; }
    ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="header-bar">
    <h1>🔮 Nexus Dashboard</h1>
    <button class="refresh-btn" onclick="location.reload()">↻ Atualizar</button>
  </div>

  <!-- Status Cards -->
  <div class="grid">
    <div class="stat-card">
      <div class="stat-number">${memory.entries}</div>
      <div class="stat-label">🧠 Entradas na Memória</div>
      <div style="margin-top: 8px">${memScopes}</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${logs.length}</div>
      <div class="stat-label">📋 Arquivos de Log</div>
      <div class="text-muted" style="margin-top:4px;font-size:0.8rem">
        ${logs.reduce((s: number, l: any) => s + l.lines, 0)} linhas no total
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${handoffs.length}</div>
      <div class="stat-label">🔄 Handoffs Salvos</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${agents.length}</div>
      <div class="stat-label">🤖 Agentes</div>
      <div class="text-muted" style="margin-top:4px;font-size:0.8rem">
        ${skills.length} skills
      </div>
    </div>
  </div>

  <!-- Handoffs -->
  <h2>🔄 Handoffs Recentes</h2>
  ${handoffs.length > 0
    ? `<div class="handoff-grid">${handoffCards}</div>`
    : `<p class="text-muted">Nenhum handoff salvo ainda.</p>`}

  <!-- Agents -->
  <h2>🤖 Agentes do Ecossistema</h2>
  <table>
    <thead><tr><th>Agente</th><th>Mode</th><th>Descrição</th></tr></thead>
    <tbody>${agentRows}</tbody>
  </table>

  <!-- Skills -->
  <h2>📚 Skills</h2>
  <table>
    <thead><tr><th>Skill</th><th>Descrição</th></tr></thead>
    <tbody>${skillRows}</tbody>
  </table>

  <!-- Logs -->
  <h2>📋 Logs Recentes</h2>
  <table>
    <thead><tr><th>Arquivo</th><th>Tamanho</th><th>Linhas</th><th>Últimas Entradas</th></tr></thead>
    <tbody>${logRows}</tbody>
  </table>

  <div class="footer">
    Nexus 7 Agent · Dashboard ${PORT} · ${new Date().toISOString()}
  </div>
</body>
</html>`;
}

// ============================================================
// HTTP Server
// ============================================================

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API endpoints
  if (req.url === "/api/logs") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getLogs()));
    return;
  }
  if (req.url === "/api/memory") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getMemoryStats()));
    return;
  }
  if (req.url === "/api/handoffs") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getHandoffs()));
    return;
  }
  if (req.url === "/api/agents") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ agents: getAgents(), skills: getSkills() }));
    return;
  }

  // Dashboard HTML
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(renderDashboard());
});

server.listen(PORT, () => {
  console.log(`🔮 Nexus Dashboard: http://localhost:${PORT}`);
  console.log(`📋 Logs: ${LOGS_DIR}`);
  console.log(`🧠 Memória: ${MEMORY_DIR}`);
  console.log(`🤖 Agentes: ${AGENTS_DIR}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Dashboard encerrado.");
  process.exit(0);
});
