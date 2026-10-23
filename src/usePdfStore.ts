/**
 * usePdfStore — 管理用户上传的 PDF，以 ArrayBuffer 存储
 *
 * 改用 ArrayBuffer 而非 ObjectURL，避免 pdfjs worker 线程
 * 无法跨上下文 fetch blob: URL 的问题。
 */

type LangStore = Record<number, ArrayBuffer>; // moduleId -> ArrayBuffer

type PdfStore = {
  en: LangStore;
  zh: LangStore;
  pageCounts: Record<string, number>; // key: `${lang}-${moduleId}`
};

const store: PdfStore = { en: {}, zh: {}, pageCounts: {} };

/** 注册一个上传的 PDF（存 ArrayBuffer） */
export async function registerPdf(
  lang: 'en' | 'zh',
  moduleId: number,
  file: File,
  pageCount: number
): Promise<void> {
  store[lang][moduleId] = await file.arrayBuffer();
  store.pageCounts[`${lang}-${moduleId}`] = pageCount;
}

/** 获取 ArrayBuffer，不存在返回 null */
export function getPdfBuffer(lang: 'en' | 'zh', moduleId: number): ArrayBuffer | null {
  return store[lang][moduleId] ?? null;
}

/** 获取已上传 PDF 的页数，不存在返回 null */
export function getPdfPageCount(lang: 'en' | 'zh', moduleId: number): number | null {
  return store.pageCounts[`${lang}-${moduleId}`] ?? null;
}

/** 检查所有模块（1-5）的英文版是否都已上传 */
export function allEnUploaded(moduleCount: number): boolean {
  for (let i = 1; i <= moduleCount; i++) {
    if (!store.en[i]) return false;
  }
  return true;
}
