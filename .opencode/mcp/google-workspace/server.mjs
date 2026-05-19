#!/usr/bin/env node

/**
 * Nexus Google Workspace MCP Server
 * 
 * Bridge between OpenCode (MCP stdio) and Google Workspace APIs.
 * Handles OAuth 2.0 authentication, token refresh, and exposes
 * Drive, Docs, Sheets, and Gmail tools.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { createServer } from "http";

// ─── Configuration ────────────────────────────────────────────────────
const CONFIG_DIR = join(homedir(), ".config", "nexus-google-mcp");
const TOKEN_PATH = join(CONFIG_DIR, "token.json");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
];

// ─── Credential Management ────────────────────────────────────────────

function loadCredentials() {
  const raw = readFileSync(CREDENTIALS_PATH, "utf8");
  return JSON.parse(raw);
}

function loadToken() {
  if (!existsSync(TOKEN_PATH)) return null;
  const raw = readFileSync(TOKEN_PATH, "utf8");
  return JSON.parse(raw);
}

function saveToken(token) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
  console.error(`[nexus-google] Token saved to ${TOKEN_PATH}`);
}

// ─── OAuth 2.0 Authentication ─────────────────────────────────────────

async function authenticate(credentials) {
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
  const redirectUri = redirect_uris?.[0] || "http://localhost:8080";

  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  // Check if we have a stored token
  const storedToken = loadToken();
  if (storedToken) {
    oauth2Client.setCredentials(storedToken);
    
    // Check if token is expired and refresh if possible
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(
        storedToken.access_token
      ).catch(() => null);
      
      if (!tokenInfo) {
        // Token might be expired, try refresh
        try {
          const { credentials: refreshed } = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(refreshed);
          saveToken(refreshed);
          console.error("[nexus-google] Token refreshed successfully");
        } catch {
          console.error("[nexus-google] Token refresh failed, need re-auth");
          return await doAuthFlow(oauth2Client, client_id, client_secret, redirectUri);
        }
      }
    } catch {
      // getTokenInfo failed, try refresh
      try {
        const { credentials: refreshed } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(refreshed);
        saveToken(refreshed);
        console.error("[nexus-google] Token refreshed successfully");
      } catch {
        return await doAuthFlow(oauth2Client, client_id, client_secret, redirectUri);
      }
    }
    
    return oauth2Client;
  }

  // No stored token, do auth flow
  return await doAuthFlow(oauth2Client, client_id, client_secret, redirectUri);
}

async function doAuthFlow(oauth2Client, clientId, clientSecret, redirectUri) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.error("\n╔══════════════════════════════════════════════════════════════╗");
  console.error("║   Google Workspace MCP - Authentication Required            ║");
  console.error("╠══════════════════════════════════════════════════════════════╣");
  console.error("║   Abra esta URL no seu navegador:                          ║");
  console.error(`║   ${authUrl}`);
  console.error("║                                                            ║");
  console.error("║   Após autorizar, cole o código de autorização aqui.       ║");
  console.error("╚══════════════════════════════════════════════════════════════╝\n");

  // Try to open browser automatically
  try {
    const open = (await import("open")).default;
    await open(authUrl).catch(() => {});
  } catch {
    // open failed, user will need to open manually
  }

  // Start a simple HTTP server to receive the redirect
  const code = await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:8080`);
      const codeParam = url.searchParams.get("code");
      
      if (codeParam) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html><body>
            <h1>✅ Autorizado!</h1>
            <p>Você já pode fechar esta janela.</p>
          </body></html>
        `);
        server.close();
        resolve(codeParam);
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body>Waiting for authorization...</body></html>`);
      }
    });
    
    server.listen(8080, () => {
      console.error("[nexus-google] Listening for OAuth callback on http://localhost:8080");
    });
    
    // Also support CLI paste if browser redirect doesn't work
    // Timeout after 5 minutes if no code received via redirect
    setTimeout(() => {
      server.close();
      resolve(null); // Will fall through to CLI prompt
    }, 300000);
  });

  let finalCode = code;
  
  // If HTTP server didn't get the code, prompt user to paste it
  if (!finalCode) {
    console.error("[nexus-google] Enter the authorization code from the browser:");
    finalCode = await new Promise((resolve) => {
      process.stdin.once("data", (data) => {
        resolve(data.toString().trim());
      });
    });
  }

  const { tokens } = await oauth2Client.getToken(finalCode);
  oauth2Client.setCredentials(tokens);
  saveToken(tokens);
  return oauth2Client;
}

// ─── Google API Wrappers ──────────────────────────────────────────────

class GoogleWorkspaceAPI {
  constructor(auth) {
    this.drive = google.drive({ version: "v3", auth });
    this.docs = google.docs({ version: "v1", auth });
    this.sheets = google.sheets({ version: "v4", auth });
    this.gmail = google.gmail({ version: "v1", auth });
  }

  // ── Drive ──

  async driveListFiles(pageSize = 10, query = "") {
    const params = {
      pageSize,
      fields: "files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)",
    };
    if (query) params.q = query;
    
    const res = await this.drive.files.list(params);
    return res.data.files || [];
  }

  async driveReadFile(fileId) {
    // Try to export Google Docs/Sheets as text
    const file = await this.drive.files.get({
      fileId,
      fields: "id, name, mimeType",
    });

    const mimeType = file.data.mimeType;
    
    if (mimeType === "application/vnd.google-apps.document") {
      const res = await this.drive.files.export({
        fileId,
        mimeType: "text/plain",
      });
      return { name: file.data.name, content: res.data, mimeType };
    } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
      const res = await this.drive.files.export({
        fileId,
        mimeType: "text/csv",
      });
      return { name: file.data.name, content: res.data, mimeType };
    } else {
      // Plain file download
      const res = await this.drive.files.get(
        { fileId, alt: "media" },
        { responseType: "text" }
      );
      return { name: file.data.name, content: res.data, mimeType };
    }
  }

  async driveCreateFile(name, content = "", mimeType = "text/plain") {
    const res = await this.drive.files.create({
      requestBody: {
        name,
        mimeType,
      },
      media: {
        mimeType,
        body: content,
      },
      fields: "id, name, mimeType, webViewLink",
    });
    return res.data;
  }

  async driveUploadFile(name, content, mimeType = "text/plain") {
    return await this.driveCreateFile(name, content, mimeType);
  }

  async driveDeleteFile(fileId) {
    await this.drive.files.delete({ fileId });
    return { deleted: true, fileId };
  }

  async driveSearchFiles(query) {
    return await this.driveListFiles(10, `name contains '${query.replace(/'/g, "\\'")}'`);
  }

  // ── Docs ──

  async docsCreate(title, content = "") {
    // Create a blank document
    const doc = await this.docs.documents.create({
      requestBody: { title },
    });
    
    if (content) {
      // Insert content into the document
      const documentId = doc.data.documentId;
      await this.docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content,
              },
            },
          ],
        },
      });
      return { documentId, title, webViewLink: `https://docs.google.com/document/d/${documentId}/edit` };
    }
    
    return doc.data;
  }

  async docsRead(documentId) {
    const doc = await this.docs.documents.get({ documentId });
    const content = doc.data.body?.content
      ?.map(block => block.paragraph?.elements
        ?.map(el => el.textRun?.content || "")
        .join("") || "")
      .join("\n") || "";
    
    return {
      documentId,
      title: doc.data.title,
      content,
    };
  }

  async docsAppendText(documentId, text) {
    const doc = await this.docs.documents.get({ documentId });
    const endIndex = doc.data.body?.content?.slice(-1)?.[0]?.endIndex || 1;
    
    await this.docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: endIndex - 1 },
              text: "\n" + text,
            },
          },
        ],
      },
    });
    
    return { documentId, appended: true };
  }

  // ── Sheets ──

  async sheetsCreate(title, headers = []) {
    const spreadsheet = await this.sheets.spreadsheets.create({
      requestBody: { properties: { title } },
    });
    
    if (headers.length > 0) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheet.data.spreadsheetId,
        range: "A1",
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }
    
    return {
      spreadsheetId: spreadsheet.data.spreadsheetId,
      title,
      webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheet.data.spreadsheetId}/edit`,
    };
  }

  async sheetsAppendRows(spreadsheetId, rows) {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A1",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });
    return { spreadsheetId, rowsAdded: rows.length };
  }

  async sheetsRead(spreadsheetId, range = "A1:Z1000") {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return {
      spreadsheetId,
      values: res.data.values || [],
    };
  }

  // ── Gmail ──

  async gmailSearch(query = "", maxResults = 5) {
    const res = await this.gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });
    
    const messages = res.data.messages || [];
    
    // Get details for each message
    const details = await Promise.all(
      messages.slice(0, 5).map(async (msg) => {
        const detail = await this.gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        });
        
        const headers = detail.data.payload?.headers || [];
        const getHeader = (name) => headers.find(h => h.name === name)?.value || "";
        
        return {
          id: msg.id,
          threadId: detail.data.threadId,
          from: getHeader("From"),
          to: getHeader("To"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          snippet: detail.data.snippet,
        };
      })
    );
    
    return details;
  }

  async gmailSend(to, subject, body) {
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const messageParts = [
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body).toString("base64"),
    ];
    const message = messageParts.join("\n");

    const res = await this.gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: Buffer.from(message).toString("base64url"),
      },
    });
    
    return { id: res.data.id, threadId: res.data.threadId };
  }

  async gmailGetThread(threadId) {
    const res = await this.gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });
    
    return res.data.messages?.map(msg => ({
      id: msg.id,
      from: msg.payload?.headers?.find(h => h.name === "From")?.value || "",
      subject: msg.payload?.headers?.find(h => h.name === "Subject")?.value || "",
      date: msg.payload?.headers?.find(h => h.name === "Date")?.value || "",
      snippet: msg.snippet,
    })) || [];
  }
}

// ─── MCP Server ───────────────────────────────────────────────────────

const server = new Server(
  {
    name: "nexus-google-workspace",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let gws = null;

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ── Drive Tools ──
      {
        name: "drive_list",
        description: "List files in Google Drive. Optional: filter by query string.",
        inputSchema: {
          type: "object",
          properties: {
            pageSize: { type: "number", default: 10, description: "Number of files to return" },
            query: { type: "string", description: "Optional search query (e.g., 'name contains report')" },
          },
        },
      },
      {
        name: "drive_read",
        description: "Read the content of a file from Google Drive by ID.",
        inputSchema: {
          type: "object",
          properties: {
            fileId: { type: "string", description: "The ID of the file to read" },
          },
          required: ["fileId"],
        },
      },
      {
        name: "drive_create",
        description: "Create a new file in Google Drive.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "File name" },
            content: { type: "string", default: "", description: "File content" },
            mimeType: { type: "string", default: "text/plain", description: "MIME type" },
          },
          required: ["name"],
        },
      },
      {
        name: "drive_upload",
        description: "Upload content to Google Drive as a new file.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "File name" },
            content: { type: "string", description: "File content" },
            mimeType: { type: "string", default: "text/plain", description: "MIME type" },
          },
          required: ["name", "content"],
        },
      },
      {
        name: "drive_search",
        description: "Search files in Google Drive by name.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
      },
      {
        name: "drive_delete",
        description: "Delete a file from Google Drive.",
        inputSchema: {
          type: "object",
          properties: {
            fileId: { type: "string", description: "File ID to delete" },
            confirm: { type: "boolean", description: "Confirmation required" },
          },
          required: ["fileId", "confirm"],
        },
      },
      // ── Docs Tools ──
      {
        name: "docs_create",
        description: "Create a new Google Doc with optional content.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Document title" },
            content: { type: "string", default: "", description: "Initial content" },
          },
          required: ["title"],
        },
      },
      {
        name: "docs_read",
        description: "Read the content of a Google Doc by ID.",
        inputSchema: {
          type: "object",
          properties: {
            documentId: { type: "string", description: "Google Doc ID" },
          },
          required: ["documentId"],
        },
      },
      {
        name: "docs_append",
        description: "Append text to an existing Google Doc.",
        inputSchema: {
          type: "object",
          properties: {
            documentId: { type: "string", description: "Google Doc ID" },
            text: { type: "string", description: "Text to append" },
          },
          required: ["documentId", "text"],
        },
      },
      // ── Sheets Tools ──
      {
        name: "sheets_create",
        description: "Create a new Google Sheet with optional headers.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Sheet title" },
            headers: {
              type: "array",
              items: { type: "string" },
              description: "Optional column headers",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "sheets_append",
        description: "Append rows to a Google Sheet.",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: { type: "string", description: "Sheet ID" },
            rows: {
              type: "array",
              items: {
                type: "array",
                items: { type: "string" },
              },
              description: "Rows of data to append",
            },
          },
          required: ["spreadsheetId", "rows"],
        },
      },
      {
        name: "sheets_read",
        description: "Read data from a Google Sheet.",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: { type: "string", description: "Sheet ID" },
            range: { type: "string", default: "A1:Z1000", description: "Range to read" },
          },
          required: ["spreadsheetId"],
        },
      },
      // ── Gmail Tools ──
      {
        name: "gmail_search",
        description: "Search Gmail messages.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", default: "", description: "Gmail search query" },
            maxResults: { type: "number", default: 5, description: "Max results" },
          },
        },
      },
      {
        name: "gmail_send",
        description: "Send an email via Gmail.",
        inputSchema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient email" },
            subject: { type: "string", description: "Email subject" },
            body: { type: "string", description: "Email body" },
          },
          required: ["to", "subject", "body"],
        },
      },
      {
        name: "gmail_get_thread",
        description: "Get all messages in a Gmail thread.",
        inputSchema: {
          type: "object",
          properties: {
            threadId: { type: "string", description: "Gmail thread ID" },
          },
          required: ["threadId"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!gws) {
    throw new Error("Google Workspace not authenticated. Restart the server to authenticate.");
  }

  try {
    let result;

    switch (name) {
      // ── Drive ──
      case "drive_list": {
        const files = await gws.driveListFiles(args?.pageSize || 10, args?.query || "");
        result = { files };
        break;
      }
      case "drive_read": {
        result = await gws.driveReadFile(args.fileId);
        break;
      }
      case "drive_create": {
        result = await gws.driveCreateFile(args.name, args.content || "", args.mimeType || "text/plain");
        break;
      }
      case "drive_upload": {
        result = await gws.driveUploadFile(args.name, args.content, args.mimeType || "text/plain");
        break;
      }
      case "drive_search": {
        const files = await gws.driveSearchFiles(args.query);
        result = { files };
        break;
      }
      case "drive_delete": {
        if (!args.confirm) {
          throw new Error("Confirmation required. Set confirm: true to delete.");
        }
        result = await gws.driveDeleteFile(args.fileId);
        break;
      }
      // ── Docs ──
      case "docs_create": {
        result = await gws.docsCreate(args.title, args.content || "");
        break;
      }
      case "docs_read": {
        result = await gws.docsRead(args.documentId);
        break;
      }
      case "docs_append": {
        result = await gws.docsAppendText(args.documentId, args.text);
        break;
      }
      // ── Sheets ──
      case "sheets_create": {
        result = await gws.sheetsCreate(args.title, args.headers || []);
        break;
      }
      case "sheets_append": {
        result = await gws.sheetsAppendRows(args.spreadsheetId, args.rows);
        break;
      }
      case "sheets_read": {
        result = await gws.sheetsRead(args.spreadsheetId, args.range);
        break;
      }
      // ── Gmail ──
      case "gmail_search": {
        result = await gws.gmailSearch(args?.query || "", args?.maxResults || 5);
        break;
      }
      case "gmail_send": {
        result = await gws.gmailSend(args.to, args.subject, args.body);
        break;
      }
      case "gmail_get_thread": {
        result = await gws.gmailGetThread(args.threadId);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.error("[nexus-google] Starting Google Workspace MCP Server...");
  console.error(`[nexus-google] Config dir: ${CONFIG_DIR}`);

  // Ensure config dir exists
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Check for credentials file
  if (!existsSync(CREDENTIALS_PATH)) {
    // Write credentials from env vars or create placeholder
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (clientId && clientSecret) {
      const credentials = {
        installed: {
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uris: ["http://localhost:8080"],
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
        },
      };
      writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
      console.error("[nexus-google] Credentials saved from environment variables");
    } else {
      console.error(`[nexus-google] No credentials found. Create ${CREDENTIALS_PATH} or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.`);
      console.error("[nexus-google] Example credentials.json format:");
      console.error(JSON.stringify({
        installed: {
          client_id: "YOUR_CLIENT_ID",
          client_secret: "YOUR_CLIENT_SECRET",
          redirect_uris: ["http://localhost:8080"],
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
        },
      }, null, 2));
      process.exit(1);
    }
  }

  // Authenticate
  const credentials = loadCredentials();
  const auth = await authenticate(credentials);
  gws = new GoogleWorkspaceAPI(auth);

  console.error("[nexus-google] Authentication successful!");
  console.error(`[nexus-google] Available tools: drive_list, drive_read, drive_create, drive_upload, drive_search, drive_delete, docs_create, docs_read, docs_append, sheets_create, sheets_append, sheets_read, gmail_search, gmail_send, gmail_get_thread`);

  // Start MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[nexus-google] MCP server connected and ready");
}

main().catch((error) => {
  console.error("[nexus-google] Fatal error:", error);
  process.exit(1);
});
