/**
 * Safari（含 iPadOS）兼容补丁，在页面主线程和 pdf.js worker 中都会加载。
 *
 * 1. pdf.js 的 page.getTextContent() 内部使用 `for await (const v of readableStream)`，
 *    依赖 ReadableStream.prototype[Symbol.asyncIterator]。Chrome/Firefox 原生支持，
 *    较早的 Safari 未实现，会抛出 "undefined is not a function (near '...e of t...')"。
 * 2. Promise.withResolvers 在 iPadOS 17.4 以前不存在。
 *
 * 仅在缺失时安装；已原生支持的浏览器（电脑端 Chrome/Edge）完全不受影响。
 * 只能使用 worker 中也存在的 API（不可引用 window/document）。
 */
type AnyProto = Record<PropertyKey, unknown>;

// Promise.withResolvers：iPadOS 17.4 以前没有；pdf.js legacy 构建会补 Promise.try，但不补这个
if (typeof (Promise as unknown as AnyProto).withResolvers !== 'function') {
  Object.defineProperty(Promise, 'withResolvers', {
    value: function <T>(this: PromiseConstructor) {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new this<T>((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    },
    writable: true,
    configurable: true,
  });
}

if (typeof ReadableStream !== 'undefined') {
  const proto = ReadableStream.prototype as unknown as AnyProto;
  if (typeof proto[Symbol.asyncIterator] !== 'function') {
    const values = function (this: ReadableStream, options?: { preventCancel?: boolean }) {
      const reader = this.getReader();
      const preventCancel = !!options?.preventCancel;
      return {
        next: () => reader.read(),
        async return(value?: unknown) {
          try {
            if (!preventCancel) await reader.cancel(value);
          } finally {
            reader.releaseLock();
          }
          return { done: true as const, value };
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    };
    if (typeof proto.values !== 'function') {
      Object.defineProperty(proto, 'values', { value: values, writable: true, configurable: true });
    }
    Object.defineProperty(proto, Symbol.asyncIterator, { value: values, writable: true, configurable: true });
  }
}

export {};
