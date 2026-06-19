/**
 * MongoDB Adapter for Nexus 7 Agent
 *
 * Provides MongoDB connection management and CRUD operations.
 * Pattern mirrors sqlite-adapter.ts for consistency.
 *
 * Usage:
 *   const adapter = await createMongoAdapter(process.env.MONGODB_URI);
 *   await adapter.insertOne("handoffs", { id: "123", title: "..." });
 *   await adapter.close();
 */

import { MongoClient, type Db, type Collection, type ObjectId } from "mongodb";

// ============================================================
// Types
// ============================================================

export interface MongoAdapterOptions {
  connectTimeoutMS?: number;
  serverSelectionTimeoutMS?: number;
  maxPoolSize?: number;
}

/**
 * Flexible document type for MongoDB operations.
 * Uses `unknown` for type safety while remaining permissive enough
 * for diverse document shapes. Callers can narrow types as needed.
 */
export interface MongoDocument {
  _id?: ObjectId;
  [key: string]: unknown;
}

/**
 * Custom error class for MongoDB adapter operations.
 * Wraps driver errors with consistent shape and collection context.
 */
export class MongoAdapterError extends Error {
  readonly operation: string;
  readonly collection: string;
  readonly cause?: Error;

  constructor(operation: string, collection: string, message: string, cause?: Error) {
    super(`[${operation}] ${collection}: ${message}`);
    this.name = "MongoAdapterError";
    this.operation = operation;
    this.collection = collection;
    this.cause = cause;
  }
}

export interface MongoAdapter {
  isConnected(): boolean;
  close(): Promise<void>;
  getDb(): Db;
  getCollection(name: string): Collection;
  insertOne(collection: string, doc: MongoDocument): Promise<ObjectId>;
  insertMany(collection: string, docs: MongoDocument[]): Promise<ObjectId[]>;
  findOne(collection: string, filter: Record<string, any>): Promise<MongoDocument | null>;
  find(collection: string, filter: Record<string, any>, options?: { limit?: number; sort?: Record<string, 1 | -1> }): Promise<MongoDocument[]>;
  /**
   * Update a single document. The `update` parameter accepts the full
   * MongoDB update document (e.g. { $set: { ... } }, { $inc: { ... } }).
   * Passing a raw document without operators will cause a MongoDB error.
   */
  updateOne(collection: string, filter: Record<string, any>, update: Record<string, any>): Promise<boolean>;
  deleteOne(collection: string, filter: Record<string, any>): Promise<boolean>;
  deleteMany(collection: string, filter: Record<string, any>): Promise<number>;
  countDocuments(collection: string, filter?: Record<string, any>): Promise<number>;
  healthCheck(): Promise<{ connected: boolean; database: string }>;
}

// ============================================================
// Factory
// ============================================================

export async function createMongoAdapter(
  uri: string,
  options: MongoAdapterOptions = {},
): Promise<MongoAdapter> {
  const {
    connectTimeoutMS = 5000,
    serverSelectionTimeoutMS = 5000,
    maxPoolSize = 10,
  } = options;

  const client = new MongoClient(uri, {
    connectTimeoutMS,
    serverSelectionTimeoutMS,
    maxPoolSize,
  });

  await client.connect();

  // Extract database name from URI or use default
  const db = client.db(extractDbName(uri));
  let connected = true;

  return {
    isConnected: () => connected,
    close: async () => {
      connected = false;
      await client.close();
    },
    getDb: () => db,
    getCollection: (name: string) => db.collection(name),

    insertOne: async (collection, doc) => {
      try {
        const result = await db.collection(collection).insertOne(doc);
        return result.insertedId;
      } catch (err) {
        throw new MongoAdapterError("insertOne", collection, String(err), err as Error);
      }
    },

    insertMany: async (collection, docs) => {
      try {
        const result = await db.collection(collection).insertMany(docs);
        return Object.values(result.insertedIds);
      } catch (err) {
        throw new MongoAdapterError("insertMany", collection, String(err), err as Error);
      }
    },

    findOne: async (collection, filter) => {
      try {
        return await db.collection(collection).findOne(filter);
      } catch (err) {
        throw new MongoAdapterError("findOne", collection, String(err), err as Error);
      }
    },

    find: async (collection, filter, options = {}) => {
      try {
        let cursor = db.collection(collection).find(filter);
        if (options.sort) cursor = cursor.sort(options.sort);
        if (options.limit) cursor = cursor.limit(options.limit);
        return await cursor.toArray();
      } catch (err) {
        throw new MongoAdapterError("find", collection, String(err), err as Error);
      }
    },

    updateOne: async (collection, filter, update) => {
      try {
        const result = await db.collection(collection).updateOne(filter, update);
        return result.modifiedCount > 0;
      } catch (err) {
        throw new MongoAdapterError("updateOne", collection, String(err), err as Error);
      }
    },

    deleteOne: async (collection, filter) => {
      try {
        const result = await db.collection(collection).deleteOne(filter);
        return result.deletedCount > 0;
      } catch (err) {
        throw new MongoAdapterError("deleteOne", collection, String(err), err as Error);
      }
    },

    deleteMany: async (collection, filter) => {
      try {
        const result = await db.collection(collection).deleteMany(filter);
        return result.deletedCount;
      } catch (err) {
        throw new MongoAdapterError("deleteMany", collection, String(err), err as Error);
      }
    },

    countDocuments: async (collection, filter = {}) => {
      try {
        return await db.collection(collection).countDocuments(filter);
      } catch (err) {
        throw new MongoAdapterError("countDocuments", collection, String(err), err as Error);
      }
    },

    healthCheck: async () => {
      try {
        await db.admin().ping();
        return { connected, database: db.databaseName };
      } catch (err) {
        return { connected: false, database: db.databaseName };
      }
    },
  };
}

// ============================================================
// Helpers
// ============================================================

function extractDbName(uri: string): string {
  // mongodb+srv://user:pass@host/dbname?options
  // mongodb://user:pass@host:port/dbname?options
  try {
    const url = new URL(uri);
    const dbName = url.pathname.replace(/^\//, "").split("?")[0];
    return dbName || "nexus-memory";
  } catch {
    return "nexus-memory";
  }
}

// ============================================================
// Singleton (for shared connections)
// ============================================================

let defaultAdapter: MongoAdapter | null = null;

export async function getMongoAdapter(): Promise<MongoAdapter | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (defaultAdapter && defaultAdapter.isConnected()) {
    return defaultAdapter;
  }

  defaultAdapter = await createMongoAdapter(uri);
  return defaultAdapter;
}

export async function closeMongoAdapter(): Promise<void> {
  if (defaultAdapter) {
    await defaultAdapter.close();
    defaultAdapter = null;
  }
}
