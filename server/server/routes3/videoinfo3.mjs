import express from "express";
import { Innertube } from "youtubei.js";
import fetch from "node-fetch";

// ===================================================
// ログ 10秒後停止
// ===================================================
let logEnabled = true;
const originalConsole = { ...console };

setTimeout(() => {
  logEnabled = false;
  originalConsole.log("⛔ ログ停止（10秒経過）");
}, 10000);

for (const key of Object.keys(originalConsole)) {
  console[key] = (...args) => {
    if (logEnabled) originalConsole[key](...args);
  };
}

// ===================================================
// CORS
// ===================================================
const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// ===================================================
// Router
// ===================================================
const router = express.Router();
let youtube = null;

// ===================================================
// YouTube 初期化
// ===================================================
(async () => {
  try {
    youtube = await Innertube.create({ lang: "ja", location: "JP", retrieve_player: true });
    console.log("✅ YouTubeクライアント初期化完了");
  } catch (e) {
    console.error("❌ YouTube 初期化失敗:", e);
  }
})();

// ===================================================
// サムネイル キャッシュ（12時間）
// ===================================================
const thumbCache = new Map();
const THUMB_CACHE_TTL = 43200 * 1000; // 12h

/**
 * YouTubeサムネイルをWebPでBase64化（リサイズなし）
 * - videoId: YouTube動画ID
 */
async function getThumbnailBase64(videoId) {
  const key = `${videoId}_raw`;
  const now = Date.now();

  // ---- キャッシュ HIT ----
  const cached = thumbCache.get(key);
  if (cached && cached.expireAt > now) return cached.base64;

  const url = `https://i.ytimg.com/vi_webp/${videoId}/default.webp`;

  try {
    const res = await fetch(url);
    if (!res.ok) return "";

    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = `data:image/webp;base64,${buffer.toString("base64")}`;

    thumbCache.set(key, { base64, expireAt: now + THUMB_CACHE_TTL });
    return base64;
  } catch (e) {
    console.error("Thumbnail WebP error:", e);
    return "";
  }
}

// ===================================================
// /api/video2/:id
// ===================================================
router.get("/:id", async (req, res) => {
  const videoId = req.params.id;

  if (!videoId)
    return res.status(400).json({ error: "無効な動画IDです。" });
  if (!youtube)
    return res.status(503).json({ error: "YouTubeクライアント未初期化です。" });

  // 1時間ブラウザキャッシュ
  res.setHeader("Cache-Control", "public, max-age=3600");

  try {
    const info = await youtube.getInfo(videoId);

    // ===== メインサムネ =====
    const mainThumb = await getThumbnailBase64(videoId);

    // ===== コラボ検出 =====
    const collabHeader =
      info.secondary_info?.owner?.author?.endpoint?.payload
        ?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.header
        ?.dialogHeaderViewModel?.headline?.content || "";

    const isCollaborator = collabHeader !== "";

    const collabItems =
      info.secondary_info?.owner?.author?.endpoint?.payload
        ?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent
        ?.listViewModel?.listItems || [];

    const collaborators = collabItems.map((item) => {
      const vm = item?.listItemViewModel || {};
      return {
        name: vm?.title?.content || "",
        subtitle: vm?.subtitle?.content || "",
        channelId:
          vm?.title?.commandRuns?.[0]?.onTap?.innertubeCommand?.browseEndpoint
            ?.browseId || "",
        thumbnail:
          vm?.leadingAccessory?.avatarViewModel?.image?.sources?.[0]?.url || "",
      };
    });

    // ===== 関連動画 =====
    const related = await Promise.all(
      (info.watch_next_feed || []).map(async (item) => {
        const id =
          item?.renderer_context?.command_context?.on_tap?.payload?.videoId ||
          "";

        return {
          badge: item?.content_image?.overlays?.[0]?.badges?.[0]?.text || "",
          title: item?.metadata?.title?.text || "",
          channel:
            item?.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]
              ?.text?.text || "",
          views:
            item?.metadata?.metadata?.metadata_rows?.[1]?.metadata_parts?.[0]
              ?.text?.text || "",
          uploaded:
            item?.metadata?.metadata?.metadata_rows?.[1]?.metadata_parts?.[1]
              ?.text?.text || "",
          videoId: id,
          playlistId:
            item?.renderer_context?.command_context?.on_tap?.payload
              ?.playlistId || "",
          thumbnail: id ? await getThumbnailBase64(id) : "",
        };
      })
    );

    // ===== description =====
    const rawDesc = info.secondary_info?.description?.text || "";
    const runs = info.secondary_info?.description?.runs || [];
    const description = {
      text: rawDesc,
      formatted: rawDesc
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>"),
      run0: runs[0]?.text || "",
      run1: runs[1]?.text || "",
      run2: runs[2]?.text || "",
      run3: runs[3]?.text || "",
    };

    // ===== 作者 =====
    const authorId =
      info.basic_info?.channel_id ||
      info.basic_info?.channel?.id ||
      info.secondary_info?.owner?.author?.id ||
      "";

    const authorName =
      info.basic_info?.author ||
      info.basic_info?.channel?.name ||
      info.secondary_info?.owner?.author?.name ||
      "";

    const authorSubs =
      info.secondary_info?.owner?.subscriber_count?.text ||
      info.secondary_info?.owner?.author?.endpoint?.payload
        ?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent
        ?.listViewModel?.listItems?.[0]?.listItemViewModel?.subtitle?.content ||
      "";

    const authorThumb =
      info.endscreen?.elements?.[0]?.image?.[0]?.url ||
      info.secondary_info?.owner?.author?.thumbnails?.[0]?.url ||
      "";

    const likes =
      info.primary_info?.menu?.top_level_buttons?.[0]?.short_like_count ||
      info.basic_info?.menu?.top_level_buttons?.[0]?.short_like_count ||
      "";

    const views =
      info.primary_info?.view_count?.short_view_count?.text ||
      info.primary_info?.view_count?.view_count?.text ||
      info.basic_info?.view_count ||
      "";

    const relativeDate = info.primary_info?.relative_date?.text || "";

    // ===== レスポンス =====
    res.json({
      id: videoId,
      title: info.basic_info?.title || "",
      views,
      relativeDate,
      likes,
      thumbnail: mainThumb,
      author: {
        id: authorId,
        name: authorName,
        subscribers: authorSubs,
        thumbnail: authorThumb,
        collaborator: isCollaborator,
        collaborators,
      },
      description,
      related,
    });
  } catch (e) {
    console.error(`video2 error (${videoId}):`, e);
    res.status(500).json({ error: "動画情報の取得に失敗しました。" });
  }
});

// ===================================================
// 起動
// ===================================================
const PORT = 3010;
app.use("/api/video2", router);

app.listen(PORT, () => {
  console.log(`動画情報取得(WebP版・リサイズ無し) がポート ${PORT} で起動しました`);
});