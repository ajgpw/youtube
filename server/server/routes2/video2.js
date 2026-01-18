import express from "express";
import { Innertube } from "youtubei.js";
import fetch from "node-fetch";
import fs from 'fs';
import path from 'path';

const router = express.Router();
let youtube;

// YouTubeクライアント初期化
(async () => {
  // ログ抑制
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  const originalTrace = console.trace;

  const filterYoutubeJsLogs = (...args) => {
    try {
      const mode = fs.readFileSync(path.join(process.cwd(), 'log.txt'), 'utf8').trim();
      if (mode === 'ON') {
        return false;
      }
    } catch (e) {}

    for (const a of args) {
      if (typeof a === 'string' && a.includes('[YOUTUBEJS]')) return true;
      if (typeof a === 'string' && (a.includes('Unable to find matching run') || a.includes('ParsingError'))) return true;
      if (typeof a === 'object' && a !== null) {
        if (a.info && a.version && a.date) return true;
        if (a.attachment_run && a.input_data) return true;
      }
    }
    const message = args.join(' ');
    return message.includes('[YOUTUBEJS]') || message.includes('Unable to find matching run') || message.includes('ParsingError');
  };

  console.warn = (...args) => { if (!filterYoutubeJsLogs(...args)) originalWarn(...args); };
  console.error = (...args) => { if (!filterYoutubeJsLogs(...args)) originalError(...args); };
  console.log = (...args) => { if (!filterYoutubeJsLogs(...args)) originalLog(...args); };
  console.info = (...args) => { if (!filterYoutubeJsLogs(...args)) originalInfo(...args); };
  console.debug = (...args) => { if (!filterYoutubeJsLogs(...args)) originalDebug(...args); };
  console.trace = (...args) => { if (!filterYoutubeJsLogs(...args)) originalTrace(...args); };

  youtube = await Innertube.create({ lang: "ja", location: "JP", retrieve_player: true });
  
  console.warn = originalWarn;
  console.error = originalError;
  console.log = originalLog;
  console.info = originalInfo;
  console.debug = originalDebug;
  console.trace = originalTrace;
})();

// 関連動画のサムネイル base64 取得
async function getThumbnailBase64(videoId) {
  const imgUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  const res = await fetch(imgUrl);
  if (!res.ok) return "";
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.toString("base64");
}

router.get("/:id", async (req, res) => {
  const videoId = req.params.id;
  if (!videoId) return res.status(400).json({ error: "無効な動画IDです。" });

  try {
    if (!youtube) return res.status(503).json({ error: "YouTubeクライアント未初期化です。" });

    const info = await youtube.getInfo(videoId);

    // 関連動画
    const related = await Promise.all(
      (info.watch_next_feed || []).map(async (item) => {
        const id = item?.renderer_context?.command_context?.on_tap?.payload?.videoId || "";
        const thumbnailBase64 = id ? await getThumbnailBase64(id) : "";
        return {
          badge: item?.content_image?.overlays?.[0]?.badges?.[0]?.text || "",
          title: item?.metadata?.title?.text || "",
          channel: item?.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text?.text || "",
          views: item?.metadata?.metadata?.metadata_rows?.[1]?.metadata_parts?.[0]?.text?.text || "",
          uploaded: item?.metadata?.metadata?.metadata_rows?.[1]?.metadata_parts?.[1]?.text?.text || "",
          videoId: id,
          playlistId: item?.renderer_context?.command_context?.on_tap?.payload?.playlistId || "",
          thumbnail: thumbnailBase64
        };
      })
    );

    // ★ コラボ確定演出！！！！★きゅぃぃん！
    const collabHeader =
      info.secondary_info?.owner?.author?.endpoint?.payload
        ?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.header
        ?.dialogHeaderViewModel?.headline?.content || "";

    const collabItems =
      info.secondary_info?.owner?.author?.endpoint?.payload
        ?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent
        ?.listViewModel?.listItems || [];

    const collaborators = collabItems.map(item => {
      const vm = item?.listItemViewModel || {};
      return {
        name: vm?.title?.content || "",
        subtitle: vm?.subtitle?.content || "",
        channelId:
          vm?.title?.commandRuns?.[0]?.onTap?.innertubeCommand?.browseEndpoint
            ?.browseId || "",
        thumbnail:
          vm?.leadingAccessory?.avatarViewModel?.image?.sources?.[0]?.url || ""
      };
    });

    // 説明文
    const rawDescription = info.secondary_info?.description?.text || "";
    const descriptionRuns = info.secondary_info?.description?.runs || [];

    // メイン動画情報
    const result = {
      id: videoId,
      title: info.basic_info?.title || "",
      views:
        info.primary_info?.view_count?.short_view_count?.text ||
        info.primary_info?.view_count?.view_count?.text ||
        info.basic_info?.view_count ||
        "",
      relativeDate: info.primary_info?.relative_date?.text || "",
      likes:
        info.primary_info?.menu?.top_level_buttons?.[0]?.short_like_count ||
        info.basic_info?.menu?.top_level_buttons?.[0]?.short_like_count ||
        info.basic_info?.like_count ||
        "",

      // ★★★ author 情報（コラボ完全対応版）
      author: {
        id:
          info.basic_info?.channel_id ||
          info.basic_info?.channel?.id ||
          info.secondary_info?.owner?.author?.id ||
          "",
        name:
          info.basic_info?.author ||
          info.basic_info?.channel?.name ||
          info.secondary_info?.owner?.author?.name ||
          "",
        subscribers:
          info.secondary_info?.owner?.subscriber_count?.text ||
          info.secondary_info?.owner?.author?.endpoint?.payload
            ?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent
            ?.listViewModel?.listItems?.[0]?.listItemViewModel?.subtitle
            ?.content ||
          info.secondary_info?.owner?.author?.endpoint?.command?.inline_content
            ?.custom_content?.items?.[0]?.subtitle?.text ||
          info.secondary_info?.owner?.author?.endpoint?.command?.inline_content
            ?.custom_content?.items?.[0]?.renderer_context?.accessibility_context
            ?.label ||
          info.secondary_info?.subscribe_button?.on_subscribe_endpoints?.[0]
            ?.payload?.panelLoadingStrategy?.inlineContent?.dialogViewModel
            ?.customContent?.listViewModel?.listItems?.[0]?.listItemViewModel
            ?.subtitle?.content ||
          info.command?.inline_content?.custom_content?.items?.[0]?.subtitle
            ?.text ||
          "",

        thumbnail:
          info.endscreen?.elements?.[0]?.image?.[0]?.url ||
          info.secondary_info?.owner?.author?.thumbnails?.[0]?.url ||
          info.annotations?.[0]?.featured_channel?.watermark?.[0]?.url ||
          "",

        // ★ コラボ判定
        collaborator: collabHeader !== "",

        // ★ コラボ出演者（複数）
        collaborators
      },

      description: {
        text: rawDescription,
        formatted: rawDescription
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>"),
        run0: descriptionRuns[0]?.text || "",
        run1: descriptionRuns[1]?.text || "",
        run2: descriptionRuns[2]?.text || "",
        run3: descriptionRuns[3]?.text || ""
      },

      related
    };

    res.json(result);

  } catch (err) {
    console.error(`[ERROR][${videoId}]`, err);
    res.status(500).json({ error: "動画情報の取得に失敗しました。" });
  }
});

export default router;