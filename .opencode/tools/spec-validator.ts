import { tool } from "@opencode-ai/plugin/tool";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Spec Validator Tool
 *
 * Valida documentos de spec (.spec.md) contra o JSON Schema.
 * Parseia o YAML frontmatter e as seções do Markdown,
 * extrai IDs de requisitos e casos de teste, e valida a estrutura.
 */

function extractFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) {
      frontmatter[kv[1]] = kv[2].replace(/["']/g, "").trim();
    }
  }
  return frontmatter;
}

function extractRequirementIds(content: string): string[] {
  const regex = /(REQ|NFR)-\d{3}/g;
  return [...new Set(content.match(regex) || [])];
}

function extractTestCaseIds(content: string): string[] {
  const regex = /CT-\d{3}\.\d+/g;
  return [...new Set(content.match(regex) || [])];
}

function validateTestToRequirementMapping(
  content: string,
  reqIds: string[],
  tcIds: string[],
): string[] {
  const errors: string[] = [];
  const reqSet = new Set(reqIds);

  for (const tcId of tcIds) {
    const reqNum = tcId.match(/CT-(\d{3})/);
    if (reqNum) {
      const expectedReq = `REQ-${reqNum[1]}`;
      if (!reqSet.has(expectedReq)) {
        errors.push(
          `Test case ${tcId} references REQ-${reqNum[1]} but no REQ-${reqNum[1]} section exists`,
        );
      }
    }
  }

  return errors;
}

function validateStatus(status: string): string[] {
  const valid = ["draft", "review", "approved", "implemented", "deprecated"];
  if (status && !valid.includes(status)) {
    return [`Invalid status: "${status}". Valid values: ${valid.join(", ")}`];
  }
  return [];
}

function validateVersion(version: string): string[] {
  if (!version) return [];
  const semver = /^\d+\.\d+\.\d+$/;
  if (!semver.test(version)) {
    return [`Invalid version: "${version}". Must follow semver (e.g. 1.0.0)`];
  }
  return [];
}

export default tool({
  description:
    "Valida documentos de spec (.spec.md) contra o schema Nexus. Verifica frontmatter, IDs de requisitos, mapeamento CT→REQ, e consistência estrutural.",
  args: {
    filePath: tool.schema
      .string()
      .describe("Caminho absoluto para o arquivo .spec.md a ser validado"),
    fix: tool.schema
      .boolean()
      .default(false)
      .describe("Se true, tenta corrigir problemas automaticamente (ex: update status)"),
  },
  async execute(args, context) {
    const { filePath, fix } = args;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!fs.existsSync(filePath)) {
      return JSON.stringify({
        status: "error",
        errors: [`File not found: ${filePath}`],
        warnings: [],
        summary: { reqCount: 0, tcCount: 0, valid: false },
      });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const ext = path.extname(filePath);

    if (ext !== ".md") {
      warnings.push(`File extension is "${ext}", expected ".md"`);
    }

    const fm = extractFrontmatter(content);
    if (!fm.title) errors.push("Missing required frontmatter field: title");
    if (!fm.status) errors.push("Missing required frontmatter field: status");
    if (!fm.version) errors.push("Missing required frontmatter field: version");

    errors.push(...validateStatus(fm.status || ""));
    errors.push(...validateVersion(fm.version || ""));

    const reqIds = extractRequirementIds(content);
    const tcIds = extractTestCaseIds(content);

    if (reqIds.length === 0) {
      warnings.push("No REQ-NNN or NFR-NNN requirement IDs found in document");
    }

    errors.push(...validateTestToRequirementMapping(content, reqIds, tcIds));

    if (fm.status === "approved" && reqIds.length === 0) {
      errors.push(
        "Status is 'approved' but no requirement IDs (REQ-NNN) were found",
      );
    }

    if (fix && errors.length === 0 && !fm.updated) {
      const today = new Date().toISOString().slice(0, 10);
      const fixed = content.replace(/^updated:\s*"?"?.*"?$/m, `updated: "${today}"`);
      if (fixed !== content) {
        fs.writeFileSync(filePath, fixed, "utf-8");
      }
    }

    return JSON.stringify(
      {
        status: errors.length === 0 ? "valid" : "invalid",
        file: filePath,
        errors,
        warnings,
        summary: {
          reqCount: reqIds.length,
          tcCount: tcIds.length,
          hasTitle: !!fm.title,
          hasVersion: !!fm.version,
          status: fm.status || "unknown",
          valid: errors.length === 0,
        },
        frontmatter: fm,
      },
      null,
      2,
    );
  },
});
