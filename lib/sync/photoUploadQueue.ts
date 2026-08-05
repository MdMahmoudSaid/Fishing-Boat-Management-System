// File d'attente d'upload de photos hors-ligne (§3 du PROJECT_PLAN) :
// - la photo est d'abord sauvegardée localement (IndexedDB), jamais perdue
//   même si l'app se ferme avant reconnexion ;
// - `expenses.photo_local_status` (synchronisé par PowerSync) reflète l'état
//   pour l'UI : 'pending_upload' → 'uploaded' | 'failed' ;
// - dès que `navigator.onLine`, on tente l'upload vers Supabase Storage,
//   avec retry à backoff exponentiel (plafonné à 60s) en cas d'échec.

import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { supabase } from "@/lib/supabase/client";

const DB_NAME = "photo-upload-queue";
const STORE_NAME = "photos";
const DB_VERSION = 1;
const BUCKET = "expense-photos";
const MAX_RETRY_DELAY_MS = 60_000;

interface QueuedPhoto {
  expenseId: string;
  companyId: string;
  blob: Blob;
  createdAt: string;
}

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "expenseId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putQueuedPhoto(item: QueuedPhoto): Promise<void> {
  const idb = await openQueueDB();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  idb.close();
}

async function getAllQueuedPhotos(): Promise<QueuedPhoto[]> {
  const idb = await openQueueDB();
  const result = await new Promise<QueuedPhoto[]>((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedPhoto[]);
    request.onerror = () => reject(request.error);
  });
  idb.close();
  return result;
}

async function removeQueuedPhoto(expenseId: string): Promise<void> {
  const idb = await openQueueDB();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(expenseId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  idb.close();
}

// Appelé juste après la création d'une dépense avec photo (offline ou non).
export async function queuePhotoForUpload(
  db: AbstractPowerSyncDatabase,
  companyId: string,
  expenseId: string,
  blob: Blob,
): Promise<void> {
  await putQueuedPhoto({ expenseId, companyId, blob, createdAt: new Date().toISOString() });
  await db.execute(
    `UPDATE expenses SET photo_local_status = 'pending_upload' WHERE id = ?`,
    [expenseId],
  );
}

const retryAttempts = new Map<string, number>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export async function processUploadQueue(db: AbstractPowerSyncDatabase): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const queued = await getAllQueuedPhotos();
  for (const item of queued) {
    try {
      const path = `${item.companyId}/${item.expenseId}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, item.blob, {
        upsert: true,
        contentType: item.blob.type || "image/jpeg",
      });
      if (error) throw error;

      await db.execute(
        `UPDATE expenses SET photo_url = ?, photo_local_status = 'uploaded' WHERE id = ?`,
        [path, item.expenseId],
      );
      await removeQueuedPhoto(item.expenseId);
      retryAttempts.delete(item.expenseId);
    } catch (error) {
      console.error("Échec de l'upload de la photo (nouvelle tentative programmée)", item.expenseId, error);
      await db.execute(
        `UPDATE expenses SET photo_local_status = 'failed' WHERE id = ?`,
        [item.expenseId],
      );
      retryAttempts.set(item.expenseId, (retryAttempts.get(item.expenseId) ?? 0) + 1);
    }
  }

  const remaining = await getAllQueuedPhotos();
  if (remaining.length > 0) {
    scheduleRetry(db);
  }
}

function scheduleRetry(db: AbstractPowerSyncDatabase): void {
  if (retryTimer) return;
  const maxAttempts = Math.max(1, ...Array.from(retryAttempts.values()));
  const delayMs = Math.min(MAX_RETRY_DELAY_MS, 2000 * 2 ** maxAttempts);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void processUploadQueue(db);
  }, delayMs);
}

// À appeler une seule fois (ex: montage du layout protégé) : traite la file
// dès que possible et à chaque retour de connexion. Retourne une fonction de
// nettoyage à appeler au démontage.
export function registerPhotoUploadQueueListener(
  db: AbstractPowerSyncDatabase,
): () => void {
  const handler = () => void processUploadQueue(db);
  window.addEventListener("online", handler);
  handler();
  return () => window.removeEventListener("online", handler);
}
