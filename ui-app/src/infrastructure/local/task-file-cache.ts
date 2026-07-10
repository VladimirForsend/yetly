const DATABASE_NAME = "yetly-files";
const STORE_NAME = "task-attachments";
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el almacenamiento local de archivos."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const request = operation(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo acceder al archivo local."));
  }).finally(() => database.close());
}

export function cacheTaskFile(attachmentId: string, blob: Blob) {
  return transaction("readwrite", (store) => store.put(blob, attachmentId));
}

export async function getCachedTaskFile(attachmentId: string): Promise<Blob | null> {
  return (await transaction("readonly", (store) => store.get(attachmentId))) ?? null;
}

export function removeCachedTaskFile(attachmentId: string) {
  return transaction("readwrite", (store) => store.delete(attachmentId));
}

export async function hasCachedTaskFile(attachmentId: string) {
  return Boolean(await getCachedTaskFile(attachmentId));
}
