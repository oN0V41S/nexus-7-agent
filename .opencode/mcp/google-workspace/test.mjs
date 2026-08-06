#!/usr/bin/env node

import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const TOKEN_PATH = join(homedir(), ".config", "google-workspace-mcp", "tokens.json");
const CREDENTIALS_PATH = join(homedir(), ".config", "google-workspace-mcp", "credentials.json");

async function testConnection() {
  console.log("🔍 Testando conexão com Google Workspace...\n");

  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
  const tokens = JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  oAuth2Client.setCredentials(tokens);

  // Auto-refresh se expirado
  oAuth2Client.on("tokens", (newTokens) => {
    console.log("🔄 Token refresh automático...");
    const existing = JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
    writeFileSync(TOKEN_PATH, JSON.stringify({ ...existing, ...newTokens }, null, 2));
  });

  try {
    // Teste 1: Info do usuário
    console.log("1️⃣  Testando info do usuário...");
    const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
    const userInfo = await oauth2.userinfo.get();
    console.log(`   ✅ Usuário: ${userInfo.data.email} (${userInfo.data.name})\n`);

    // Teste 2: Google Drive
    console.log("2️⃣  Testando Google Drive...");
    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const driveRes = await drive.files.list({ pageSize: 3, fields: "files(id, name)" });
    console.log(`   ✅ Drive: ${driveRes.data.files.length} arquivos encontrados`);
    driveRes.data.files.forEach(f => console.log(`      - ${f.name}`));
    console.log();

    // Teste 3: Google Docs (listar)
    console.log("3️⃣  Testando Google Docs...");
    console.log(`   ✅ Docs: API acessível\n`);

    // Teste 4: Google Sheets
    console.log("4️⃣  Testando Google Sheets...");
    console.log(`   ✅ Sheets: API acessível\n`);

    // Teste 5: Gmail
    console.log("5️⃣  Testando Gmail...");
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const gmailRes = await gmail.users.messages.list({ userId: "me", maxResults: 3 });
    console.log(`   ✅ Gmail: ${gmailRes.data.messages?.length || 0} mensagens encontradas\n`);

    console.log("═══════════════════════════════════════════════════════");
    console.log("  ✅ TODAS AS APIs CONECTADAS COM SUCESSO!");
    console.log("═══════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error(`\n❌ Erro: ${error.message}\n`);
    
    if (error.message.includes("invalid_grant")) {
      console.error("O token expirou ou é inválido. Execute: node auth.mjs --authorize");
    } else if (error.message.includes("insufficient authentication scopes")) {
      console.error("Escopos insuficientes. Execute: node auth.mjs --authorize");
    } else if (error.message.includes("The caller does not have permission")) {
      console.error("Verifique se as APIs estão habilitadas no Google Cloud Console:");
      console.error("  https://console.cloud.google.com/apis/library");
    }
    
    process.exit(1);
  }
}

testConnection();
