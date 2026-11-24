import type { StepReportItem } from './TestStepReportPanel';
import { makeReportSpillKey } from './reportSpillLogic';

const DB_NAME = 'mmt-report-spill';
const DB_VERSION = 1;
const STORE_NAME = 'reports';

type SpillRecord = {
  id: string;
  fileKey: string;
  suiteRunId: string;
  nodeId: string;
  reports: StepReportItem[];
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('fileKey', 'fileKey', { unique: false });
        store.createIndex('fileRun', ['fileKey', 'suiteRunId'], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open report spill database'));
  });
  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Report spill database transaction failed'));
    tx.onerror = () => reject(tx.error ?? new Error('Report spill database transaction failed'));
  }));
}

export async function putSpilledReports(
  fileKey: string,
  suiteRunId: string,
  nodeId: string,
  reports: StepReportItem[],
): Promise<void> {
  if (!fileKey || !suiteRunId || !nodeId) {
    return;
  }
  const record: SpillRecord = {
    id: makeReportSpillKey(fileKey, suiteRunId, nodeId),
    fileKey,
    suiteRunId,
    nodeId,
    reports,
  };
  await runTransaction('readwrite', (store) => store.put(record));
}

/** Records per transaction. Keeps a single transaction from growing without bound. */
const BATCH_CHUNK_SIZE = 100;

/**
 * Write many nodes in few transactions (one commit per chunk instead of one per node).
 * Resolves only after the data is committed. If any chunk fails this rejects, and the
 * caller must treat the whole batch as not spilled (earlier chunks may have been written;
 * that is harmless because they are only read for nodes the caller marks as spilled).
 */
export async function putSpilledReportsBatch(
  fileKey: string,
  suiteRunId: string,
  entries: ReadonlyArray<{ nodeId: string; reports: StepReportItem[] }>,
): Promise<void> {
  if (!fileKey || !suiteRunId || entries.length === 0) {
    return;
  }
  const db = await openDb();
  for (let start = 0; start < entries.length; start += BATCH_CHUNK_SIZE) {
    const chunk = entries.slice(start, start + BATCH_CHUNK_SIZE);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const entry of chunk) {
        if (!entry.nodeId) {
          continue;
        }
        const record: SpillRecord = {
          id: makeReportSpillKey(fileKey, suiteRunId, entry.nodeId),
          fileKey,
          suiteRunId,
          nodeId: entry.nodeId,
          reports: entry.reports,
        };
        store.put(record);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Report spill database transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('Report spill database transaction aborted'));
    });
  }
}

export async function getSpilledReports(
  fileKey: string,
  suiteRunId: string,
  nodeId: string,
): Promise<StepReportItem[] | undefined> {
  if (!fileKey || !suiteRunId || !nodeId) {
    return undefined;
  }
  const id = makeReportSpillKey(fileKey, suiteRunId, nodeId);
  const record = await runTransaction<SpillRecord | undefined>('readonly', (store) => store.get(id));
  if (!record || !Array.isArray(record.reports)) {
    return undefined;
  }
  return record.reports;
}

async function deleteByIndexMatches(
  indexName: string,
  key: IDBValidKey | IDBKeyRange,
): Promise<void> {
  await openDb().then((db) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index(indexName);
    const cursorRequest = index.openCursor(key);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
        return;
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error('Failed to scan report spill database'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete spilled reports'));
  }));
}

export async function deleteSpilledReportsForFile(fileKey: string): Promise<void> {
  if (!fileKey) {
    return;
  }
  await deleteByIndexMatches('fileKey', fileKey);
}

export async function deleteSpilledReportsForRun(fileKey: string, suiteRunId: string): Promise<void> {
  if (!fileKey || !suiteRunId) {
    return;
  }
  await deleteByIndexMatches('fileRun', IDBKeyRange.only([fileKey, suiteRunId]));
}

export async function materializeSpilledReports(
  inline: Record<string, StepReportItem[]>,
  spilledNodeIds: Set<string>,
  fileKey: string,
  suiteRunId: string | null | undefined,
): Promise<Record<string, StepReportItem[]>> {
  if (!fileKey || !suiteRunId || spilledNodeIds.size === 0) {
    return inline;
  }
  const merged: Record<string, StepReportItem[]> = { ...inline };
  for (const nodeId of Array.from(spilledNodeIds)) {
    const loaded = await getSpilledReports(fileKey, suiteRunId, nodeId);
    if (loaded) {
      merged[nodeId] = loaded;
    }
  }
  return merged;
}

/** Test helper / manual reset. */
export async function clearReportSpillDatabase(): Promise<void> {
  dbPromise = null;
  if (typeof indexedDB === 'undefined') {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete report spill database'));
  });
}
