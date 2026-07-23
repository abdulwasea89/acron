import { createStorage } from "@/stores/storage";

const storage = createStorage("idempotency");

const KEY_PREFIX = "idem_";

export function generateIdempotencyKey(endpoint: string): string {
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  storage.setItem(`${KEY_PREFIX}${key}`, endpoint);
  return key;
}

export function markIdempotencyDone(key: string): void {
  const fullKey = `${KEY_PREFIX}${key}`;
  const endpoint = storage.getItem(fullKey);
  if (endpoint) {
    storage.setItem(`${fullKey}_done`, "1");
  }
}

export function isIdempotencyPending(key: string): boolean {
  const fullKey = `${KEY_PREFIX}${key}`;
  return storage.getItem(fullKey) !== null && storage.getItem(`${fullKey}_done`) === null;
}

export function clearIdempotencyKey(key: string): void {
  const fullKey = `${KEY_PREFIX}${key}`;
  storage.removeItem(fullKey);
  storage.removeItem(`${fullKey}_done`);
}

export function cleanupStaleKeys(maxAgeMs = 86400000): void {
  // Keys are `idem_<createdAtMs>-<random>` (plus a `_done` sibling). Parse the
  // embedded timestamp and drop anything older than maxAgeMs.
  const cutoff = Date.now() - maxAgeMs;
  for (const fullKey of storage.getAllKeys()) {
    if (!fullKey.startsWith(KEY_PREFIX) || fullKey.endsWith("_done")) continue;
    const createdAt = Number(fullKey.slice(KEY_PREFIX.length).split("-")[0]);
    if (Number.isFinite(createdAt) && createdAt < cutoff) {
      storage.removeItem(fullKey);
      storage.removeItem(`${fullKey}_done`);
    }
  }
}
