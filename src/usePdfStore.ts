/**
 * usePdfStore — 管理用户上传的 PDF ObjectURL
 *
 * 存储结构：
 *   en: { 1: objectURL, 2: objectURL, ... }
 *   zh: { 1: objectURL, 2: objectURL, ... }
 *
 * ObjectURL 在页面生命周期内有效；刷新后需重新上传。
 * pageCount 存储每个已上传 PDF 的实际页数，供校验用。
 */

type LangStore = Record<number, string>; // moduleId -> objectURL

export type PdfStore = {
  en: LangStore;
  zh: LangStore;
  pageCounts: Record<string, number>; // key: `${lang}-${moduleId}`
};

const store: PdfStore = { en: {}, zh: {}, pageCounts: {} };

/** 注册一个上传的 PDF，返回 ObjectURL */
export function registerPdf(
  lang: 'en' | 'zh',
  moduleId: number,
  file: File,
  pageCount: number
): string {
  // 释放旧的 ObjectURL（如果有）
  const old = store[lang][moduleId];
  if (old) URL.revokeObjectURL(old);

  const url = URL.createObjectURL(file);
  store[lang][moduleId] = url;
  store.pageCounts[`${lang}-${moduleId}`] = pageCount;
  return url;
}

/** 获取 ObjectURL，不存在返回 null */
export function getPdfUrl(lang: 'en' | 'zh', moduleId: number): string | null {
  return store[lang][moduleId] ?? null;
}

/** 获取已上传 PDF 的页数，不存在返回 null */
export function getPdfPageCount(lang: 'en' | 'zh', moduleId: number): number | null {
  return store.pageCounts[`${lang}-${moduleId}`] ?? null;
}

/** 检查某模块是否已上传英文版 */
export function hasEnPdf(moduleId: number): boolean {
  return !!store.en[moduleId];
}

/** 检查所有模块（1-5）的英文版是否都已上传 */
export function allEnUploaded(moduleCount: number): boolean {
  for (let i = 1; i <= moduleCount; i++) {
    if (!store.en[i]) return false;
  }
  return true;
}

/** 获取当前 store 快照（用于渲染判断） */
export function getStore(): Readonly<PdfStore> {
  return store;
}
