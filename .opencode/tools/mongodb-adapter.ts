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

export interface MongoDocument {
  _id?: ObjectId;
  [key: string]: any;
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
  updateOne(collection: string, filter: Record<string, any>, update: Record<string, any>): Promise<boolean>;
  deleteOne(collection: string, filter: Record<string, any>): Promise<boolean>;
  deleteMany(collection: string, filter: Record<string, any>): Promise<number>;
  countDocuments(collection: string, filter?: Record<string, any>): Promise<number>;
  healthCheck(): Promise<{ connected: boolean; database: string; collections: string[] }>;
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
      const result = await db.collection(collection).insertOne(doc);
      return result.insertedId;
    },

    insertMany: async (collection, docs) => {
      const result = await db.collection(collection).insertMany(docs);
      return Object.values(result.insertedIds);
    },

    findOne: async (collection, filter) => {
      return await db.collection(collection).findOne(filter);
    },

    find: async (collection, filter, options = {}) => {
      let cursor = db.collection(collection).find(filter);
      if (options.sort) cursor = cursor.sort(options.sort);
      if (options.limit) cursor = cursor.limit(options.limit);
      return await cursor.toArray();
    },

    updateOne: async (collection, filter, update) => {
      const result = await db.collection(collection).updateOne(filter, { $set: update });
      return result.modifiedCount > 0;
    },

    deleteOne: async (collection, filter) => {
      const result = await db.collection(collection).deleteOne(filter);
      return result.deletedCount > 0;
    },

    deleteMany: async (collection, filter) => {
      const result = await db.collection(collection).deleteMany(filter);
      return result.deletedCount;
    },

    countDocuments: async (collection, filter = {}) => {
      return await db.collection(collection).countDocuments(filter);
    },

    healthCheck: async () => {
      const collections = await db.listCollections().toArray();
      return {
        connected,
        database: db.databaseName,
        collections: collections.map(c => c.name),
      };
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
    const dbName = url.pathname.replace("/", "").split("?")[0];
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
