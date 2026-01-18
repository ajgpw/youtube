import express from "express";
import { Innertube } from "youtubei.js";
import fetch from "node-fetch";

// 設定・環境変数
const PORT = 3012;
const THUMB_CACHE_TTL = 43200 * 1000; // 12h
const MAX_CACHE_SIZE = 2000; //キャッシュする画像の最大数

// Header 定義
const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Upgrade-Insecure-Requests": "1",
  "sec-ch-ua":
    '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Chrome OS"',
};

const YT_API_HEADERS = {
  ...BASE_HEADERS,
  "Content-Type": "application/json",
  "x-youtube-client-name": "1", // WEB
  "x-youtube-client-version": "2.20251212.01.00",
  "Origin": "https://www.youtube.com",
  "Referer": "https://www.youtube.com/",
};

const WATCH_HEADERS = {
  ...BASE_HEADERS,
  "Referer": "https://www.youtube.com/",
};

let errorLogEnabled = true;
const originalConsole = { ...console };

setTimeout(() => {
  errorLogEnabled = false;
  originalConsole.log("⛔ エラー・警告ログ停止（10秒経過 - 本番モード）");
}, 10000);

// プロセス全体のクラッシュを防ぐためのハンドラー
process.on('uncaughtException', (err) => {
  originalConsole.error('🔥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  if (errorLogEnabled) {
    originalConsole.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
  }
});

for (const key of Object.keys(originalConsole)) {
  console[key] = (...args) => {
    if (key === "error" || key === "warn") {
      if (errorLogEnabled) originalConsole[key](...args);
    } else {
      originalConsole[key](...args);
    }
  };
}

// 画像キャッシュ管理（メモリリーク対策版）
class LRUCache {
  constructor(limit) {
    this.limit = limit;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const item = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, item);
    return item;
  }

  set(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.limit) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, value);
  }
}

const thumbCache = new LRUCache(MAX_CACHE_SIZE);

async function fetchImageBase64(url, fallbackType = "image/jpeg") {
  if (!url) return "";
  const now = Date.now();

  const cached = thumbCache.get(url);
  if (cached && cached.expireAt > now) return cached.base64;

  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const type = res.headers.get("content-type") || fallbackType;
    const buf = Buffer.from(await res.arrayBuffer());
    const base64 = `data:${type};base64,${buf.toString("base64")}`;
    
    thumbCache.set(url, { base64, expireAt: now + THUMB_CACHE_TTL });
    return base64;
  } catch {
    return "";
  }
}

// youtubi.js クライアント管理
let ytPromise = null;

function getYouTubeClient(force = false) {
  if (force) {
    originalConsole.log("♻️ YouTubeクライアント再生成要求");
    ytPromise = null;
  }
  if (!ytPromise) {
    console.log("🔄 YouTubeクライアント初期化中...");
    ytPromise = Innertube.create({
      lang: "ja",
      location: "JP",
      retrieve_player: true,
    })
      .then((client) => {
        console.log("✅ YouTubeクライアント初期化完了");
        return client;
      })
      .catch((err) => {
        ytPromise = null;
        originalConsole.error("❌ YouTube 初期化失敗:", err);
        throw err;
      });
  }
  return ytPromise;
}

// 起動時初期化
getYouTubeClient();

// Express 初期化
const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const router = express.Router();

// データ抽出・加工ヘルパー
function extractVideoItem(lvm) {
  const watch = lvm?.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint;
  const videoId = watch?.videoId ?? lvm?.contentId;
  const playlistId = watch?.playlistId;

  const meta = lvm?.metadata?.lockupMetadataViewModel;
  const title = meta?.title?.content ?? "";

  if (playlistId) {
    return { type: "playlist", title, videoId, playlistId };
  }

  const rows = meta?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
  let duration = null;
  const overlays = lvm?.contentImage?.thumbnailViewModel?.overlays ?? [];
  
  for (const o of overlays) {
    const text = o?.thumbnailOverlayBadgeViewModel?.thumbnailBadges?.[0]?.thumbnailBadgeViewModel?.text;
    if (text) {
      duration = text;
      break;
    }
  }

  return {
    type: "video",
    videoId,
    title,
    channelName: rows?.[0]?.metadataParts?.[0]?.text?.content ?? "",
    viewCountText: rows?.[1]?.metadataParts?.[0]?.text?.content ?? "",
    publishedTimeText: rows?.[1]?.metadataParts?.[1]?.text?.content ?? "",
    duration,
    badge: rows?.[2]?.badges?.[0]?.badgeViewModel?.badgeText ?? null,
    thumbnails: lvm?.contentImage?.thumbnailViewModel?.image?.sources ?? [],
    channelAvatar:
      meta?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url ?? "",
    overlayIcon:
      overlays?.[0]?.thumbnailOverlayBadgeViewModel?.thumbnailBadges?.[0]?.thumbnailBadgeViewModel
        ?.icon?.sources?.[0]?.clientResource?.imageName ?? null,
    verifiedIcon:
      rows?.[0]?.metadataParts?.[0]?.text?.attachmentRuns?.[0]?.element?.type?.imageType?.image
        ?.sources?.[0]?.clientResource?.imageName ?? null,
  };
}

async function fetchAndExtractVideos(token, videoId) {
  const payload = {
    context: {
      client: {
        hl: "ja",
        gl: "JP",
        clientName: "WEB",
        clientVersion: YT_API_HEADERS["x-youtube-client-version"],
        userAgent: BASE_HEADERS["User-Agent"],
        platform: "DESKTOP",
        originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      },
    },
    continuation: token,
  };

  try {
    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/next?prettyPrint=false",
      {
        method: "POST",
        headers: YT_API_HEADERS,
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) return { videos: [], nextToken: null };
    const data = await res.json();

    const actions = [
      ...(data.onResponseReceivedEndpoints ?? []),
      ...(data.onResponseReceivedActions ?? []),
    ];

    const videos = [];
    let nextToken = null;

    for (const a of actions) {
      const items =
        a.appendContinuationItemsAction?.continuationItems ??
        a.reloadContinuationItemsCommand?.continuationItems;
      if (!items) continue;

      for (const item of items) {
        if (item.continuationItemRenderer) {
          nextToken =
            item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ??
            nextToken;
        } else if (item.lockupViewModel) {
          const v = extractVideoItem(item.lockupViewModel);
          if (v.videoId) videos.push(v);
        }
      }
    }
    return { videos, nextToken };
  } catch (e) {
    if(errorLogEnabled) console.error("fetchAndExtractVideos error:", e);
    return { videos: [], nextToken: null };
  }
}

async function getRelatedVideosLogic(videoId, token, depth) {
  const depthInt = depth ? parseInt(depth) : 0;
  let relatedVideos = [];
  let continuationToken = token ?? null;

  try {
    if (!continuationToken) {
      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: WATCH_HEADERS,
      });
      if (!res.ok) throw new Error(`watch fetch failed: ${res.status}`);

      const html = await res.text();
      const m = html.match(/var ytInitialData\s*=\s*({.+?});/);
      if (!m) throw new Error("ytInitialData not found");

      const data = JSON.parse(m[1]);
      const results =
        data?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results ??
        [];

      for (const item of results) {
        if (item.continuationItemRenderer) {
          continuationToken =
            item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ??
            continuationToken;
        } else if (item.lockupViewModel) {
          const v = extractVideoItem(item.lockupViewModel);
          if (v.videoId) relatedVideos.push(v);
        }
      }
    }

    let currentDepth = 0;
    while (currentDepth < depthInt && continuationToken) {
      await new Promise((r) => setTimeout(r, 200));
      const r = await fetchAndExtractVideos(continuationToken, videoId);
      relatedVideos.push(...r.videos);
      continuationToken = r.nextToken;
      currentDepth++;
    }

    await Promise.all(
      relatedVideos.map(async (v) => {
        const thumbUrl =
          v.thumbnails?.[0]?.url ??
          (v.videoId ? `https://i.ytimg.com/vi_webp/${v.videoId}/default.webp` : null);
        
        if (thumbUrl) {
            v.thumbnail = await fetchImageBase64(
                thumbUrl,
                thumbUrl.includes("webp") ? "image/webp" : "image/jpeg"
            );
        } else {
            v.thumbnail = "";
        }
      })
    );

    return {
      relatedCount: relatedVideos.length,
      nextContinuationToken: continuationToken,
      relatedVideos,
    };
  } catch (e) {
    return {
      relatedCount: 0,
      nextContinuationToken: null,
      relatedVideos: [],
      error: e.message,
    };
  }
}

// エラーがリトライ可能か判定するロジック
// YouTubeの仕様による制限(unavailable等)はリトライ不可とする
const isRetryableError = (error) => {
  if (!error) return false;
  const msg = error.message || error.toString();
  
  // ネットワーク、fetch失敗、接続リセット等はリトライ対象
  if (
    msg.includes("fetch failed") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("network")
  ) {
    return true;
  }

  // 以下はリトライしても解決しない仕様上のエラー
  // "This video is unavailable", "Sign in to confirm your age", "Private video" 等
  if (
    msg.includes("unavailable") ||
    msg.includes("age-restricted") ||
    msg.includes("Sign in") ||
    msg.includes("Private") ||
    msg.includes("No video content found")
  ) {
    return false;
  }

  // 不明なエラーは念のためリトライしない（無限ループ防止）か、
  // 致命的でない限り1回だけリトライする設計にするのが安全だが、
  // ここでは明示的なネットワークエラー以外はスキップする方針
  return false;
};

router.get("/:id", async (req, res) => {
  let videoId = req.params.id;
  let { token, depth } = req.query;

  try {
    videoId = decodeURIComponent(videoId);
  } catch {}

  /* --- パラメータ解析ロジック --- */
  let customParamsString = "";

  if (videoId.includes("====")) {
    const p = videoId.split("====");
    videoId = p[0];
    customParamsString = p[1];
  } else if (videoId.includes("==p==")) {
    const i = videoId.indexOf("==p==");
    customParamsString = videoId.substring(i + 5);
    videoId = videoId.substring(0, i);
  } else if (videoId.includes("&")) {
    const parts = videoId.split("&");
    videoId = parts[0];
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].startsWith("depth=")) depth = parts[i].split("=")[1];
      if (parts[i].startsWith("token=")) token = parts[i].split("=")[1];
    }
  }

  if (customParamsString) {
    const pairs = customParamsString.split("==p==").filter(Boolean);
    for (const pair of pairs) {
      const [k, v] = pair.split("==i==");
      if (k === "token") token = v;
      if (k === "depth") depth = v;
    }
  }
  /* ------------------------------------------- */

  if (!videoId) return res.status(400).json({ error: "無効な動画IDです。" });

  let client;
  try {
    client = await getYouTubeClient();
  } catch {
    return res.status(503).json({ error: "YouTubeクライアント初期化失敗" });
  }

  res.setHeader("Cache-Control", "public, max-age=3600");

  // 実行関数: Promise.allSettled を使用し、個別に成否を判定
  const exec = async (c) => {
    const results = await Promise.allSettled([
      c.getInfo(videoId),
      fetchImageBase64(
        `https://i.ytimg.com/vi_webp/${videoId}/default.webp`,
        "image/webp"
      ),
      getRelatedVideosLogic(videoId, token, depth),
    ]);
    return results;
  };

  try {
    let results = await exec(client);

    // getInfo が失敗しており、かつそれが「リトライ可能なエラー」である場合のみリトライ
    const infoResult = results[0];
    if (infoResult.status === "rejected" && isRetryableError(infoResult.reason)) {
      if (errorLogEnabled) {
        console.warn(`⚠️ Network error on getInfo, retrying... (${infoResult.reason.message})`);
      }
      // クライアントを強制リフレッシュして再試行
      client = await getYouTubeClient(true);
      results = await exec(client);
    }

    // 結果の展開 (Promise.allSettled の結果処理)
    const infoData = results[0].status === "fulfilled" ? results[0].value : null;
    const infoError = results[0].status === "rejected" ? results[0].reason : null;
    
    const thumbData = results[1].status === "fulfilled" ? results[1].value : "";
    const relatedData = results[2].status === "fulfilled" ? results[2].value : { relatedVideos: [] };

    // getInfo が失敗 (null) した場合の処理
    if (!infoData) {
      // ログ制御: リトライ不可のエラー（再生不可など）はエラーログに出さない
      // 逆に、リトライ対象外だが未知のエラーであればログに残す
      if (errorLogEnabled && infoError && !infoError.message?.includes("unavailable")) {
         // ここでは「意図しない失敗」のみログに出す
         console.warn(`Info fetch failed for ${videoId}:`, infoError.message);
      }

      // 部分成功レスポンス (Unavailableとして返す)
      return res.json({
        id: videoId,
        unavailable: true,
        reason: infoError?.message || "This video is unavailable",
        thumbnail: thumbData, // サムネイルは取得できている可能性があるため返す
        "Related-videos": relatedData, // 関連動画も同様
      });
    }

    // 安全なデータ抽出 (Null Safety check)
    const authorThumb =
      [
        infoData?.endscreen?.elements?.[0]?.image?.[0]?.url,
        infoData?.endscreen?.elements?.[1]?.image?.[0]?.url,
        infoData?.player_overlays?.video_details?.channel_avatar?.image?.sources?.[0]?.url,
        infoData?.secondary_info?.owner?.author?.thumbnails?.[0]?.url,
      ].find((u) => typeof u === "string" && u.includes("yt3.ggpht.com")) ?? "";

    // 正常レスポンス構築
    res.json({
      id: videoId,
      title: infoData?.basic_info?.title ?? "",
      views:
        infoData?.primary_info?.view_count?.short_view_count?.text ??
        infoData?.primary_info?.view_count?.view_count?.text ??
        infoData?.basic_info?.view_count ??
        "",
      relativeDate: infoData?.primary_info?.relative_date?.text ?? "",
      likes:
        infoData?.primary_info?.menu?.top_level_buttons?.[0]?.short_like_count ??
        infoData?.basic_info?.menu?.top_level_buttons?.[0]?.short_like_count ??
        "",
      thumbnail: thumbData,
      author: {
        id:
          infoData?.basic_info?.channel_id ??
          infoData?.basic_info?.channel?.id ??
          infoData?.secondary_info?.owner?.author?.id ??
          "",
        name:
          infoData?.basic_info?.author ??
          infoData?.basic_info?.channel?.name ??
          infoData?.secondary_info?.owner?.author?.name ??
          "",
        subscribers: infoData?.secondary_info?.owner?.subscriber_count?.text ?? "",
        thumbnail: authorThumb,
        collaborator:
          !!infoData?.secondary_info?.owner?.author?.endpoint?.payload?.panelLoadingStrategy
            ?.inlineContent?.dialogViewModel?.header?.dialogHeaderViewModel?.headline?.content,
        collaborators:
          infoData?.secondary_info?.owner?.author?.endpoint?.payload?.panelLoadingStrategy
            ?.inlineContent?.dialogViewModel?.customContent?.listViewModel?.listItems?.map(
              (i) => {
                const vm = i?.listItemViewModel ?? {};
                return {
                  name: vm?.title?.content ?? "",
                  subtitle: vm?.subtitle?.content ?? "",
                  channelId:
                    vm?.title?.commandRuns?.[0]?.onTap?.innertubeCommand?.browseEndpoint
                      ?.browseId ?? "",
                  thumbnail:
                    vm?.leadingAccessory?.avatarViewModel?.image?.sources?.[0]?.url ?? "",
                };
              }
            ) ?? [],
      },
      description: {
        text: infoData?.secondary_info?.description?.text ?? "",
        formatted: (infoData?.secondary_info?.description?.text ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>"),
        run0: infoData?.secondary_info?.description?.runs?.[0]?.text ?? "",
        run1: infoData?.secondary_info?.description?.runs?.[1]?.text ?? "",
        run2: infoData?.secondary_info?.description?.runs?.[2]?.text ?? "",
        run3: infoData?.secondary_info?.description?.runs?.[3]?.text ?? "",
      },
      "Related-videos": relatedData,
    });
  } catch (e) {
    originalConsole.error("Critical error in /api/video2:", e);
    // システムレベルの致命的エラーのみ 500 を返す
    res.status(500).json({ error: "内部サーバーエラーが発生しました。" });
  }
});

app.use("/api/video2", router);

// Server Start
const server = app.listen(PORT, () => {
  originalConsole.log(`動画情報用APIサーバー起動: Port ${PORT}`);
  originalConsole.log(`💾 Image Cache Limit: ${MAX_CACHE_SIZE} items`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  originalConsole.log('SIGTERM受信: サーバーを停止します...');
  server.close(() => {
    originalConsole.log('サーバー停止完了');
    process.exit(0);
  });
});
