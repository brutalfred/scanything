/**
 * Offline scan queue.
 *
 * Captures taken while the device is offline are stored in IndexedDB (images can
 * be a few hundred KB, far beyond what localStorage tolerates) and analyzed later
 * when connectivity returns.
 */

export type QueuedScanMode = "photo" | "resale" | "document";

export type QueuedScan = {
  id: string;
  mode: QueuedScanMode;
  dataUrl: string;
  createdAt: number;
};

const DB_NAME = "scanything-offline";
const STORE = "queued-scans";
const MAX_ENTRIES = 25;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline storage is not available on this device."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open offline storage."));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error ?? new Error("Offline storage failed."));
    t.oncomplete = () => db.close();
  });
}

export async function listQueuedScans(): Promise<QueuedScan[]> {
  try {
    const rows = await tx<QueuedScan[]>("readonly", (s) => s.getAll());
    return (rows ?? []).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function countQueuedScans(): Promise<number> {
  return (await listQueuedScans()).length;
}

export async function queueScan(input: { mode: QueuedScanMode; dataUrl: string }): Promise<QueuedScan> {
  const entry: QueuedScan = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode: input.mode,
    dataUrl: input.dataUrl,
    createdAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(entry));
  const all = await listQueuedScans();
  if (all.length > MAX_ENTRIES) {
    for (const old of all.slice(0, all.length - MAX_ENTRIES)) {
      await removeQueuedScan(old.id);
    }
  }
  return entry;
}

export async function removeQueuedScan(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* nothing to remove */
  }
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
