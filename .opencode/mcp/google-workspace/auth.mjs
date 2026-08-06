#!/usr/bin/env node

/**
 * Google Workspace OAuth 2.0 Authorization Script
 * 
 * Uso:
 *   node auth.mjs --setup       # Configurar credenciais (copiar credentials.json)
 *   node auth.mjs --authorize   # Autorizar e obter tokens
 *   node auth.mjs --verify      # Verificar se tokens são válidos
 *   node auth.mjs --refresh     # Forçar refresh do token
 */

import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createInterface } from "readline";
import { exec } from "child_process";
import { createServer } from "http";
import { URL } from "url";

// ============================================================
// Configuração
// ============================================================

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

const TOKEN_DIR = join(homedir(), ".config", "google-workspace-mcp");
const TOKEN_PATH = join(TOKEN_DIR, "tokens.json");
const CREDENTIALS_PATH = join(TOKEN_DIR, "credentials.json");

// ============================================================
// Funções auxiliares
// ============================================================

function ensureTokenDir() {
  if (!existsSync(TOKEN_DIR)) {
    mkdirSync(TOKEN_DIR, { recursive: true });
    console.log(`✓ Diretório criado: ${TOKEN_DIR}`);
  }
}

function loadCredentials() {
  if (!existsSync(CREDENTIALS_PATH)) {
    console.error(`✗ Credenciais não encontradas em: ${CREDENTIALS_PATH}`);
    console.error(`  Execute: node auth.mjs --setup`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
}

function loadTokens() {
  if (!existsSync(TOKEN_PATH)) return null;
  return JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
}

function saveTokens(tokens) {
  ensureTokenDir();
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`✓ Tokens salvos em: ${TOKEN_PATH}`);
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === "darwin") cmd = `open "${url}"`;
  else if (platform === "win32") cmd = `start "${url}"`;
  else cmd = `xdg-open "${url}" || sensible-browser "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      console.log(`\n⚠ Não foi possível abrir o navegador automaticamente.`);
      console.log(`  Abra manualmente esta URL:\n\n  ${url}\n`);
    }
  });
}

function askQuestion(query) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ============================================================
// Comandos
// ============================================================

async function setup() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Google Workspace MCP - Setup de Credenciais");
  console.log("═══════════════════════════════════════════════════════\n");

  ensureTokenDir();

  if (existsSync(CREDENTIALS_PATH)) {
    console.log(`⚠ Credenciais já existem em: ${CREDENTIALS_PATH}`);
    const overwrite = await askQuestion("  Sobrescrever? (s/N): ");
    if (overwrite.toLowerCase() !== "s") {
      console.log("  Mantendo credenciais existentes.\n");
      return;
    }
  }

  console.log("📋 Para obter as credenciais:");
  console.log("  1. Acesse: https://console.cloud.google.com/apis/credentials");
  console.log("  2. Selecione ou crie um OAuth 2.0 Client ID (tipo: Desktop App)");
  console.log("  3. Clique em 'Download JSON'");
  console.log("  4. Cole o conteúdo JSON abaixo:\n");

  const jsonContent = await askQuestion("  Cole o JSON das credenciais: ");

  try {
    const credentials = JSON.parse(jsonContent);
    writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
    console.log(`\n✓ Credenciais salvas em: ${CREDENTIALS_PATH}`);
  } catch (e) {
    console.error(`\n✗ JSON inválido: ${e.message}`);
    process.exit(1);
  }
}

async function authorize() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Google Workspace MCP - Autorização OAuth 2.0");
  console.log("═══════════════════════════════════════════════════════\n");

  const credentials = loadCredentials();
  const { client_secret, client_id, redirect_uris } =
    credentials.installed || credentials.web;

  // Usar redirect_uri do credentials.json ou porta 3000 como padrão
  const REDIRECT_URI = redirect_uris[0] || "http://localhost:3000";

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    REDIRECT_URI
  );

  // Verificar se já temos tokens válidos
  const existingTokens = loadTokens();
  if (existingTokens?.access_token) {
    oAuth2Client.setCredentials(existingTokens);

    try {
      // Testar se o token ainda é válido
      const tokenInfo = await oAuth2Client.getAccessToken();
      console.log("✓ Tokens existentes são válidos!\n");

      const profile = await google.oauth2({ version: "v2", auth: oAuth2Client }).userinfo.get();
      console.log(`  Conta: ${profile.data.email}`);
      console.log(`  Nome: ${profile.data.name}\n`);

      const refresh = await askQuestion("  Deseja re-autorizar? (s/N): ");
      if (refresh.toLowerCase() !== "s") {
        console.log("  Autorização mantida.\n");
        return;
      }
    } catch (e) {
      console.log("⚠ Tokens expirados ou inválidos. Gerando nova autorização...\n");
    }
  }

  // Criar servidor local para capturar o callback
  // Detectar porta do redirect_uri (ou usar 80 como padrão)
  const parsedRedirect = new URL(REDIRECT_URI);
  const REDIRECT_PORT = parsedRedirect.port ? parseInt(parsedRedirect.port) : 80;

  const code = await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);

      // Capturar código em qualquer rota
      const authCode = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <html>
          <head><title>Erro de Autorização</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Erro de Autorização</h1>
            <p>Erro: ${error}</p>
            <p>Fechando esta janela...</p>
          </body>
          </html>
        `);
        server.close();
        reject(new Error(`Erro de autorização: ${error}`));
        return;
      }

      if (authCode) {
        // Página de sucesso
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <html>
          <head><title>Autorização Concluída</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #f0f8ff;">
            <h1>✅ Autorização Concluída!</h1>
            <p>Você pode fechar esta janela e voltar ao terminal.</p>
            <p style="color: #666; font-size: 14px;">Google Workspace MCP configurado com sucesso.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
          </html>
        `);

        server.close();
        resolve(authCode);
      } else {
        // Sem código - mostrar instruções
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <html>
          <head><title>Aguardando autorização...</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>🔄 Aguardando autorização do Google...</h1>
            <p>Esta página será atualizada automaticamente.</p>
          </body>
          </html>
        `);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`🔗 Servidor local rodando na porta ${REDIRECT_PORT}`);
      console.log(`📍 Aguardando callback em: ${REDIRECT_URI}`);
      console.log(`\n🌐 Abrindo navegador para autorização...\n`);

      // Gerar URL de autorização
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
        redirect_uri: REDIRECT_URI,
      });

      openBrowser(authUrl);

      console.log("  Aguardando autorização no navegador...");
      console.log("  (Se o navegador não abriu, copie a URL acima)\n");
    });

    // Timeout após 5 minutos
    setTimeout(() => {
      server.close();
      reject(new Error("Timeout: autorização não concluída em 5 minutos"));
    }, 5 * 60 * 1000);
  });

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    saveTokens(tokens);

    oAuth2Client.setCredentials(tokens);
    const profile = await google.oauth2({ version: "v2", auth: oAuth2Client }).userinfo.get();

    console.log("\n✓ Autorização concluída com sucesso!");
    console.log(`  Conta: ${profile.data.email}`);
    console.log(`  Nome: ${profile.data.name}`);
    console.log(`  Access Token: ${tokens.access_token?.substring(0, 20)}...`);
    console.log(`  Refresh Token: ${tokens.refresh_token ? "Sim ✓" : "Não"}`);
    console.log(`  Expira em: ${tokens.expiry_date ? new Date(tokens.expiry_date).toLocaleString() : "N/A"}\n`);
  } catch (error) {
    console.error(`\n✗ Erro na autorização: ${error.message}`);
    if (error.message.includes("invalid_grant")) {
      console.error("  O código expirou ou já foi usado. Tente novamente.");
    }
    process.exit(1);
  }
}

async function verify() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Google Workspace MCP - Verificar Tokens");
  console.log("═══════════════════════════════════════════════════════\n");

  const tokens = loadTokens();
  if (!tokens) {
    console.log("✗ Nenhum token encontrado.");
    console.log("  Execute: node auth.mjs --authorize\n");
    process.exit(1);
  }

  console.log(`  Tokens encontrados em: ${TOKEN_PATH}`);
  console.log(`  Access Token: ${tokens.access_token?.substring(0, 20)}...`);
  console.log(`  Refresh Token: ${tokens.refresh_token ? "Sim ✓" : "Não ✗"}`);
  console.log(`  Expira em: ${tokens.expiry_date ? new Date(tokens.expiry_date).toLocaleString() : "N/A"}`);

  // Verificar se expirou
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    console.log("\n  ⚠ Token expirado. Tentando refresh...");
    if (!tokens.refresh_token) {
      console.log("  ✗ Sem refresh token. Execute: node auth.mjs --authorize\n");
      process.exit(1);
    }
  }

  // Testar conexão
  try {
    const credentials = loadCredentials();
    const { client_secret, client_id, redirect_uris } =
      credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );
    oAuth2Client.setCredentials(tokens);

    const profile = await google.oauth2({ version: "v2", auth: oAuth2Client }).userinfo.get();
    console.log(`\n  ✓ Conexão verificada!`);
    console.log(`  Conta: ${profile.data.email}`);
    console.log(`  Nome: ${profile.data.name}\n`);
  } catch (error) {
    console.error(`\n  ✗ Erro na verificação: ${error.message}\n`);
    process.exit(1);
  }
}

async function refreshToken() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Google Workspace MCP - Refresh Token");
  console.log("═══════════════════════════════════════════════════════\n");

  const tokens = loadTokens();
  if (!tokens?.refresh_token) {
    console.log("✗ Sem refresh token disponível.");
    console.log("  Execute: node auth.mjs --authorize\n");
    process.exit(1);
  }

  try {
    const credentials = loadCredentials();
    const { client_secret, client_id, redirect_uris } =
      credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );
    oAuth2Client.setCredentials(tokens);

    const { token } = await oAuth2Client.refreshAccessToken();
    saveTokens(token);
    console.log("✓ Token atualizado com sucesso!\n");
  } catch (error) {
    console.error(`✗ Erro no refresh: ${error.message}\n`);
    process.exit(1);
  }
}

// ============================================================
// Main
// ============================================================

const args = process.argv.slice(2);

if (args.includes("--setup")) {
  await setup();
} else if (args.includes("--authorize")) {
  await authorize();
} else if (args.includes("--verify")) {
  await verify();
} else if (args.includes("--refresh")) {
  await refreshToken();
} else {
  console.log(`
Google Workspace MCP - Ferramenta de Autenticação

Uso:
  node auth.mjs --setup       Configurar credenciais (copiar JSON do Google Cloud)
  node auth.mjs --authorize   Autorizar e obter tokens OAuth
  node auth.mjs --verify      Verificar se tokens são válidos
  node auth.mjs --refresh     Forçar refresh do token

Fluxo típico:
  1. node auth.mjs --setup       (primeira vez, colar credenciais)
  2. node auth.mjs --authorize   (abrir navegador e autorizar)
  3. node auth.mjs --verify      (verificar se funciona)
  `);
}
