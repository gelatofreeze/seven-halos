/**
 * Minimal key/value storage the game saves through. The browser build uses
 * localStorage; Steam, iOS and Android builds can provide their own adapter
 * without touching game systems.
 */
export interface StorageAdapter {
  load(key: string): string | null;
  save(key: string, value: string): void;
  remove(key: string): void;
}

/** In-memory storage for tests and for when platform storage is unavailable. */
export class MemoryStorage implements StorageAdapter {
  readonly data = new Map<string, string>();
  load(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  save(key: string, value: string): void {
    this.data.set(key, value);
  }
  remove(key: string): void {
    this.data.delete(key);
  }
}
