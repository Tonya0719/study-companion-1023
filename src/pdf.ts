import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { Module } from './types';
import { getPdfBuffer } from './usePdfStore';

// Worker 作为静态文件部署，避免 blob: URL 被 CSP 拦截
GlobalWorkerOptions.workerSrc = new URL(
  '/pdfjs/pdf.worker.min.mjs',
  document.baseURI
).href;

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
    // 传 data（ArrayBuffer 副本），不走 URL fetch
    task = getDocument({
      data: buffer.slice(0),
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
