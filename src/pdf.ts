import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { Module } from './types';
import { getPdfBuffer } from './usePdfStore';

// Safari/WebKit 不支持 ES Module worker，需要在主线程运行
// Chrome/Firefox 需要 worker 才能正常渲染
function setupWorker() {
  try {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      GlobalWorkerOptions.workerSrc = '';
    } else {
      GlobalWorkerOptions.workerSrc = new URL(
        '/pdfjs/pdf.worker.min.mjs',
        document.baseURI
      ).href;
    }
  } catch {
    GlobalWorkerOptions.workerSrc = '';
  }
}

export function ensureWorker() {
  if (GlobalWorkerOptions.workerSrc === undefined) setupWorker();
}

setupWorker();

// 缓存 key 用 `${lang}-${moduleId}`（ArrayBuffer 引用不变则复用）
const docs = new Map<string, ReturnType<typeof getDocument>>();

function getDocKey(module: Module, language: 'en' | 'zh'): string {
  // 若请求中文但无中文版，fallback 到英文
  if (language === 'zh' && !getPdfBuffer('zh', module.id)) {
    return `en-${module.id}`;
  }
  return `${language}-${module.id}`;
}

export function getPDF(module: Module, language: 'en' | 'zh' = 'en') {
  const key = getDocKey(module, language);
  const lang = key.startsWith('zh') ? 'zh' : 'en';
  const buffer = getPdfBuffer(lang, module.id);

  if (!buffer) {
    throw new Error(`M${module.id} 课件尚未上传，请先在首页上传 PDF 文件。`);
  }

  let task = docs.get(key);
  if (!task) {
    // 用 Uint8Array 复制数据，比 ArrayBuffer.slice 在 Safari 上更兼容
    const data = new Uint8Array(buffer);
    task = getDocument({
      data,
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
