// 自定义 pdf.js worker 入口：先安装 Safari 兼容补丁，再加载官方 legacy worker。
// ES module 按导入顺序执行，补丁一定先于 worker 代码生效。
import './polyfills';
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
