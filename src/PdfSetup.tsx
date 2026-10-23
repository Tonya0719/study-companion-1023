/**
 * PdfSetup — PDF 上传界面
 *
 * 规则：
 * - 启动时自动从 IndexedDB 恢复已存的 PDF，全部英文版都在则直接进入
 * - 英文版（M1–M5）必须全部上传才能进入
 * - 中文版可选，逐模块单独上传
 * - 中文 M1 若页数 = 英文 M1 页数 + 1，说明未删第 34 页，阻止并提示
 * - 中文其他模块若页数 ≠ 英文版，显示警告但不阻止
 */

import { useEffect, useRef, useState } from 'react';
import { getDocument } from 'pdfjs-dist';
import { BookOpen, Upload, Check, AlertTriangle, X, FileText, LoaderCircle, RefreshCw } from 'lucide-react';
import { registerPdf, registerPdfBuffer } from './usePdfStore';
import { savePdfToDB, loadAllFromDB, deletePdfFromDB } from './pdfStorage';
import { ensureWorker } from './pdf';
import type { Module } from './types';

// 确保 worker 设置与主渲染器一致
ensureWorker();

type UploadState = {
  file?: File;          // 新上传的文件（可选，DB 恢复时无）
  buffer?: ArrayBuffer; // DB 恢复时直接有 buffer
  pageCount: number;
  fromDB?: boolean;
  error?: string;
  warning?: string;
};

type Props = {
  modules: Module[];
  onReady: (pageCounts: Record<number, { en: number; zh?: number }>) => void;
};

async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  return doc.numPages;
}

export default function PdfSetup({ modules, onReady }: Props) {
  const [en, setEn] = useState<Record<number, UploadState>>({});
  const [zh, setZh] = useState<Record<number, UploadState>>({});
  const [loading, setLoading] = useState<string>('');
  const [restoring, setRestoring] = useState(true);

  // 启动时从 IndexedDB 恢复
  useEffect(() => {
    void (async () => {
      try {
        const moduleIds = modules.map((m) => m.id);
        const { en: savedEn, zh: savedZh } = await loadAllFromDB(moduleIds);

        const enStates: Record<number, UploadState> = {};
        const zhStates: Record<number, UploadState> = {};

        for (const m of modules) {
          if (savedEn[m.id]) {
            enStates[m.id] = { ...savedEn[m.id], fromDB: true };
          }
        }
        for (const m of modules) {
          if (savedZh[m.id]) {
            const enPages = enStates[m.id]?.pageCount;
            let warning: string | undefined;
            if (enPages !== undefined && savedZh[m.id].pageCount !== enPages) {
              warning = `中文 M${m.id} 页数（${savedZh[m.id].pageCount} 页）与英文版（${enPages} 页）不一致。`;
            }
            zhStates[m.id] = { ...savedZh[m.id], fromDB: true, warning };
          }
        }

        setEn(enStates);
        setZh(zhStates);

        // 所有英文版都在，自动进入
        const allEnReady = modules.every((m) => enStates[m.id]);
        if (allEnReady) {
          const pageCounts: Record<number, { en: number; zh?: number }> = {};
          for (const m of modules) {
            registerPdfBuffer('en', m.id, enStates[m.id].buffer!, enStates[m.id].pageCount);
            pageCounts[m.id] = { en: enStates[m.id].pageCount };
            if (zhStates[m.id] && !zhStates[m.id].error) {
              registerPdfBuffer('zh', m.id, zhStates[m.id].buffer!, zhStates[m.id].pageCount);
              pageCounts[m.id].zh = zhStates[m.id].pageCount;
            }
          }
          onReady(pageCounts);
          return;
        }
      } catch {
        // IndexedDB 不可用（隐私模式等），静默忽略
      } finally {
        setRestoring(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = async (lang: 'en' | 'zh', moduleId: number, file: File) => {
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('请上传 PDF 文件');
      return;
    }
    const key = `${lang}-${moduleId}`;
    setLoading(key);
    try {
      const pageCount = await getPdfPageCount(file);

      let error: string | undefined;
      let warning: string | undefined;

      if (lang === 'zh') {
        const enPages = en[moduleId]?.pageCount;
        if (enPages !== undefined) {
          if (moduleId === 1 && pageCount === enPages + 1) {
            error =
              `中文 M1 比英文版多 1 页（${pageCount} vs ${enPages} 页）。` +
              `请在 PDF 编辑器中删除原第 34 页后重新上传。`;
          } else if (pageCount !== enPages) {
            warning =
              `中文 M${moduleId} 页数（${pageCount} 页）与英文版（${enPages} 页）不一致，` +
              `语言切换时页码可能偏移。`;
          }
        }
      }

      const state: UploadState = { file, pageCount, error, warning };

      // 存入 IndexedDB（有错误的不存）
      if (!error) {
        try { await savePdfToDB(lang, moduleId, file, pageCount); } catch { /* 隐私模式下忽略 */ }
      } else {
        // 有错误时删除旧的 DB 记录
        try { await deletePdfFromDB(lang, moduleId); } catch { /* ignore */ }
      }

      if (lang === 'en') {
        setEn((prev) => ({ ...prev, [moduleId]: state }));
        setZh((prev) => {
          const zhEntry = prev[moduleId];
          if (!zhEntry) return prev;
          let zhError: string | undefined;
          let zhWarning: string | undefined;
          if (moduleId === 1 && zhEntry.pageCount === pageCount + 1) {
            zhError = `中文 M1 比英文版多 1 页（${zhEntry.pageCount} vs ${pageCount} 页）。请删除原第 34 页后重新上传。`;
          } else if (zhEntry.pageCount !== pageCount) {
            zhWarning = `中文 M${moduleId} 页数（${zhEntry.pageCount} 页）与英文版（${pageCount} 页）不一致。`;
          }
          return { ...prev, [moduleId]: { ...zhEntry, error: zhError, warning: zhWarning } };
        });
      } else {
        setZh((prev) => ({ ...prev, [moduleId]: state }));
      }
    } catch {
      alert('无法读取 PDF，请确认文件完整。');
    } finally {
      setLoading('');
    }
  };

  const allEnReady = modules.every((m) => en[m.id] && !en[m.id].error);
  const hasZhError = modules.some((m) => zh[m.id]?.error);
  const canEnter = allEnReady && !hasZhError;

  const handleEnter = async () => {
    if (!canEnter) return;
    const pageCounts: Record<number, { en: number; zh?: number }> = {};
    for (const m of modules) {
      const enEntry = en[m.id];
      if (enEntry.buffer) {
        registerPdfBuffer('en', m.id, enEntry.buffer, enEntry.pageCount);
      } else if (enEntry.file) {
        await registerPdf('en', m.id, enEntry.file, enEntry.pageCount);
      }
      pageCounts[m.id] = { en: enEntry.pageCount };
      const zhEntry = zh[m.id];
      if (zhEntry && !zhEntry.error) {
        if (zhEntry.buffer) {
          registerPdfBuffer('zh', m.id, zhEntry.buffer, zhEntry.pageCount);
        } else if (zhEntry.file) {
          await registerPdf('zh', m.id, zhEntry.file, zhEntry.pageCount);
        }
        pageCounts[m.id].zh = zhEntry.pageCount;
      }
    }
    onReady(pageCounts);
  };

  // 恢复中显示 loading
  if (restoring) {
    return (
      <div className="startup">
        <div className="brand-icon"><BookOpen /></div>
        <h1>Study Companion</h1>
        <p><LoaderCircle size={16} className="spin" /> 正在恢复课件…</p>
      </div>
    );
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-header">
          <div className="brand-icon"><BookOpen size={28} /></div>
          <h1>Study Companion</h1>
          <p className="setup-subtitle">PE6204 · Cybersecurity &amp; Secure AI</p>
          <p className="setup-desc">
            请上传你的课件 PDF，文件仅保存在本地浏览器，不会上传到服务器。
            <br />
            英文版（必须）＋ 中文版（可选）
          </p>
        </div>

        <div className="setup-modules">
          {modules.map((m) => {
            const enState = en[m.id];
            const zhState = zh[m.id];

            return (
              <div key={m.id} className="setup-module">
                <div className="setup-module-title">
                  <span className="module-badge">M{m.id}</span>
                  <span>{m.shortTitle}</span>
                </div>

                {/* 英文版 */}
                <div className="setup-upload-row">
                  <span className="setup-lang-label required">英文版 *</span>
                  {enState ? (
                    <div className={`setup-file-status ${enState.error ? 'error' : 'ok'}`}>
                      <FileText size={14} />
                      <span>{enState.fromDB ? `M${m.id} 英文版` : enState.file?.name}</span>
                      <span className="page-count">{enState.pageCount} 页</span>
                      {enState.fromDB && <span className="db-badge"><RefreshCw size={10} />已恢复</span>}
                      {enState.error ? <AlertTriangle size={14} /> : <Check size={14} />}
                      <label className="setup-reupload" title="重新上传">
                        <X size={12} />
                        <input type="file" accept=".pdf,application/pdf"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile('en', m.id, f); e.target.value = ''; }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className={`setup-upload-btn${loading === `en-${m.id}` ? ' loading' : ''}`}>
                      <Upload size={14} />
                      {loading === `en-${m.id}` ? '读取中…' : '选择文件'}
                      {loading !== `en-${m.id}` && (
                        <input type="file" accept=".pdf,application/pdf"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile('en', m.id, f); e.target.value = ''; }}
                        />
                      )}
                    </label>
                  )}
                </div>
                {enState?.error && <div className="setup-error">{enState.error}</div>}

                {/* 中文版 */}
                <div className="setup-upload-row">
                  <span className="setup-lang-label optional">中文版</span>
                  {zhState ? (
                    <div className={`setup-file-status ${zhState.error ? 'error' : zhState.warning ? 'warn' : 'ok'}`}>
                      <FileText size={14} />
                      <span>{zhState.fromDB ? `M${m.id} 中文版` : zhState.file?.name}</span>
                      <span className="page-count">{zhState.pageCount} 页</span>
                      {zhState.fromDB && <span className="db-badge"><RefreshCw size={10} />已恢复</span>}
                      {zhState.error ? <AlertTriangle size={14} /> : zhState.warning ? <AlertTriangle size={14} className="warn-icon" /> : <Check size={14} />}
                      <label className="setup-reupload" title="重新上传">
                        <X size={12} />
                        <input type="file" accept=".pdf,application/pdf"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile('zh', m.id, f); e.target.value = ''; }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className={`setup-upload-btn optional${loading === `zh-${m.id}` ? ' loading' : ''}`}>
                      <Upload size={14} />
                      {loading === `zh-${m.id}` ? '读取中…' : '选择文件（可选）'}
                      {loading !== `zh-${m.id}` && (
                        <input type="file" accept=".pdf,application/pdf"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile('zh', m.id, f); e.target.value = ''; }}
                        />
                      )}
                    </label>
                  )}
                </div>
                {zhState?.error && <div className="setup-error">{zhState.error}</div>}
                {zhState?.warning && !zhState.error && <div className="setup-warning">{zhState.warning}</div>}
              </div>
            );
          })}
        </div>

        <div className="setup-footer">
          <p className="setup-hint">
            {!allEnReady
              ? `还需上传 ${modules.filter((m) => !en[m.id]).length} 个英文版模块`
              : hasZhError ? '请修复中文版错误后继续'
              : '所有必要文件已就绪 ✓'}
          </p>
          <button className="primary-button setup-enter" disabled={!canEnter} onClick={handleEnter}>
            <BookOpen size={16} />
            进入学习空间
          </button>
        </div>
      </div>
    </div>
  );
}
