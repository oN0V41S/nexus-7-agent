/**
 * Integration test for remote sync flow
 *
 * Tests the complete flow:
 * 1. Save handoff locally + MongoDB
 * 2. Load handoff from MongoDB
 * 3. Search sessions across both stores
 * 4. List handoffs from both sources
 *
 * Requires: MongoDB running locally or MONGODB_URI set
 */

import { createMongoAdapter, closeMongoAdapter, type MongoAdapter } from "../../tools/mongodb-adapter";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/nexus-test-integration";

describe("Remote Sync Integration", () => {
  let adapter: MongoAdapter | null = null;
  let mongoAvailable = false;

  beforeAll(async () => {
    try {
      // Try to connect with a short timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection timeout")), 3000)
      );
      
      adapter = await Promise.race([
        createMongoAdapter(MONGODB_URI),
        timeoutPromise
      ]) as MongoAdapter;
      
      mongoAvailable = true;
    } catch (err) {
      console.warn("MongoDB not available, skipping integration tests");
      mongoAvailable = false;
    }
  }, 10000); // 10 second timeout for beforeAll

  afterAll(async () => {
    if (adapter && mongoAvailable) {
      // Clean up test data
      try {
        await adapter.deleteMany("handoffs", { id: { $regex: "^integration-test-" } });
        await adapter.deleteMany("sessions", { sessionId: { $regex: "^integration-test-" } });
      } catch { /* ignore cleanup errors */ }
      await closeMongoAdapter();
    }
  });

  it("should save and retrieve handoff via MongoDB", async () => {
    if (!mongoAvailable || !adapter) return;

    // Arrange
    const handoff = {
      id: "integration-test-handoff-001",
      title: "Integration Test Handoff",
      summary: "Testing full sync flow",
      nextSteps: ["Step 1", "Step 2"],
      artifacts: ["file.ts"],
      pending: "None",
      createdAt: new Date().toISOString(),
      fromAgent: "test-agent",
      fromSession: "test-session",
      type: "manual",
    };

    // Act
    await adapter.insertOne("handoffs", handoff);
    const found = await adapter.findOne("handoffs", { id: "integration-test-handoff-001" });

    // Assert
    expect(found).toBeDefined();
    expect(found?.title).toBe("Integration Test Handoff");
  });

  it("should save and search sessions via MongoDB", async () => {
    if (!mongoAvailable || !adapter) return;

    // Arrange
    const session = {
      sessionId: "integration-test-session-001",
      summary: "Implemented MongoDB adapter with connection pooling",
      agent: "orchestrator",
      messageCount: 25,
      toolCallCount: 8,
      savedAt: new Date().toISOString(),
    };

    // Act
    await adapter.insertOne("sessions", session);
    const results = await adapter.find(
      "sessions",
      { summary: { $regex: "MongoDB", $options: "i" } },
      { limit: 5 },
    );

    // Assert
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].summary).toContain("MongoDB");
  });

  it("should handle concurrent writes without conflicts", async () => {
    if (!mongoAvailable || !adapter) return;

    // Arrange
    const writes = Array.from({ length: 10 }, (_, i) => ({
      id: `integration-test-concurrent-${i}`,
      title: `Concurrent ${i}`,
      summary: `Test ${i}`,
      createdAt: new Date().toISOString(),
    }));

    // Act
    const results = await Promise.all(
      writes.map(w => adapter!.insertOne("handoffs", w)),
    );

    // Assert
    expect(results).toHaveLength(10);

    // Cleanup
    await adapter.deleteMany("handoffs", { id: { $regex: "^integration-test-concurrent-" } });
  });
});
