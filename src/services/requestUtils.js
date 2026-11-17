export function emitProgress(callback, value) {
  if (typeof callback !== 'function') return;
  try { callback(value); } catch { /* Consumer callbacks must not invalidate fetched news. */ }
}

export function runRequest(request, { signal, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      handler(value);
    };
    const abort = () => {
      controller.abort();
      finish(reject, new DOMException('Request cancelled.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      controller.abort();
      finish(reject, new DOMException('Request timed out.', 'TimeoutError'));
    }, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) return abort();
    Promise.resolve().then(() => { if (!settled) return request(controller.signal); }).then(value => finish(resolve, value), error => finish(reject, error));
  });
}
