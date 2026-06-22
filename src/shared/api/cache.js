const cache = new Map();
const DEFAULT_TTL_MS = 120_000;

export function getCached(key) {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.time >= entry.ttl) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCached(key, data, ttl = DEFAULT_TTL_MS) {
  cache.set(key, { data, time: Date.now(), ttl });
}

export function invalidateCache(prefix = "") {
  if (!prefix) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export async function cachedJsonGet(url, options = {}, ttl = DEFAULT_TTL_MS) {
  const auth = options.headers?.Authorization || "";
  const cacheKey = `GET:${url}:${auth}`;
  const cached = getCached(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  setCached(cacheKey, data, ttl);
  return data;
}
