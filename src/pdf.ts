// 使用 pdf.js 官方 legacy 构建：modern 构建只面向最新 Chrome/Firefox，
// Safari/iPadOS 需要 legacy 构建（含 Promise.withResolvers / Promise.try 等 polyfill）。
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
// Vite 以静态资源（https 地址，非 blob:）输出 worker 文件
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { Module } from './types';
import { getPdfBuffer } from './usePdfStore';

/**
 * 优先使用自定义 worker（src/pdf.worker.ts，带 Safari 补丁），
 * 创建失败时回退到官方 legacy worker 文件。全局只创建一个 worker，所有文档共用。
 */
export function ensureWorker() {
  GlobalWorkerOptions.workerSrc = workerUrl; // 回退地址
  if (GlobalWorkerOptions.workerPort) return;
  try {
    GlobalWorkerOptions.workerPort = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    // 回退：pdf.js 会自行用 workerSrc 创建 worker
  }
}

ensureWorker();

const docs = new Map<string, ReturnType<typeof getDocument>>();

function getDocKey(module: Module, language: 'en' | 'zh'): string {
  // 请求中文但无中文版时回退英文
  if (language === 'zh' && !getPdfBuffer('zh', module.id)) return `en-${module.id}`;
  return `${language}-${module.id}`;
}

export function getPDF(module: Module, language: 'en' | 'zh' = 'en') {
  const key = getDocKey(module, language);
  const lang = key.startsWith('zh') ? 'zh' : 'en';
  const buffer = getPdfBuffer(lang, module.id);
  if (!buffer) throw new Error(`M${module.id} 课件尚未上传，请先在首页上传 PDF 文件。`);

  let task = docs.get(key);
  if (!task) {
    task = getDocument({
      // 必须传副本：pdf.js 会把数据转移给 worker，原 ArrayBuffer 随即失效，
      // 若传原数据的视图，下次重新加载同一模块会读到空数据
      data: new Uint8Array(buffer.slice(0)),
      cMapUrl: new URL('/pdfjs/cmaps/', document.baseURI).href,
      cMapPacked: true,
      standardFontDataUrl: new URL('/pdfjs/standard_fonts/', document.baseURI).href,
      wasmUrl: new URL('/pdfjs/wasm/', document.baseURI).href,
    });
    docs.set(key, task);
    task.promise.catch(() => docs.delete(key));
  }
  return task.promise;
}

/** 重新上传后清除缓存 */
export function evictPdf(lang: 'en' | 'zh', moduleId: number) {
  docs.delete(`${lang}-${moduleId}`);
}

export async function sourceText(module: Module, pages: number[]) {
  const doc = await getPDF(module);
  return (
    await Promise.all(
      pages.slice(0, 3).map(async (n) => {
        const text = await (await doc.getPage(n)).getTextContent();
        return (
          `M${module.id} p.${n}\n` +
          text.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ')
            .slice(0, 4500)
        );
      })
    )
  ).join('\n\n');
}
