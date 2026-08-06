#!/usr/bin/env node

/**
 * Google Workspace MCP Server
 * Proxy stdio → HTTP para APIs do Google Workspace (Drive, Docs, Sheets, Gmail)
 * 
 * Autenticação: OAuth 2.0 com refresh token
 * Tokens armazenados em: ~/.config/google-workspace-mcp/tokens.json
 */

import { createServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createInterface } from "readline";

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
// Gerenciamento de Credenciais
// ============================================================

function loadCredentials() {
  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Credenciais não encontradas em: ${CREDENTIALS_PATH}\n` +
      `Execute: node auth.mjs --setup para configurar.`
    );
  }
  return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
}

function loadTokens() {
  if (!existsSync(TOKEN_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
}

function saveTokens(tokens) {
  if (!existsSync(TOKEN_DIR)) {
    mkdirSync(TOKEN_DIR, { recursive: true });
  }
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

async function getAuthenticatedClient() {
  const credentials = loadCredentials();
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const tokens = loadTokens();
  if (!tokens) {
    throw new Error(
      "Tokens não encontrados. Execute: node auth.mjs --authorize"
    );
  }

  oAuth2Client.setCredentials(tokens);

  // Auto-refresh token se expirado
  oAuth2Client.on("tokens", (newTokens) => {
    const existing = loadTokens() || {};
    saveTokens({ ...existing, ...newTokens });
  });

  return oAuth2Client;
}

// ============================================================
// Tools MCP
// ============================================================

const TOOLS = [
  // Google Drive
  {
    name: "gdrive_list_files",
    description: "Lista arquivos no Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query de busca (opcional)" },
        pageSize: { type: "number", description: "Número de resultados (máx 100)", default: 10 },
        pageToken: { type: "string", description: "Token para paginação" },
      },
    },
  },
  {
    name: "gdrive_search",
    description: "Busca arquivos no Google Drive por nome ou conteúdo",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo de busca" },
        mimeType: { type: "string", description: "Filtrar por tipo MIME (ex: application/pdf)" },
        pageSize: { type: "number", description: "Número de resultados", default: 10 },
      },
      required: ["query"],
    },
  },
  {
    name: "gdrive_read_file",
    description: "Lê conteúdo de um arquivo do Google Drive (Google Docs, Sheets)",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "ID do arquivo no Drive" },
        mimeType: { type: "string", description: "Tipo MIME para exportação" },
      },
      required: ["fileId"],
    },
  },
  {
    name: "gdrive_create_file",
    description: "Cria um arquivo de texto no Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do arquivo" },
        content: { type: "string", description: "Conteúdo do arquivo" },
        mimeType: { type: "string", description: "Tipo MIME", default: "text/plain" },
        folderId: { type: "string", description: "ID da pasta (opcional)" },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "gdrive_upload_file",
    description: "Faz upload de arquivo local para o Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Caminho do arquivo local" },
        name: { type: "string", description: "Nome no Drive (opcional)" },
        mimeType: { type: "string", description: "Tipo MIME (opcional)" },
        folderId: { type: "string", description: "ID da pasta (opcional)" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "gdrive_delete_file",
    description: "Move um arquivo para lixeira do Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "ID do arquivo" },
      },
      required: ["fileId"],
    },
  },
  {
    name: "gdrive_export",
    description: "Exporta um Google Doc em formato específico (PDF, DOCX, TXT)",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "ID do documento" },
        format: {
          type: "string",
          enum: ["pdf", "docx", "txt", "html", "md"],
          description: "Formato de exportação",
          default: "pdf",
        },
        outputPath: { type: "string", description: "Caminho de saída (opcional)" },
      },
      required: ["fileId"],
    },
  },

  // Google Docs
  {
    name: "gdocs_create",
    description: "Cria um novo documento Google Docs",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título do documento" },
        content: { type: "string", description: "Conteúdo inicial (opcional)" },
      },
      required: ["title"],
    },
  },
  {
    name: "gdocs_read",
    description: "Lê conteúdo de um documento Google Docs",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "ID do documento" },
      },
      required: ["documentId"],
    },
  },
  {
    name: "gdocs_update",
    description: "Atualiza conteúdo de um documento Google Docs",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "ID do documento" },
        content: { type: "string", description: "Novo conteúdo" },
        mode: {
          type: "string",
          enum: ["replace", "append"],
          description: "Modo de atualização",
          default: "replace",
        },
      },
      required: ["documentId", "content"],
    },
  },

  // Google Sheets
  {
    name: "gsheets_create",
    description: "Cria uma nova planilha Google Sheets",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título da planilha" },
      },
      required: ["title"],
    },
  },
  {
    name: "gsheets_read",
    description: "Lê dados de uma planilha Google Sheets",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "ID da planilha" },
        range: { type: "string", description: "Intervalo (ex: A1:D10)", default: "A:Z" },
      },
      required: ["spreadsheetId"],
    },
  },
  {
    name: "gsheets_write",
    description: "Escreve dados em uma planilha Google Sheets",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "ID da planilha" },
        range: { type: "string", description: "Intervalo (ex: A1)" },
        values: {
          type: "array",
          description: "Dados em formato [[row1col1, row1col2], ...]",
          items: { type: "array" },
        },
      },
      required: ["spreadsheetId", "range", "values"],
    },
  },

  // Gmail
  {
    name: "gmail_search",
    description: "Busca e-mails no Gmail",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query de busca (sintaxe Gmail)" },
        maxResults: { type: "number", description: "Número máximo de resultados", default: 10 },
      },
      required: ["query"],
    },
  },
  {
    name: "gmail_read",
    description: "Lê conteúdo de um e-mail específico",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "ID da mensagem" },
      },
      required: ["messageId"],
    },
  },
  {
    name: "gmail_send",
    description: "Envia um e-mail pelo Gmail",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Destinatário(s)" },
        subject: { type: "string", description: "Assunto" },
        body: { type: "string", description: "Corpo do e-mail" },
        isHtml: { type: "boolean", description: " corpo em HTML?", default: false },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "gmail_labels",
    description: "Lista labels/etiquetas do Gmail",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ============================================================
// Implementação das Tools
// ============================================================

async function executeTool(name, args) {
  const auth = await getAuthenticatedClient();

  switch (name) {
    // --- Google Drive ---
    case "gdrive_list_files": {
      const drive = google.drive({ version: "v3", auth });
      const res = await drive.files.list({
        q: args.query || undefined,
        pageSize: args.pageSize || 10,
        pageToken: args.pageToken || undefined,
        fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)",
        orderBy: "modifiedTime desc",
      });
      return { files: res.data.files, nextPageToken: res.data.nextPageToken };
    }

    case "gdrive_search": {
      const drive = google.drive({ version: "v3", auth });
      let query = `name contains '${args.query}'`;
      if (args.mimeType) {
        query += ` and mimeType='${args.mimeType}'`;
      }
      const res = await drive.files.list({
        q: query,
        pageSize: args.pageSize || 10,
        fields: "files(id, name, mimeType, size, modifiedTime)",
        orderBy: "relevance",
      });
      return { files: res.data.files };
    }

    case "gdrive_read_file": {
      const drive = google.drive({ version: "v3", auth });
      const mimeType = args.mimeType || "text/plain";
      const res = await drive.files.export(
        { fileId: args.fileId, mimeType },
        { responseType: "text" }
      );
      return { content: res.data };
    }

    case "gdrive_create_file": {
      const drive = google.drive({ version: "v3", auth });
      const fileMetadata = { name: args.name };
      if (args.folderId) fileMetadata.parents = [args.folderId];

      const res = await drive.files.create({
        resource: fileMetadata,
        media: {
          mimeType: args.mimeType || "text/plain",
          body: args.content,
        },
        fields: "id, name, webViewLink",
      });
      return { file: res.data };
    }

    case "gdrive_upload_file": {
      const drive = google.drive({ version: "v3", auth });
      const { readFileSync } = await import("fs");
      const fileContent = readFileSync(args.filePath);

      const fileMetadata = { name: args.name || args.filePath.split("/").pop() };
      if (args.folderId) fileMetadata.parents = [args.folderId];

      const res = await drive.files.create({
        resource: fileMetadata,
        media: {
          mimeType: args.mimeType || "application/octet-stream",
          body: fileContent,
        },
        fields: "id, name, webViewLink",
      });
      return { file: res.data };
    }

    case "gdrive_delete_file": {
      const drive = google.drive({ version: "v3", auth });
      await drive.files.delete({ fileId: args.fileId });
      return { success: true, message: "Arquivo movido para lixeira" };
    }

    case "gdrive_export": {
      const drive = google.drive({ version: "v3", auth });
      const mimeTypes = {
        pdf: "application/pdf",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        txt: "text/plain",
        html: "text/html",
        md: "text/markdown",
      };
      const mimeType = mimeTypes[args.format] || "application/pdf";
      const res = await drive.files.export(
        { fileId: args.fileId, mimeType },
        { responseType: "arraybuffer" }
      );

      const ext = args.format || "pdf";
      const outputPath = args.outputPath || `export_${args.fileId}.${ext}`;
      const { writeFileSync } = await import("fs");
      writeFileSync(outputPath, Buffer.from(res.data));
      return { success: true, path: outputPath, format: ext };
    }

    // --- Google Docs ---
    case "gdocs_create": {
      const docs = google.docs({ version: "v1", auth });
      const res = await docs.documents.create({
        requestBody: { title: args.title },
      });

      if (args.content) {
        await docs.documents.batchUpdate({
          documentId: res.data.documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: args.content,
                },
              },
            ],
          },
        });
      }

      return {
        documentId: res.data.documentId,
        title: res.data.title,
        url: `https://docs.google.com/document/d/${res.data.documentId}/edit`,
      };
    }

    case "gdocs_read": {
      const docs = google.docs({ version: "v1", auth });
      const res = await docs.documents.get({ documentId: args.documentId });

      let text = "";
      for (const element of res.data.body.content || []) {
        if (element.paragraph) {
          for (const el of element.paragraph.elements || []) {
            if (el.textRun) {
              text += el.textRun.content;
            }
          }
        }
      }

      return { title: res.data.title, content: text };
    }

    case "gdocs_update": {
      const docs = google.docs({ version: "v1", auth });

      if (args.mode === "append") {
        const doc = await docs.documents.get({ documentId: args.documentId });
        const endIndex = doc.data.body.content.slice(-1)[0]?.endIndex || 1;

        await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: { index: endIndex - 1 },
                  text: args.content,
                },
              },
            ],
          },
        });
      } else {
        // Replace: limpa e insere
        const doc = await docs.documents.get({ documentId: args.documentId });
        const endIndex = doc.data.body.content.slice(-1)[0]?.endIndex || 1;

        await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                deleteContentRange: {
                  range: { startIndex: 1, endIndex: endIndex - 1 },
                },
              },
              {
                insertText: {
                  location: { index: 1 },
                  text: args.content,
                },
              },
            ],
          },
        });
      }

      return { success: true, documentId: args.documentId };
    }

    // --- Google Sheets ---
    case "gsheets_create": {
      const sheets = google.sheets({ version: "v4", auth });
      const res = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: args.title },
        },
      });
      return {
        spreadsheetId: res.data.spreadsheetId,
        title: res.data.properties.title,
        url: res.data.spreadsheetUrl,
      };
    }

    case "gsheets_read": {
      const sheets = google.sheets({ version: "v4", auth });
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: args.spreadsheetId,
        range: args.range || "A:Z",
      });
      return { values: res.data.values || [] };
    }

    case "gsheets_write": {
      const sheets = google.sheets({ version: "v4", auth });
      await sheets.spreadsheets.values.update({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: args.values },
      });
      return { success: true };
    }

    // --- Gmail ---
    case "gmail_search": {
      const gmail = google.gmail({ version: "v1", auth });
      const res = await gmail.users.messages.list({
        userId: "me",
        q: args.query,
        maxResults: args.maxResults || 10,
      });

      const messages = [];
      for (const msg of res.data.messages || []) {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });
        const headers = detail.data.payload?.headers || [];
        messages.push({
          id: msg.id,
          subject: headers.find((h) => h.name === "Subject")?.value || "",
          from: headers.find((h) => h.name === "From")?.value || "",
          date: headers.find((h) => h.name === "Date")?.value || "",
          snippet: detail.data.snippet,
        });
      }

      return { messages, total: res.data.resultSizeEstimate };
    }

    case "gmail_read": {
      const gmail = google.gmail({ version: "v1", auth });
      const res = await gmail.users.messages.get({
        userId: "me",
        id: args.messageId,
        format: "full",
      });

      const headers = res.data.payload?.headers || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "";
      const from = headers.find((h) => h.name === "From")?.value || "";
      const date = headers.find((h) => h.name === "Date")?.value || "";

      let body = "";
      if (res.data.payload?.body?.data) {
        body = Buffer.from(res.data.payload.body.data, "base64").toString("utf-8");
      } else if (res.data.payload?.parts) {
        for (const part of res.data.payload.parts) {
          if (part.mimeType === "text/plain" && part.body?.data) {
            body = Buffer.from(part.body.data, "base64").toString("utf-8");
            break;
          }
        }
      }

      return { subject, from, date, body, labels: res.data.labelIds };
    }

    case "gmail_send": {
      const gmail = google.gmail({ version: "v1", auth });

      const mimeMessage = [
        `To: ${args.to}`,
        `Subject: ${args.subject}`,
        `Content-Type: ${args.isHtml ? "text/html" : "text/plain"}; charset=utf-8`,
        "",
        args.body,
      ].join("\r\n");

      const encodedMessage = Buffer.from(mimeMessage)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encodedMessage },
      });

      return { success: true, messageId: res.data.id };
    }

    case "gmail_labels": {
      const gmail = google.gmail({ version: "v1", auth });
      const res = await gmail.users.labels.list({ userId: "me" });
      return { labels: res.data.labels.map((l) => ({ id: l.id, name: l.name })) };
    }

    default:
      throw new Error(`Tool desconhecida: ${name}`);
  }
}

// ============================================================
// Servidor MCP
// ============================================================

const server = createServer(
  {
    name: "google-workspace-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await executeTool(name, args || {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Erro: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================
// Iniciar servidor
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Workspace MCP Server rodando via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
