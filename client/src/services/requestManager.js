// API 呼び出し管理（フォールバック前に10s待機を追加）
import { apiurl } from "@/api";
import { loadCustomEndpointsJsonpOnly, loadDisableTimeouts } from "@/utils/settingsManager";

// localStorage keys
const STORAGE_KEY = "custom_api_endpoints_v1";
const MODE_KEY = "api_mode_v1";

// カスタムエンドポイント(localStorageの管理)
export function loadCustomEndpoints() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
export function saveCustomEndpoints(list = []) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("saveCustomEndpoints error", e);
  }
}
export function loadMode() {
  try {
    return localStorage.getItem(MODE_KEY) || "existing";
  } catch {
    return "existing";
  }
}
export function saveMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch (e) {
    console.warn("saveMode error", e);
  }
}

// API URL の決定
export function getEffectiveApiUrl() {
  let mode = "existing";
  try { mode = localStorage.getItem(MODE_KEY) || "existing"; } catch {}
  let customs = [];
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) customs = JSON.parse(raw); } catch {}

  let base;
  if (mode === "existing") base = apiurl();
  else if (mode === "custom") base = customs.length ? customs[Math.floor(Math.random() * customs.length)] : apiurl();
  else {
    const pool = [...customs, apiurl()];
    base = pool.length ? pool[Math.floor(Math.random() * pool.length)] : apiurl();
  }

  try {
    if (typeof location !== "undefined" && location.protocol === "https:" && base.startsWith("http:")) {
      base = base.replace(/^http:/, "https:");
    }
  } catch {}

  return base;
}

// URL にパラメータをつける
export function buildUrl(base, params = {}) {
  try {
    // Special-case: if caller provides a raw query string under __rawQuery,
    // use it as-is (no encoding) so callers can control exact parameter formatting.
    if (params && typeof params.__rawQuery === "string") {
      const sep = base.includes("?") ? "&" : "?";
      return base + (params.__rawQuery ? sep + params.__rawQuery : "");
    }

    const url = new URL(base);
    Object.keys(params).forEach((k) => {
      if (params[k] == null) return;
      url.searchParams.append(k, String(params[k]));
    });
    return url.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    const qs = Object.entries(params)
      .filter(([k, v]) => v != null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    return base + (qs ? sep + qs : "");
  }
}

// JSONP 取得
function jsonpRequest(url, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const cbName = "jsonp_cb_" + Math.random().toString(36).slice(2, 10);
    const script = document.createElement("script");
    let done = false;

    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      try { delete window[cbName]; } catch { window[cbName] = undefined; }
    };

    window[cbName] = (data) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(data);
    };

    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${cbName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP script error"));
    };
    document.body.appendChild(script);

    // If timeout is a falsy/zero value, interpret as "no timeout"
    if (timeout && Number(timeout) > 0) {
      setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("JSONP timeout"));
      }, timeout);
    }
  });
}

// fetch リクエスト + ステータス追跡
async function fetchWithRedirects(url, options = {}, timeout = 60000) {
  const controller = new AbortController();
  let timer = null;
  if (timeout && Number(timeout) > 0) {
    timer = setTimeout(() => controller.abort(), timeout);
  }
  const mergedOpts = { ...options, signal: controller.signal, redirect: "follow" };
  let response;

  try {
    response = await fetch(url, mergedOpts);
    if (timer) clearTimeout(timer);
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (err.name === "AbortError") throw new Error("timeout");
    throw err;
  }

  const status = response.status;
  let data = null;

  try {
    const ct = (response.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("json")) data = await response.json();
    else {
      const text = await response.text();
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }
  } catch {
    data = { raw: null };
  }

  return { status, data };
}

// ---------------------------
// フォールバック前に10s待機するユーティリティ
// ---------------------------
async function waitForPossibleResponse(waitMs = 10000) {
  return new Promise((resolve) => setTimeout(resolve, waitMs));
}

// 中央化 API リクエスト（10s待ってからフォールバック）
export async function apiRequest(options = {}) {
  const {
    params = {},
    method = "GET",
    body = null,
    headers = {},
    timeout = 60000,
    retries = 1,
    signal: outerSignal = null,
  } = options;

  // ローカルプレイリストのチェック
  if (params.playlist && typeof params.playlist === 'string' && params.playlist.startsWith('local-')) {
    const { getPlaylistById } = await import("@/utils/playlistManager");
    const localIdStr = params.playlist.slice(6);
    if (!/^\d+$/.test(localIdStr)) throw new Error("Invalid local playlist ID");
    const localId = parseInt(localIdStr, 10);
    const customPl = await getPlaylistById(localId);
    if (!customPl) throw new Error("プレイリストが見つかりません");
    return {
      title: customPl.name,
      playlistId: params.playlist,
      totalItems: customPl.items.length,
      items: customPl.items.map((item) => ({
        videoId: item.id,
        title: item.title,
        author: item.authorName,
        thumbnail: item.thumbnailBinary ? arrayBufferToBase64(item.thumbnailBinary) : null,
        duration: null,
        views: item.views || null,
        published: item.published || null,
      })),
      isCustom: true,
    };
  }

  let lastErr = null;
  let isCustom = false;
  let jsonpOnlyForCustom = false;
  try { jsonpOnlyForCustom = !!loadCustomEndpointsJsonpOnly(); } catch {}
  let disableTimeouts = false;
  try { disableTimeouts = !!loadDisableTimeouts(); } catch {}

  // ---- カスタム URL: JSONP 優先 ----
  // 最初の試行でJSONPを試す（baseはランダム）
  const initialBase = getEffectiveApiUrl();
  const initialUrl = buildUrl(initialBase, params);
  isCustom = loadCustomEndpoints().includes(initialBase);
  if (isCustom) {
    try {
      const jsonpData = await jsonpRequest(initialUrl, disableTimeouts ? 0 : timeout);
      const status = jsonpData?.status ?? 200;

      if (status >= 400 && status <= 599) {
        if (jsonpOnlyForCustom) {
          throw new Error(`JSONP returned HTTP ${status}`);
        }
        console.warn(`JSONP got HTTP ${status}, waiting 10s before fetch fallback...`);
        await waitForPossibleResponse(10000); // ★ 10秒待つ
      } else {
        return jsonpData;
      }
    } catch (err) {
      console.warn("JSONP failed", err);
      lastErr = err;
      if (jsonpOnlyForCustom) {
        // JSONPのみを許可する設定 -> フェッチへフォールバックしない
        throw err;
      }
    }
  }

  // ---- fetch フォールバック ----
  for (let attempt = 1; attempt <= retries + 1; attempt++) {  // retries回再試行 + 最初の1回
    try {
      const base = getEffectiveApiUrl();  // 毎回別のbaseを取得
      const url = buildUrl(base, params);
      const res = await fetchWithRedirects(
        url,
        {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        },
        disableTimeouts ? 0 : timeout
      );

      const { status, data } = res;

      if (status >= 400 && status <= 599) {
        console.warn(`fetch got HTTP ${status}, waiting 10s before retry...`);
        await waitForPossibleResponse(10000); // ★ 10秒待つ
        lastErr = new Error(`HTTP ${status}`);
      } else {
        return data;
      }
    } catch (err) {
      lastErr = err;
    }

    if (attempt < retries + 1) await new Promise((r) => setTimeout(r, 300 * attempt));
  }

  throw lastErr || new Error("apiRequest failed");
}

function arrayBufferToBase64(arrayBuffer, mimeType = 'image/jpeg') {
  if (!arrayBuffer) return null;
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export { STORAGE_KEY as __STORAGE_KEY__ };
