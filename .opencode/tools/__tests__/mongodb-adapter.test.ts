import { createMongoAdapter, type MongoAdapter } from "../mongodb-adapter";

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

describe("MongoDB Adapter", () => {
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

      // Arrange
      const uri = "mongodb://localhost:27017/test";

      // Act
      const adapter = await createMongoAdapter(uri);

      // Assert
      expect(adapter).toBeDefined();
      expect(adapter.isConnected()).toBe(true);
      await adapter.close();
    });

    it("should throw error with invalid connection string", async () => {
      // Arrange
      const uri = "mongodb://invalid-host:99999/test";

      // Act & Assert
      await expect(createMongoAdapter(uri, { connectTimeoutMS: 1000 }))
        .rejects.toThrow();
    });

    it("should return disconnected status after close", async () => {
      if (!mongoAvailable) {
        console.warn("Skipping: MongoDB not available");
        return;
      }

      // Arrange
      const adapter = await createMongoAdapter("mongodb://localhost:27017/test");

      // Act
      await adapter.close();

      // Assert
      expect(adapter.isConnected()).toBe(false);
    });
  });
});
