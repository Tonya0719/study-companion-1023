/**
 * pdfStorage — IndexedDB 持久化存储用户上传的 PDF
 *
 * DB: pe6204-pdfs  Store: files
 * key: `${lang}-${moduleId}`  value: { file: Blob, pageCount: number }
 *
 * 用户上传一次后，刷新页面自动恢复，无需重传。
 * 清除方式：浏览器设置 → 清除网站数据。
 */

const DB_NAME = 'pe6204-pdfs';
const DB_VERSION = 1;
const STORE = 'files';

type Entry = { blob: Blob; pageCount: number };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
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
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const entry: Entry = { blob: file, pageCount };
    const req = tx.objectStore(STORE).put(entry, `${lang}-${moduleId}`);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadPdfFromDB(
  lang: 'en' | 'zh',
  moduleId: number
): Promise<{ file: File; pageCount: number } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(`${lang}-${moduleId}`);
    req.onsuccess = () => {
      const entry = req.result as Entry | undefined;
      if (!entry) { resolve(null); return; }
      // Blob → File（保留文件名无关紧要，只需内容）
      const file = new File([entry.blob], `M${moduleId}-${lang}.pdf`, { type: 'application/pdf' });
      resolve({ file, pageCount: entry.pageCount });
    };
    req.onerror = () => reject(req.error);
  });
}

/** 检查所有模块英文版是否都已存入 DB */
export async function checkAllEnInDB(moduleCount: number): Promise<boolean> {
  for (let i = 1; i <= moduleCount; i++) {
    const entry = await loadPdfFromDB('en', i);
    if (!entry) return false;
  }
  return true;
}

/** 从 DB 加载所有已存 PDF，返回 { en: {id: {file,pageCount}}, zh: {...} } */
export async function loadAllFromDB(moduleIds: number[]): Promise<{
  en: Record<number, { file: File; pageCount: number }>;
  zh: Record<number, { file: File; pageCount: number }>;
}> {
  const en: Record<number, { file: File; pageCount: number }> = {};
  const zh: Record<number, { file: File; pageCount: number }> = {};
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
