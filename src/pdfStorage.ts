/**
 * pdfStorage — IndexedDB 持久化存储用户上传的 PDF
 *
 * 直接存 ArrayBuffer，避免 Safari 对 IndexedDB Blob 的兼容问题。
 */

const DB_NAME = 'pe6204-pdfs';
const DB_VERSION = 2; // 版本升级，旧 Blob 格式自动清空重建
const STORE = 'files';

type Entry = { buffer: ArrayBuffer; pageCount: number };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // 清除旧 store（版本 1 存的是 Blob），重新建
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
      db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePdfToDB(
  lang: 'en' | 'zh',
  moduleId: number,
  file: File,
  pageCount: number
): Promise<void> {
  const buffer = await file.arrayBuffer();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const entry: Entry = { buffer, pageCount };
    const req = tx.objectStore(STORE).put(entry, `${lang}-${moduleId}`);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadPdfFromDB(
  lang: 'en' | 'zh',
  moduleId: number
): Promise<{ buffer: ArrayBuffer; pageCount: number } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(`${lang}-${moduleId}`);
    req.onsuccess = () => {
      const entry = req.result as Entry | undefined;
      resolve(entry ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllFromDB(moduleIds: number[]): Promise<{
  en: Record<number, { buffer: ArrayBuffer; pageCount: number }>;
  zh: Record<number, { buffer: ArrayBuffer; pageCount: number }>;
}> {
  const en: Record<number, { buffer: ArrayBuffer; pageCount: number }> = {};
  const zh: Record<number, { buffer: ArrayBuffer; pageCount: number }> = {};
  await Promise.all(
    moduleIds.flatMap((id) => [
      loadPdfFromDB('en', id).then((r) => { if (r) en[id] = r; }),
      loadPdfFromDB('zh', id).then((r) => { if (r) zh[id] = r; }),
    ])
  );
  return { en, zh };
}

export async function deletePdfFromDB(lang: 'en' | 'zh', moduleId: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(`${lang}-${moduleId}`);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
