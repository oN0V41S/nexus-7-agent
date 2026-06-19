/**
 * Tests for cache-manager.ts — Cache Híbrido para DeepSeek-V4
 *
 * Covers: CacheManager core, persistence, stats, smart invalidation
 *
 * Pattern: AAA (Arrange, Act, Assert)
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { CacheManager } from "../cache-manager";

// ============================================================
// Helpers
// ============================================================

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-cache-"));
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

// ============================================================
// Test 1: Core — get/set/invalidate/clear
// ============================================================
describe("CacheManager core", () => {
  it("should store and retrieve a value", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });

    // Act
    await cache.set("test-key", "hello world", "response");
    const entry = await cache.get("test-key");

    // Assert
    expect(entry).not.toBeNull();
    expect(entry!.value).toBe("hello world");
    expect(entry!.type).toBe("response");
    expect(entry!.key).toBe("test-key");
  });

  it("should return null for missing key", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });

    // Act
    const entry = await cache.get("nonexistent");

    // Assert
    expect(entry).toBeNull();
  });

  it("should invalidate a specific key", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });
    await cache.set("key-1", "value-1", "code");
    await cache.set("key-2", "value-2", "response");

    // Act
    await cache.invalidate("key-1");

    // Assert
    expect(await cache.get("key-1")).toBeNull();
    expect(await cache.get("key-2")).not.toBeNull();
  });

  it("should clear all entries", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });
    await cache.set("a", "1", "code");
    await cache.set("b", "2", "response");
    await cache.set("c", "3", "context");

    // Act
    await cache.clear();

    // Assert
    expect(await cache.get("a")).toBeNull();
    expect(await cache.get("b")).toBeNull();
    expect(await cache.get("c")).toBeNull();
  });

  it("should normalize keys", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });

    // Act
    await cache.set("Hello World", "value-1", "response");
    await cache.set("hello  world", "value-2", "response");
    await cache.set("  hello world  ", "value-3", "response");

    // Assert — all normalize to same key, last one wins
    const entry = await cache.get("hello world");
    expect(entry!.value).toBe("value-3");
  });

  it("should respect TTL expiration", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });
    await cache.set("expiring-key", "value", "response", 100); // 100ms TTL

    // Act — wait for expiration
    await new Promise((r) => setTimeout(r, 150));

    // Assert
    const entry = await cache.get("expiring-key");
    expect(entry).toBeNull();
  });

  it("should not expire entries with TTL 0", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });
    await cache.set("permanent", "value", "response", 0);

    // Act — wait
    await new Promise((r) => setTimeout(r, 50));

    // Assert
    const entry = await cache.get("permanent");
    expect(entry).not.toBeNull();
  });
});

// ============================================================
// Test 2: getOrCreate
// ============================================================
describe("CacheManager getOrCreate", () => {
  it("should return cached value if exists", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });
    await cache.set("existing", "cached-value", "code");
    let factoryCalled = false;

    // Act
    const result = await cache.getOrCreate("existing", () => {
      factoryCalled = true;
      return "new-value";
    }, "code");

    // Assert
    expect(result).toBe("cached-value");
    expect(factoryCalled).toBe(false);
  });

  it("should call factory and cache result if missing", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });
    let factoryCalled = false;

    // Act
    const result = await cache.getOrCreate("new-key", () => {
      factoryCalled = true;
      return "generated-value";
    }, "code");

    // Assert
    expect(result).toBe("generated-value");
    expect(factoryCalled).toBe(true);

    const entry = await cache.get("new-key");
    expect(entry!.value).toBe("generated-value");
  });

  it("should support async factory", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });

    // Act
    const result = await cache.getOrCreate("async-key", async () => {
      return "async-generated";
    }, "response");

    // Assert
    expect(result).toBe("async-generated");
  });
});

// ============================================================
// Test 3: Stats
// ============================================================
describe("CacheManager stats", () => {
  it("should track hits and misses", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });
    await cache.set("exists", "value", "response");

    // Act
    await cache.get("exists");    // hit
    await cache.get("exists");    // hit
    await cache.get("missing");   // miss

    // Assert
    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
  });

  it("should count entries by type", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });

    // Act
    await cache.set("c1", "v", "code");
    await cache.set("c2", "v", "code");
    await cache.set("r1", "v", "response");
    await cache.set("ctx1", "v", "context");

    // Assert
    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(4);
    expect(stats.entriesByType.code).toBe(2);
    expect(stats.entriesByType.response).toBe(1);
    expect(stats.entriesByType.context).toBe(1);
    expect(stats.entriesByType.other).toBe(0);
  });

  it("should estimate tokens saved", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });
    await cache.set("tok", "a".repeat(100), "response"); // 100 chars

    // Act
    await cache.get("tok"); // hit → ~25 tokens saved

    // Assert
    const stats = cache.getStats();
    expect(stats.estimatedTokensSaved).toBe(25); // ceil(100/4)
  });

  it("should calculate total size", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });

    // Act
    await cache.set("a", "hello", "code");       // 5 bytes
    await cache.set("b", "world!", "response");  // 6 bytes

    // Assert
    const stats = cache.getStats();
    expect(stats.totalSizeBytes).toBe(11);
  });
});

// ============================================================
// Test 4: Persistence
// ============================================================
describe("CacheManager persistence", () => {
  it("should save and load cache from disk", async () => {
    // Arrange
    const cache1 = new CacheManager(tmpDir, {
      enablePersistence: true,
      autoSaveIntervalMs: 0, // disable auto-save for test
    });
    await cache1.set("persist-key", "persist-value", "code");
    await cache1.save();

    // Act — create new instance and load
    const cache2 = new CacheManager(tmpDir, {
      enablePersistence: true,
      autoSaveIntervalMs: 0,
    });
    await cache2.load();

    // Assert
    const entry = await cache2.get("persist-key");
    expect(entry).not.toBeNull();
    expect(entry!.value).toBe("persist-value");
  });

  it("should not load expired entries from disk", async () => {
    // Arrange
    const cache1 = new CacheManager(tmpDir, {
      enablePersistence: true,
      autoSaveIntervalMs: 0,
    });
    await cache1.set("expiring", "value", "response", 1); // 1ms TTL
    await cache1.save();

    // Wait for expiration
    await new Promise((r) => setTimeout(r, 50));

    // Act
    const cache2 = new CacheManager(tmpDir, {
      enablePersistence: true,
      autoSaveIntervalMs: 0,
    });
    await cache2.load();

    // Assert
    const entry = await cache2.get("expiring");
    expect(entry).toBeNull();
  });

  it("should create cache directory if it does not exist", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, {
      enablePersistence: true,
      autoSaveIntervalMs: 0,
    });

    // Act
    await cache.set("test", "value", "code");
    await cache.save();

    // Assert
    const cacheDir = path.join(tmpDir, ".opencode/cache");
    expect(fs.existsSync(cacheDir)).toBe(true);
    expect(fs.existsSync(path.join(cacheDir, "entries.json"))).toBe(true);
  });

  it("should preserve stats across save/load", async () => {
    // Arrange
    const cache1 = new CacheManager(tmpDir, {
      enablePersistence: true,
      autoSaveIntervalMs: 0,
    });
    await cache1.set("s", "v", "response");
    await cache1.get("s"); // hit
    await cache1.get("x"); // miss
    await cache1.save();

    // Act
    const cache2 = new CacheManager(tmpDir, {
      enablePersistence: true,
      autoSaveIntervalMs: 0,
    });
    await cache2.load();

    // Assert
    const stats = cache2.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });
});

// ============================================================
// Test 5: Smart Invalidation
// ============================================================
describe("CacheManager smart invalidation", () => {
  it("should invalidate code entries referencing a changed file", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });
    await cache.set("code-pattern-1", "// src/components/Button.tsx\nexport const Button = () => {};", "code");
    await cache.set("code-pattern-2", "// src/utils/helper.ts\nexport const helper = () => {};", "code");
    await cache.set("response-1", "Some response about Button", "response");

    // Act
    const invalidated = await cache.invalidateByFileChange(
      "src/components/Button.tsx",
      "abc123",
    );

    // Assert
    expect(invalidated).toBe(1);
    expect(await cache.get("code-pattern-1")).toBeNull();
    expect(await cache.get("code-pattern-2")).not.toBeNull();
    expect(await cache.get("response-1")).not.toBeNull();
  });

  it("should prune expired entries", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });
    await cache.set("alive", "value", "response"); // default TTL
    await cache.set("dying", "value", "response", 1); // 1ms TTL

    // Wait
    await new Promise((r) => setTimeout(r, 50));

    // Act
    const pruned = await cache.prune();

    // Assert
    expect(pruned).toBe(1);
    expect(await cache.get("alive")).not.toBeNull();
    expect(await cache.get("dying")).toBeNull();
  });

  it("should return oldest entries for LRU analysis", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, { enablePersistence: false });
    await cache.set("old", "value-1", "code");
    await new Promise((r) => setTimeout(r, 10));
    await cache.set("new", "value-2", "code");

    // Act
    const oldest = cache.getOldestEntries(1);

    // Assert
    expect(oldest).toHaveLength(1);
    expect(oldest[0].key).toBe("old");
  });
});

// ============================================================
// Test 6: Limits and Eviction
// ============================================================
describe("CacheManager limits", () => {
  it("should evict oldest entry when maxEntries reached", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, {
      enablePersistence: false,
      maxEntries: 3,
    });
    await cache.set("a", "1", "code");
    await cache.set("b", "2", "code");
    await cache.set("c", "3", "code");

    // Act — should evict oldest ("a")
    await cache.set("d", "4", "code");

    // Assert
    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(3);
    expect(await cache.get("a")).toBeNull();
    expect(await cache.get("d")).not.toBeNull();
  });

  it("should evict by size when maxSizeBytes reached", async () => {
    // Arrange — limit to 100 bytes
    const cache = new CacheManager(tmpDir, {
      enablePersistence: false,
      maxSizeBytes: 100,
    });
    await cache.set("small", "a".repeat(30), "code"); // 30 bytes
    await cache.set("medium", "b".repeat(30), "code"); // 30 bytes

    // Act — adding 50 bytes should trigger eviction of oldest
    await cache.set("large", "c".repeat(50), "code");

    // Assert
    const stats = cache.getStats();
    expect(stats.totalSizeBytes).toBeLessThanOrEqual(100);
  });
});

// ============================================================
// Test 7: Destroy
// ============================================================
describe("CacheManager destroy", () => {
  it("should save and stop auto-save on destroy", async () => {
    // Arrange
    const cache = new CacheManager(tmpDir, {
      enablePersistence: true,
      autoSaveIntervalMs: 100,
    });
    await cache.set("key", "value", "code");

    // Act
    await cache.destroy();

    // Assert — file exists
    const filePath = path.join(tmpDir, ".opencode/cache/entries.json");
    expect(fs.existsSync(filePath)).toBe(true);

    // Verify content
    const doc = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(doc.entries["key"].value).toBe("value");
  });
});
