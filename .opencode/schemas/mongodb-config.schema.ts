/**
 * MongoDB Configuration Schema for Nexus 7 Agent
 *
 * Environment variables:
 *   MONGODB_URI - MongoDB connection string (required for remote sync)
 *   MONGODB_DB_NAME - Database name (default: nexus-memory)
 *   MONGODB_TIMEOUT_MS - Connection timeout in ms (default: 5000)
 */

export interface MongoConfig {
  uri: string;
  dbName: string;
  timeoutMs: number;
}

export function getMongoConfig(): MongoConfig | null {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  return {
    uri,
    dbName: process.env.MONGODB_DB_NAME || "nexus-memory",
    timeoutMs: parseInt(process.env.MONGODB_TIMEOUT_MS || "5000", 10),
  };
}

export function validateMongoConfig(config: MongoConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.uri) {
    errors.push("MONGODB_URI is required");
  } else if (!config.uri.startsWith("mongodb://") && !config.uri.startsWith("mongodb+srv://")) {
    errors.push("MONGODB_URI must start with mongodb:// or mongodb+srv://");
  }

  if (config.timeoutMs < 1000) {
    errors.push("MONGODB_TIMEOUT_MS must be at least 1000ms");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
