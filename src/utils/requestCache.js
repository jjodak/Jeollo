// Share pending reads; failed requests are never cached and can be retried.
export function createRequestCache(ttlMs) {
  const entries = new Map();
  return (key, load, { force = false } = {}) => {
    const now = Date.now();
    for (const [entryKey, entry] of entries) {
      if (!entry.pending && entry.expiresAt <= now) entries.delete(entryKey);
    }
    const cached = entries.get(key);
    if (cached && (cached.pending || !force)) return cached.promise;
    const entry = { pending: true, expiresAt: 0 };
    entry.promise = Promise.resolve().then(load).then((value) => {
      entry.pending = false;
      entry.expiresAt = Date.now() + ttlMs;
      return value;
    }, (error) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    });
    entries.set(key, entry);
    return entry.promise;
  };
}
