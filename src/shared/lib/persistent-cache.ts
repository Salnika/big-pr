const databaseName = "pr-status";
const storeName = "cache";

// Holds entries when IndexedDB is unavailable or a write fails, so the session keeps working.
const memoryEntries = new Map<string, unknown>();
let databasePromise: Promise<IDBDatabase | null> | null = null;

export async function readPersistentEntry<T>(key: string): Promise<T | undefined> {
  if (memoryEntries.has(key)) {
    return memoryEntries.get(key) as T;
  }

  const database = await openDatabase();

  if (!database) {
    return undefined;
  }

  try {
    return await runTransaction<T | undefined>(database, "readonly", (store) => store.get(key));
  } catch {
    return undefined;
  }
}

export async function writePersistentEntry(key: string, value: unknown) {
  const database = await openDatabase();

  if (database) {
    try {
      await runTransaction(database, "readwrite", (store) => store.put(value, key));
      memoryEntries.delete(key);
      return;
    } catch {
      // Fall back to memory below (storage full or blocked).
    }
  }

  memoryEntries.set(key, value);
}

export async function deletePersistentEntries(
  prefix: string,
  shouldDelete: (key: string) => boolean = () => true,
) {
  [...memoryEntries.keys()]
    .filter((key) => key.startsWith(prefix) && shouldDelete(key))
    .forEach((key) => memoryEntries.delete(key));

  const database = await openDatabase();

  if (!database) {
    return;
  }

  try {
    const keys = await runTransaction<IDBValidKey[]>(database, "readonly", (store) =>
      store.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`)),
    );
    const keysToDelete = keys.filter(
      (key): key is string => typeof key === "string" && shouldDelete(key),
    );

    if (keysToDelete.length) {
      await runTransaction(database, "readwrite", (store) => {
        keysToDelete.forEach((key) => store.delete(key));
        return null;
      });
    }
  } catch {
    // Stale entries only cost space; the next refresh tries again.
  }
}

export async function clearPersistentCache() {
  memoryEntries.clear();

  const database = await openDatabase();

  if (database) {
    await runTransaction(database, "readwrite", (store) => store.clear()).catch(() => {});
  }
}

function openDatabase() {
  databasePromise ??= new Promise((resolve) => {
    try {
      if (!globalThis.indexedDB) {
        resolve(null);
        return;
      }

      const request = globalThis.indexedDB.open(databaseName, 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return databasePromise;
}

function runTransaction<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest | null,
) {
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = run(transaction.objectStore(storeName));

    transaction.oncomplete = () => resolve(request?.result as T);
    transaction.onerror = () => reject(transaction.error ?? request?.error);
    transaction.onabort = () => reject(transaction.error ?? request?.error);
  });
}
