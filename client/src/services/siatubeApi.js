import { SIATUBE_API_ORIGIN } from "../api.js";
import { loadDisableTimeouts } from "../utils/settingsManager.js";
import {
  isRequestProxyLoadFailure,
  loadRequestProxy,
  loadRequestProxyJsonp,
  proxiedRequestUrl,
  recordRequestProxyLoadFailure,
  recordRequestProxyLoadSuccess,
  requestProxyJsonp,
  requestProxyTransport,
} from "../utils/requestProxy.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 1;
const RETRY_DELAY_MS = 250;
const RATE_LIMIT_RETRY_DELAY_MS = 2_100;
const STREAM_CACHE_TTL_MS = 5 * 60 * 1_000;
export const API_CONNECTION_FAILURE_EVENT = "siatube-api-connection-failure";
const API_HEALTH_URL = `${SIATUBE_API_ORIGIN}/health`;
const API_HEALTH_TIMEOUT_MS = 10_000;

const streamCache = new Map();
const streamRequests = new Map();
let apiHealthProbe = null;

function confirmDirectApiBlock(error) {
  if (typeof window === "undefined" || apiHealthProbe) return;

  apiHealthProbe = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_HEALTH_TIMEOUT_MS);
    let receivedJson = false;

    try {
      const response = await fetch(API_HEALTH_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json();
      receivedJson = response.ok && payload !== null && typeof payload === "object";
    } catch {
      receivedJson = false;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!receivedJson) {
      try {
        window.dispatchEvent(new CustomEvent(API_CONNECTION_FAILURE_EVENT, {
          detail: { error, healthUrl: API_HEALTH_URL, healthJsonReceived: false },
        }));
      } catch {}
    }
  })().finally(() => {
    apiHealthProbe = null;
  });
}

function pruneStreamCache(now = Date.now()) {
  for (const [key, entry] of streamCache) {
    if (!entry || now - entry.createdAt >= STREAM_CACHE_TTL_MS) {
      streamCache.delete(key);
    }
  }
}

export class SiaTubeApiError extends Error {
  constructor(message, details = {}) {
    super(message || "SiaTube API request failed");
    this.name = "SiaTubeApiError";
    this.code = details.code || "SIATUBE_API_ERROR";
    this.status = Number.isFinite(details.status) ? details.status : null;
    this.url = details.url || null;
    this.payload = details.payload ?? null;
    this.unavailable = details.unavailable === true;
    this.retryable = details.retryable === true;
    this.proxyUsed = details.proxyUsed === true;
    this.proxyUrl = details.proxyUrl || null;
    this.proxyTransport = details.proxyTransport || null;
    this.connectionFailure = details.connectionFailure === true;
    if (details.cause !== undefined) this.cause = details.cause;
  }
}

function validationError(message) {
  return new SiaTubeApiError(message, {
    code: "VALIDATION_ERROR",
    retryable: false,
  });
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw validationError(`${name} is required`);
  }
  return value.trim();
}

function pathSegment(value, name) {
  return encodeURIComponent(requireString(value, name));
}

function booleanQuery(value) {
  return value === true ? "true" : undefined;
}

function requestOptions(options = {}) {
  const result = {};
  for (const key of ["timeout", "retries", "signal", "headers"]) {
    if (options[key] !== undefined) result[key] = options[key];
  }
  return result;
}

function buildUrl(path, query = {}) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw validationError("API path must start with '/'");
  }

  const url = new URL(path, `${SIATUBE_API_ORIGIN}/`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) {
          url.searchParams.append(key, String(item));
        }
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function normalizeTimeout(value) {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw validationError("timeout must be a non-negative number");
  }
  return parsed;
}

function normalizeRetries(value) {
  if (value === undefined) return DEFAULT_RETRIES;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw validationError("retries must be a non-negative integer");
  }
  return parsed;
}

function abortError(signal, url = null) {
  const error = new SiaTubeApiError("Request was aborted", {
    code: "ABORTED",
    url,
    cause: signal?.reason,
    retryable: false,
  });
  // Preserve the platform convention used by existing AbortSignal consumers.
  error.name = "AbortError";
  return error;
}

function timeoutError(timeout, url, cause) {
  return new SiaTubeApiError(`Request timed out after ${timeout}ms`, {
    code: "TIMEOUT",
    url,
    cause,
    retryable: true,
  });
}

function errorMessage(payload, fallback) {
  if (payload && typeof payload === "object") {
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload.reason === "string" && payload.reason.trim()) {
      return payload.reason;
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  }
  return fallback;
}

function errorCode(payload, fallback) {
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  return fallback;
}

async function readJson(response, url) {
  try {
    if (typeof response.json === "function") return await response.json();
    if (typeof response.text === "function") {
      const text = await response.text();
      return JSON.parse(text);
    }
    throw new Error("Response does not expose a JSON body reader");
  } catch (cause) {
    const status = Number(response?.status) || null;
    const ok = response?.ok ?? (status !== null && status >= 200 && status < 300);
    if (!ok) {
      throw new SiaTubeApiError(
        status === null ? "SiaTube API request failed" : `SiaTube API returned HTTP ${status}`,
        {
          code: "HTTP_ERROR",
          status,
          url,
          cause,
          retryable: status === null || status === 408 || status === 429 || status >= 500,
        },
      );
    }
    throw new SiaTubeApiError("SiaTube API returned invalid JSON", {
      code: "INVALID_JSON",
      status,
      url,
      cause,
      retryable: true,
    });
  }
}

function validatePayload(payload, response, url) {
  const status = Number(response?.status) || null;
  const ok = response?.ok ?? (status !== null && status >= 200 && status < 300);

  if (!ok) {
    throw new SiaTubeApiError(
      errorMessage(
        payload,
        status === null ? "SiaTube API request failed" : `SiaTube API returned HTTP ${status}`,
      ),
      {
        code: errorCode(payload, "HTTP_ERROR"),
        status,
        url,
        payload,
        retryable: status === null || status === 408 || status === 429 || status >= 500,
      },
    );
  }

  if (payload && typeof payload === "object" && payload.error) {
    throw new SiaTubeApiError(errorMessage(payload, "SiaTube API returned an error"), {
      code: errorCode(payload, "API_ERROR"),
      status,
      url,
      payload,
      retryable: false,
    });
  }

  if (payload && typeof payload === "object" && payload.unavailable === true) {
    throw new SiaTubeApiError(errorMessage(payload, "This video is unavailable"), {
      code: "UNAVAILABLE",
      status,
      url,
      payload,
      unavailable: true,
      retryable: false,
    });
  }

  return payload;
}

async function performGet(url, options, proxyUrl, proxyTransport) {
  if (proxyUrl && proxyTransport === "jsonp") {
    const result = await requestProxyJsonp(url, {
      proxyUrl,
      signal: options.signal,
    });
    const status = Number(result.status);
    const ok = result.ok === true && status >= 200 && status < 300;
    const errorText = typeof result.error === "string" && result.error.trim()
      ? result.error
      : `JSONP proxy returned HTTP ${status}`;
    const payload = result.ok
      ? result.data
      : { error: errorText };
    return {
      ok,
      status,
      json: async () => payload,
    };
  }
  return fetch(proxiedRequestUrl(url, { url: proxyUrl }), options);
}

function finalizeRequestError(error, proxyUrl, proxyTransport) {
  const finalError = error instanceof SiaTubeApiError
    ? error
    : new SiaTubeApiError("Failed to reach the SiaTube API", {
      code: "NETWORK_ERROR",
      cause: error,
      retryable: true,
    });
  const proxyUsed = Boolean(proxyUrl);
  finalError.proxyUsed = proxyUsed;
  finalError.proxyUrl = proxyUsed ? proxyUrl : null;
  finalError.proxyTransport = proxyUsed ? proxyTransport : null;
  finalError.connectionFailure = isRequestProxyLoadFailure(finalError);

  if (finalError.connectionFailure) {
    finalError.originalMessage ||= finalError.message;
    finalError.message = proxyUsed
      ? proxyTransport === "jsonp"
        ? "JSONPプロキシ経由でしあtubeサーバーに接続できませんでした。JSONPまたはプロキシ設定を確認してください。"
        : "プロキシ経由でしあtubeサーバーに接続できませんでした。プロキシ設定またはネットワーク接続を確認してください。"
      : "しあtubeサーバーに接続できませんでした。ネットワーク接続を確認してください。";

    if (!proxyUsed) confirmDirectApiBlock(finalError);
  }

  if (proxyUsed) {
    void recordRequestProxyLoadFailure(proxyUrl, {
      error: finalError,
      transport: proxyTransport,
    }).catch(() => {});
  }
  return finalError;
}

function delay(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(abortError(signal));

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener?.("abort", onAbort);
      reject(abortError(signal));
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

/**
 * Perform a GET request against the configured SiaTube origin and parse JSON.
 */
export async function getJson(path, options = {}) {
  const {
    query = {},
    signal,
    headers = {},
  } = options;
  let timeout = normalizeTimeout(options.timeout);
  try {
    if (loadDisableTimeouts()) timeout = 0;
  } catch {}
  const retries = normalizeRetries(options.retries);
  const url = buildUrl(path, query).toString();
  const proxyUrl = loadRequestProxy().url;
  const proxyTransport = requestProxyTransport(
    Boolean(proxyUrl) && loadRequestProxyJsonp(),
  );

  if (signal?.aborted) {
    throw finalizeRequestError(abortError(signal, url), proxyUrl, proxyTransport);
  }

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    let timeoutId = null;
    const onExternalAbort = () => controller.abort(signal?.reason);

    if (signal) signal.addEventListener("abort", onExternalAbort, { once: true });
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);
    }

    try {
      const response = await performGet(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...headers,
        },
        credentials: "omit",
        redirect: "follow",
        signal: controller.signal,
      }, proxyUrl, proxyTransport);
      const payload = await readJson(response, url);
      const result = validatePayload(payload, response, url);
      if (proxyUrl) {
        recordRequestProxyLoadSuccess(proxyUrl, { transport: proxyTransport });
      }
      return result;
    } catch (cause) {
      if (signal?.aborted) {
        lastError = abortError(signal, url);
      } else if (timedOut) {
        lastError = timeoutError(timeout, url, cause);
      } else if (cause instanceof SiaTubeApiError) {
        lastError = cause;
      } else if (cause?.code === "INVALID_JSON") {
        lastError = new SiaTubeApiError("SiaTube API returned invalid JSONP", {
          code: "INVALID_JSON",
          url,
          cause,
          retryable: true,
        });
      } else {
        lastError = new SiaTubeApiError("Failed to reach the SiaTube API", {
          code: "NETWORK_ERROR",
          url,
          cause,
          retryable: true,
        });
      }
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (signal) signal.removeEventListener("abort", onExternalAbort);
    }

    if (!lastError.retryable || attempt >= retries) {
      throw finalizeRequestError(lastError, proxyUrl, proxyTransport);
    }
    const retryDelay = lastError.status === 429
      ? RATE_LIMIT_RETRY_DELAY_MS
      : RETRY_DELAY_MS * (attempt + 1);
    try {
      await delay(retryDelay, signal);
    } catch (cause) {
      throw finalizeRequestError(cause, proxyUrl, proxyTransport);
    }
  }

  throw finalizeRequestError(
    lastError || new SiaTubeApiError("SiaTube API request failed"),
    proxyUrl,
    proxyTransport,
  );
}

export function search(input, options = {}) {
  const params = typeof input === "string" ? { q: input } : (input || {});
  const mergedOptions = typeof input === "object" && input !== null
    ? { ...requestOptions(input), ...requestOptions(options) }
    : requestOptions(options);
  const queryValue = params.q ?? params.query;
  const q = typeof queryValue === "string" ? queryValue.trim() : "";
  const token = typeof params.token === "string" ? params.token.trim() : "";
  if (!q && !token) throw validationError("q or token is required");

  return getJson("/api/search", {
    ...mergedOptions,
    query: {
      q: q || undefined,
      token: token || undefined,
      raw: booleanQuery(params.raw),
    },
  });
}

export function suggest(keyword, options = {}) {
  const value = requireString(keyword, "keyword");
  return getJson("/api/suggest/", {
    ...requestOptions(options),
    query: { keyword: value },
  });
}

export function video(id, options = {}) {
  const depth = options.depth;
  if (depth !== undefined && (!Number.isInteger(Number(depth)) || Number(depth) < 0)) {
    throw validationError("depth must be a non-negative integer");
  }
  const videoId = requireString(id, "id");
  let requestId = videoId;
  let token = options.token;
  let queryDepth = depth;
  // The API officially supports this embedded form. Its deployed depth query
  // currently ignores depth=2, while the embedded form performs the promised
  // initial related-video expansion.
  if (depth !== undefined) {
    requestId = options.token
      ? `${videoId}====token==i==${options.token}==p==depth==i==${depth}`
      : `${videoId}====depth==i==${depth}`;
    token = undefined;
    queryDepth = undefined;
  }
  return getJson(`/api/video/${pathSegment(requestId, "id")}`, {
    ...requestOptions(options),
    query: {
      token,
      depth: queryDepth,
      raw: booleanQuery(options.raw),
    },
  });
}

export function comments(videoId, options = {}) {
  const id = requireString(videoId, "videoId");
  if (options.sort !== undefined && options.sort !== "top" && options.sort !== "new") {
    throw validationError("sort must be 'top' or 'new'");
  }
  return getJson("/api/comments", {
    ...requestOptions(options),
    query: {
      videoId: id,
      sort: options.sort,
      continuation: options.continuation,
      raw: booleanQuery(options.raw),
    },
  });
}

export function commentReplies(videoId, continuation, options = {}) {
  return getJson("/api/comment/replies", {
    ...requestOptions(options),
    query: {
      videoId: requireString(videoId, "videoId"),
      continuation: requireString(continuation, "continuation"),
      raw: booleanQuery(options.raw),
    },
  });
}

export function channel(id, options = {}) {
  return getJson(`/api/channel/${pathSegment(id, "id")}`, {
    ...requestOptions(options),
    query: { raw: booleanQuery(options.raw) },
  });
}

export function playlist(id, options = {}) {
  return getJson(`/api/playlist/${pathSegment(id, "id")}`, {
    ...requestOptions(options),
    query: {
      token: options.token,
      v: options.v,
      raw: booleanQuery(options.raw),
    },
  });
}

function withSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError(signal));

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(abortError(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export function stream(videoId, options = {}) {
  const id = requireString(videoId, "videoId");
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    throw validationError("videoId must be an 11-character YouTube video ID");
  }
  if (options.signal?.aborted) return Promise.reject(abortError(options.signal));

  const origin =
    options.origin === undefined ? "" : requireString(options.origin, "origin");
  const cacheKey = `${id}\u0000${origin}`;

  const now = Date.now();
  pruneStreamCache(now);
  const cached = streamCache.get(cacheKey);
  if (!options.forceRefresh && cached && now - cached.createdAt < STREAM_CACHE_TTL_MS) {
    return withSignal(Promise.resolve(cached.data), options.signal);
  }
  if (cached) streamCache.delete(cacheKey);

  let pending = streamRequests.get(cacheKey);
  if (!pending) {
    pending = getJson(`/api/stream/${pathSegment(id, "videoId")}`, {
      ...requestOptions({ ...options, signal: undefined }),
      query: { origin: origin || undefined },
    })
      .then((data) => {
        streamCache.set(cacheKey, { createdAt: Date.now(), data });
        return data;
      })
      .finally(() => {
        streamRequests.delete(cacheKey);
      });
    streamRequests.set(cacheKey, pending);
  }

  return withSignal(pending, options.signal);
}

export function clearStreamCache(videoId) {
  if (videoId === undefined) {
    streamCache.clear();
    return;
  }
  const id = requireString(videoId, "videoId");
  for (const key of streamCache.keys()) {
    if (key.startsWith(`${id}\u0000`)) streamCache.delete(key);
  }
}

export {
  DEFAULT_RETRIES,
  DEFAULT_TIMEOUT_MS,
  STREAM_CACHE_TTL_MS,
};
