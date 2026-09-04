/**
 * In-app photo gallery.
 *
 * Photos taken in "Take photo" mode (and any capture the user chooses to keep)
 * are stored locally in IndexedDB so the app can browse, re-scan, edit and share
 * them without touching the device's system gallery.
 */

export type GalleryPhoto = {
  id: string;
  dataUrl: string;
  createdAt: number;
  note?: string;
};

const DB_NAME = "scanything-gallery";
const STORE = "photos";
const MAX_ENTRIES = 200;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Local storage is not available on this device."));
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
    req.onerror = () => reject(req.error ?? new Error("Could not open the gallery."));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error("Gallery storage failed."));
        t.oncomplete = () => db.close();
      }),
  );
}

export async function listPhotos(): Promise<GalleryPhoto[]> {
  try {
    const rows = await tx<GalleryPhoto[]>("readonly", (s) => s.getAll());
    return (rows ?? []).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function savePhoto(dataUrl: string, note?: string): Promise<GalleryPhoto | null> {
  const photo: GalleryPhoto = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dataUrl,
    createdAt: Date.now(),
    ...(note ? { note } : {}),
  };
  try {
    await tx("readwrite", (s) => s.put(photo));
    // Trim the oldest entries so the store cannot grow unbounded.
    const all = await listPhotos();
    for (const old of all.slice(MAX_ENTRIES)) {
      await tx("readwrite", (s) => s.delete(old.id)).catch(() => {});
    }
    return photo;
  } catch {
    return null;
  }
}

export async function deletePhoto(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

export async function clearPhotos(): Promise<void> {
  try {
    await tx("readwrite", (s) => s.clear());
  } catch {
    /* ignore */
  }
}

export async function countPhotos(): Promise<number> {
  try {
    return (await tx<number>("readonly", (s) => s.count())) ?? 0;
  } catch {
    return 0;
  }
}
