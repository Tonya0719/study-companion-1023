import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { Module } from './types';
import { getPdfUrl } from './usePdfStore';

// 使用静态 URL 指向 worker 文件，避免 blob: URL 被 CSP 拦截
// pdfjs-dist 的 worker 已复制到 public/pdfjs/ 目录
GlobalWorkerOptions.workerSrc = new URL(
  '/pdfjs/pdf.worker.min.mjs',
  document.baseURI
).href;

const docs = new Map<string, ReturnType<typeof getDocument>>();

function resolveUrl(module: Module, language: 'en' | 'zh'): string | null {
  if (language === 'zh') {
    return getPdfUrl('zh', module.id) ?? getPdfUrl('en', module.id);
  }
  return getPdfUrl('en', module.id);
}

export function getPDF(module: Module, language: 'en' | 'zh' = 'en') {
  const url = resolveUrl(module, language);
  if (!url) throw new Error(`M${module.id} 课件尚未上传，请先在首页上传 PDF 文件。`);

  let task = docs.get(url);
  if (!task) {
    task = getDocument({
      url,
      cMapUrl: new URL('/pdfjs/cmaps/', document.baseURI).href,
      cMapPacked: true,
      standardFontDataUrl: new URL('/pdfjs/standard_fonts/', document.baseURI).href,
      wasmUrl: new URL('/pdfjs/wasm/', document.baseURI).href,
    });
    docs.set(url, task);
    task.promise.catch(() => docs.delete(url));
  }
  return task.promise;
}

export function evictPdf(module: Module, language: 'en' | 'zh') {
  const url = resolveUrl(module, language);
  if (url) docs.delete(url);
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
