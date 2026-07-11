import type { CloudMigrationBundleV2, MigrationReport } from "../types";

const DATABASE = "yetly-cloud-migration";
const STORE = "bundles";
const KEY = "pending";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No pudimos preparar el respaldo local."));
  });
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const request = operation(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No pudimos leer el respaldo de migración."));
  }).finally(() => db.close());
}

export async function savePendingMigration(workspaceJson: string) {
  const bundle: CloudMigrationBundleV2 = {
    format: "yetly-local-migration",
    version: 2,
    installationId: crypto.randomUUID(),
    exportedAt: new Date().toISOString(),
    workspaceJson,
    attachmentCount: 0,
  };
  await transact("readwrite", (store) => store.put(bundle, KEY));
  return bundle;
}

export async function getPendingMigration() {
  return (await transact("readonly", (store) => store.get(KEY))) as CloudMigrationBundleV2 | undefined;
}

export async function completePendingMigration(report: MigrationReport) {
  await transact("readwrite", (store) => store.put({ report, retainedAt: new Date().toISOString() }, "last-report"));
  await transact("readwrite", (store) => store.delete(KEY));
}

export function downloadMigrationBackup(bundle: CloudMigrationBundleV2) {
  const blob = new Blob([bundle.workspaceJson], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `yetly-respaldo-local-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
