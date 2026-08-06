#!/usr/bin/env node

import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const TOKEN_PATH = join(homedir(), ".config", "google-workspace-mcp", "tokens.json");

async function testWithCurl() {
  console.log("🔍 Testando token com curl...\n");

  const tokens = JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
  const accessToken = tokens.access_token;

  console.log(`Token: ${accessToken.substring(0, 20)}...`);
  console.log(`Expira em: ${new Date(tokens.expiry_date).toLocaleString()}\n`);

  // Testar com Google OAuth2
  console.log("Testando com Google OAuth2 API...");
  
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Token válido!");
      console.log(`   Email: ${data.email}`);
      console.log(`   Scope: ${data.scope}`);
      console.log(`   Expira em: ${new Date(parseInt(data.exp) * 1000).toLocaleString()}`);
    } else {
      const error = await response.text();
      console.log(`❌ Token inválido: ${error}`);
    }
  } catch (error) {
    console.error(`❌ Erro: ${error.message}`);
  }
}

testWithCurl();
