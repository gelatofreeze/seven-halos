import { MemoryStorage, type StorageAdapter } from '../persistence/Storage';

/**
 * Browser storage. Falls back to memory when localStorage is blocked
 * (private browsing, disabled site data) so the game still runs.
 */
export function createBrowserStorage(): StorageAdapter {
  try {
    const probe = '__seven_halos_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return {
      load: (key) => window.localStorage.getItem(key),
      save: (key, value) => window.localStorage.setItem(key, value),
      remove: (key) => window.localStorage.removeItem(key),
    };
  } catch {
    return new MemoryStorage();
  }
}
