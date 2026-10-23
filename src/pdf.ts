import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Module } from './types';
import { getPdfUrl } from './usePdfStore';

GlobalWorkerOptions.workerSrc = workerUrl;

const docs = new Map<string, ReturnType<typeof getDocument>>();

/** 从 ObjectURL store 取 URL，不存在时返回 null */
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
      cMapUrl: new URL('pdfjs/cmaps/', document.baseURI).href,
      cMapPacked: true,
      standardFontDataUrl: new URL('pdfjs/standard_fonts/', document.baseURI).href,
      wasmUrl: new URL('pdfjs/wasm/', document.baseURI).href,
    });
    docs.set(url, task);
    task.promise.catch(() => docs.delete(url));
  }
  return task.promise;
}

/** 清除某个模块语言的缓存（重新上传后调用） */
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
