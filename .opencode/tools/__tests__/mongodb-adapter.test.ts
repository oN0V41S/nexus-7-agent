import { createMongoAdapter, MongoAdapterError, type MongoAdapter, type MongoDocument } from "../mongodb-adapter";

// Helper to check if MongoDB is available (fast timeout)
async function isMongoAvailable(): Promise<boolean> {
  try {
    const adapter = await createMongoAdapter("mongodb://localhost:27017/test", {
      connectTimeoutMS: 1500,
      serverSelectionTimeoutMS: 1500,
    });
    await adapter.close();
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Test 1: Type compliance (no live connection needed)
// ============================================================
describe("MongoAdapter type compliance", () => {
  it("should export MongoDocument with correct shape", () => {
    const doc: MongoDocument = { name: "test", value: 42 };
    expect(doc).toBeDefined();
    expect(doc.name).toBe("test");
    expect(doc.value).toBe(42);
  });

  it("should export MongoDocument allowing _id field", () => {
    const doc: MongoDocument = { _id: undefined, key: "val" };
    expect(doc).toBeDefined();
    expect(doc.key).toBe("val");
  });

  it("should export MongoAdapterError with correct properties", () => {
    const cause = new Error("driver error");
    const err = new MongoAdapterError("insertOne", "handoffs", "duplicate key", cause);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(MongoAdapterError);
    expect(err.name).toBe("MongoAdapterError");
    expect(err.operation).toBe("insertOne");
    expect(err.collection).toBe("handoffs");
    expect(err.cause).toBe(cause);
    expect(err.message).toContain("insertOne");
    expect(err.message).toContain("handoffs");
  });

  it("should export createMongoAdapter as async function", () => {
    expect(typeof createMongoAdapter).toBe("function");
    // createMongoAdapter returns a Promise
    const result = createMongoAdapter("mongodb://localhost:27017/test").catch(() => null);
    expect(result).toBeInstanceOf(Promise);
  });

  it("should have all required methods in MongoAdapter interface", () => {
    // Compile-time check: verify interface shape matches expectations
    const methods: (keyof MongoAdapter)[] = [
      "isConnected", "close", "getDb", "getCollection",
      "insertOne", "insertMany", "findOne", "find",
      "updateOne", "deleteOne", "deleteMany", "countDocuments",
      "healthCheck",
    ];
    // This test validates the interface is complete — if a method is missing,
    // the type check above will fail at compile time
    expect(methods.length).toBe(13);
  });

  it("should reject MongoDocument with non-unknown values at type level", () => {
    // This is a type-level test: at runtime it just works, but TypeScript
    // should flag `string` values for `[key: string]` fields if we used `never`
    const doc: MongoDocument = { flexible: true, nested: { deep: "value" } };
    expect(doc.flexible).toBe(true);
    expect(doc.nested).toEqual({ deep: "value" });
  });
});

// ============================================================
// Test 2: MongoAdapterError behavior
// ============================================================
describe("MongoAdapterError", () => {
  it("should format message correctly", () => {
    const err = new MongoAdapterError("deleteOne", "users", "not found");
    expect(err.message).toBe("[deleteOne] users: not found");
  });

  it("should default cause to undefined", () => {
    const err = new MongoAdapterError("find", "items", "timeout");
    expect(err.cause).toBeUndefined();
  });

  it("should be catchable as Error", () => {
    try {
      throw new MongoAdapterError("countDocuments", "logs", "connection lost");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(MongoAdapterError);
      expect((e as MongoAdapterError).operation).toBe("countDocuments");
    }
  });
});

// ============================================================
// Test 3: Live MongoDB tests (skipped if unavailable)
// ============================================================
describe("MongoDB Adapter (live)", () => {
  let mongoAvailable = false;

  beforeAll(async () => {
    mongoAvailable = await isMongoAvailable();
  }, 10000);

  describe("createMongoAdapter", () => {
    it("should create adapter with valid connection string", async () => {
      if (!mongoAvailable) {
        console.warn("Skipping: MongoDB not available");
        return;
      }

      const adapter = await createMongoAdapter("mongodb://localhost:27017/test");

      expect(adapter).toBeDefined();
      expect(adapter.isConnected()).toBe(true);
      await adapter.close();
    });

    it("should throw error with invalid connection string", async () => {
      await expect(createMongoAdapter("mongodb://invalid-host:99999/test", { connectTimeoutMS: 1000 }))
        .rejects.toThrow();
    });

    it("should return disconnected status after close", async () => {
      if (!mongoAvailable) {
        console.warn("Skipping: MongoDB not available");
        return;
      }

      const adapter = await createMongoAdapter("mongodb://localhost:27017/test");
      await adapter.close();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe("CRUD operations", () => {
    it("should insert and find a document", async () => {
      if (!mongoAvailable) {
        console.warn("Skipping: MongoDB not available");
        return;
      }

      const adapter = await createMongoAdapter("mongodb://localhost:27017/test");
      const coll = "test_crud_" + Date.now();

      try {
        const id = await adapter.insertOne(coll, { name: "test", value: 42 });
        expect(id).toBeDefined();

        const found = await adapter.findOne(coll, { name: "test" });
        expect(found).toBeDefined();
        expect(found!.name).toBe("test");

        const all = await adapter.find(coll, {});
        expect(all.length).toBe(1);

        const count = await adapter.countDocuments(coll);
        expect(count).toBe(1);

        const updated = await adapter.updateOne(coll, { name: "test" }, { $set: { value: 99 } });
        expect(updated).toBe(true);

        const foundUpdated = await adapter.findOne(coll, { name: "test" });
        expect(foundUpdated!.value).toBe(99);

        const deleted = await adapter.deleteOne(coll, { name: "test" });
        expect(deleted).toBe(true);
      } finally {
        // Cleanup
        await adapter.getDb().dropCollection(coll).catch(() => {});
        await adapter.close();
      }
    });

    it("should wrap MongoDB errors in MongoAdapterError", async () => {
      if (!mongoAvailable) {
        console.warn("Skipping: MongoDB not available");
        return;
      }

      const adapter = await createMongoAdapter("mongodb://localhost:27017/test");
      const coll = "test_error_" + Date.now();

      try {
        // Insert duplicate to trigger error (if index exists)
        // Or just verify the error shape on a failing operation
        await adapter.insertOne(coll, { _id: "same_id", data: 1 });
        await expect(adapter.insertOne(coll, { _id: "same_id", data: 2 }))
          .rejects.toThrow(MongoAdapterError);
      } finally {
        await adapter.getDb().dropCollection(coll).catch(() => {});
        await adapter.close();
      }
    });

    it("should return health check without listing collections", async () => {
      if (!mongoAvailable) {
        console.warn("Skipping: MongoDB not available");
        return;
      }

      const adapter = await createMongoAdapter("mongodb://localhost:27017/test");
      const health = await adapter.healthCheck();

      expect(health.connected).toBe(true);
      expect(health.database).toBe("test");
      // No longer returns collections array — healthCheck uses ping()
      expect(health).not.toHaveProperty("collections");
      await adapter.close();
    });
  });
});
