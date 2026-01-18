import express from "express";
import fetch from "node-fetch";
import https from "https"; // 追加: Agent管理用
import cors from "cors";

const app = express();
const port = 3011;
app.use(cors());

const YT_API = "https://www.youtube.com/youtubei/v1/browse?prettyPrint=false";

// メモリリーク対策: 通信エージェントを再利用する
// keepAliveを有効にしつつ、タイムアウトを設定してゾンビ接続を防ぐ
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 50, // 同時接続数を制限
  timeout: 30000, // タイムアウト
});

// ヘッダー
const headers = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "ja,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "sec-ch-ua":
    '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Chrome OS"',
  "sec-ch-ua-platform-version": '"16433.48.0"',
  "sec-ch-ua-arch": '"x86"',
  "sec-ch-ua-bitness": '"64"',
  "sec-ch-ua-full-version": '"142.0.7444.181"',
  "sec-ch-ua-full-version-list":
    '"Chromium";v="142.0.7444.181", "Google Chrome";v="142.0.7444.181", "Not_A Brand";v="99.0.0.0"',
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "x-youtube-client-name": "1",
  "x-youtube-client-version": "2.20251207.11.00",
  Origin: "https://www.youtube.com",
  Referer: "https://www.youtube.com/",
};

// テキスト抽出
function extractTitle(t) {
  if (!t) return null;
  if (t.simpleText) return t.simpleText;
  if (Array.isArray(t.runs)) return t.runs.map((r) => r.text).join("");
  if (t.text) return t.text;
  return null;
}

// 時間表記を「何秒前」という数値に変換する関数
function parsePublishedToSeconds(publishedStr, durationStr) {
  if (!publishedStr) {
    if (durationStr === "配信予定") return -1;
    return 0;
  }

  const cleanStr = publishedStr.replace(" に配信済み", "").trim();
  const regex = /(\d+)\s*(秒|分|時間|日|週間|か?月|年)前/;
  const match = cleanStr.match(regex);

  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2];
    let multiplier = 1;

    switch (unit) {
      case "秒":
        multiplier = 1;
        break;
      case "分":
        multiplier = 60;
        break;
      case "時間":
        multiplier = 3600;
        break;
      case "日":
        multiplier = 86400;
        break;
      case "週間":
        multiplier = 604800;
        break;
      case "か":
      case "か月":
      case "月":
        multiplier = 2592000;
        break;
      case "年":
        multiplier = 31536000;
        break;
    }
    return num * multiplier;
  }
  return 9999999999;
}

async function convertImageToBase64(url) {
  try {
    // agentを指定してfetch
    const res = await fetch(url, { agent: httpsAgent });

    if (!res.ok) {
      console.warn("[WARN] Thumbnail fetch failed:", url);
      // レスポンスボディを消費しないとメモリに残る可能性があるため、空読みするなどはfetchの実装依存だが
      // エラー時は早期リターン
      return null;
    }

    const buf = await res.arrayBuffer();
    const ext = url.endsWith(".jpg") ? "jpg" : "webp";
    // Buffer.from(buf) は新しいBufferを作成するが、GC対象になる
    return `data:image/${ext};base64,${Buffer.from(buf).toString("base64")}`;
  } catch (err) {
    console.error("[convertImageToBase64] Error:", err);
    return null;
  }
}

async function fetchThumbnailWithFallback(vid) {
  const webp = `https://i.ytimg.com/vi_webp/${vid}/default.webp`;
  const jpg = `https://i.ytimg.com/vi/${vid}/default.jpg`;

  const webpData = await convertImageToBase64(webp);
  if (webpData) return webpData;

  const jpgData = await convertImageToBase64(jpg);
  if (jpgData) return jpgData;

  console.warn("[WARN] Both webp and jpg thumbnail failed for:", vid);
  return null;
}

// ytInitialData 抽出（RD用） - vmを排除しJSON.parseに変更
async function extractInitialData(url) {
  try {
    const html = await fetch(url, { headers, agent: httpsAgent }).then((r) => r.text());
    const idx = html.indexOf("var ytInitialData =");
    if (idx === -1) throw new Error("ytInitialData not found");

    const start = html.indexOf("{", idx);
    // }; の直後までを取得するロジックは維持
    const end = html.indexOf("};", start) + 1; 
    
    // 文字列切り出し: { ... } の形になる
    const jsonStr = html.slice(start, end);

    // vmを使わずパースする
    try {
      return JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("[extractInitialData] JSON Parse Error. fallbacking to regex fix or empty.");
      throw parseErr;
    }
  } catch (err) {
    console.error("[extractInitialData] Error:", err);
    throw err;
  }
}

// token
function getTokenFromAppendAction(json) {
  try {
    const items =
      json?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction
        ?.continuationItems || [];
    for (const it of items) {
      const token =
        it?.continuationItemRenderer?.continuationEndpoint?.continuationCommand
          ?.token;
      if (token) return token;
    }
  } catch {}
  return "";
}

function getTokenFromVideoList(items) {
  if (!Array.isArray(items)) return "";
  for (const it of items) {
    const cmds =
      it?.continuationItemRenderer?.continuationEndpoint?.commandExecutorCommand
        ?.commands;
    if (!Array.isArray(cmds)) continue;
    for (const c of cmds) {
      const t = c?.continuationCommand?.token;
      if (t) return t;
    }
  }
  return "";
}

// RD プレイリスト
async function handleRDPlaylist(listId, videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}&list=${listId}`;
  const data = await extractInitialData(url);

  const playlist =
    data.contents?.twoColumnWatchNextResults?.playlist?.playlist || null;
  if (!playlist) throw new Error("RD playlist not found");

  const rawItems = playlist.contents || [];

  const items = (
    await Promise.all(
      rawItems.map(async (entry) => {
        const v = entry.playlistPanelVideoRenderer;
        if (!v) return null;

        const vid = v.videoId;
        const thumbnail = await fetchThumbnailWithFallback(vid);

        return {
          videoId: vid,
          title: extractTitle(v.title),
          duration: v.lengthText?.simpleText || null,
          author: extractTitle(v.longBylineText) || "YouTube",
          channelId: null,
          views: null,
          published: null,
          thumbnail,
        };
      })
    )
  ).filter(Boolean);

  const title = extractTitle(playlist.title) || "ミックスリスト";
  const descRaw =
    playlist.description?.simpleText ||
    (Array.isArray(playlist.description?.runs)
      ? playlist.description.runs.map((r) => r.text).join("")
      : null);

  return {
    playlistId: listId,
    title,
    author: "YouTube",
    description: descRaw || "Mixes are playlists automatically created by YouTube",
    totalItems: `${items.length} 本`,
    views: null,
    url,
    thumbnail: null,
    lastUpdated: null,
    items,
    nextToken: null,
  };
}

// 通常プレイリスト
async function handleNormalPlaylist(listId, token) {
  const body = {
    context: {
      client: {
        hl: "ja",
        gl: "JP",
        clientName: "WEB",
        clientVersion: "2.20251207.11.00",
        originalUrl: `https://www.youtube.com/playlist?list=${listId}`,
      },
    },
  };

  if (token) body.continuation = token;
  else body.browseId = "VL" + listId;

  // Agentを使用してfetch
  const response = await fetch(YT_API, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    agent: httpsAgent, 
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const json = await response.json();

  const meta = json?.metadata?.playlistMetadataRenderer || {};
  const sidebar = json?.sidebar?.playlistSidebarRenderer?.items || [];
  const primary = sidebar[0]?.playlistSidebarPrimaryInfoRenderer;
  const secondary = sidebar[1]?.playlistSidebarSecondaryInfoRenderer;

  const firstPageItems =
    json?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
      ?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer
      ?.contents?.[0]?.playlistVideoListRenderer?.contents || [];

  const extractVideo = async (arr) =>
    (
      await Promise.all(
        arr
          .map((v) => v.playlistVideoRenderer)
          .filter(Boolean)
          .map(async (v) => {
            const vid = v.videoId;
            const thumbnail = await fetchThumbnailWithFallback(vid);

            const title = v.title?.runs?.[0]?.text || "";
            const duration =
              v.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer
                ?.text?.simpleText || "";
            const views = v.videoInfo?.runs?.[0]?.text || "";
            let published = v.videoInfo?.runs?.[2]?.text || "";
            
            return {
              videoId: vid,
              title,
              duration,
              channelId:
                v.shortBylineText?.runs?.[0]?.navigationEndpoint
                  ?.browseEndpoint?.browseId || "",
              author: v.shortBylineText?.runs?.[0]?.text || "",
              views,
              published,
              thumbnail,
            };
          })
      )
    ).filter(Boolean);

  const firstVideos = await extractVideo(firstPageItems);

  const continuationItems =
    json?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction
      ?.continuationItems || [];

  const continuationVideos = await extractVideo(continuationItems);

  const items = [...firstVideos, ...continuationVideos];

  const nextToken =
    getTokenFromAppendAction(json) ||
    getTokenFromVideoList(firstPageItems) ||
    "";

  return {
    playlistId: listId,
    title: meta.title || "",
    author:
      secondary?.videoOwner?.videoOwnerRenderer?.title?.runs?.[0]?.text || "",
    description: meta.description || "",
    responseItems: `${items.length}`,
    totalItems: (primary?.stats?.[0]?.runs?.[0]?.text || "") + "本",
    url: `https://www.youtube.com/playlist?list=${listId}`,
    lastUpdated: primary?.stats?.[2]?.runs?.[1]?.text || "",
    views: primary?.stats?.[1]?.simpleText || "",
    items,
    nextToken,
  };
}

// ルート
app.get("/api/playlist/:id", async (req, res) => {
  let rawParams = req.params.id;
  
  // デフォルト値
  let token = req.query.token || null;
  let videoId = req.query.v || null;

  try {
    // パラメータ解析
    let decodedString = rawParams;
    try {
        const decoded = decodeURIComponent(rawParams);
        if (decoded !== rawParams) decodedString = decoded;
    } catch (e) {
        decodedString = rawParams;
    }

    let idString = decodedString;
    let paramStrings = [];

    if (decodedString.includes("==p==")) {
        const parts = decodedString.split("==p==");
        idString = parts[0];
        paramStrings = parts.slice(1);
    } else if (decodedString.includes("&")) {
        const parts = decodedString.split("&");
        idString = parts[0];
        paramStrings = parts.slice(1);
    }

    paramStrings.forEach(str => {
        let key, val;
        if (str.includes("==i==")) {
            [key, val] = str.split("==i==");
        } else if (str.includes("=")) {
            [key, val] = str.split("=");
        }

        if (key && val) {
            if (key === 'token') token = val;
            if (key === 'v') videoId = val;
        }
    });

    const idList = idString.split("====");

    // IDの変換処理
    const targetIds = idList.map((id) => {
      id = id.trim();
      if (id.startsWith("UC")) {
        return "UU" + id.slice(2);
      }
      return id;
    });

    if (targetIds[0].startsWith("RD")) {
      if (!videoId)
        throw new Error("RD プレイリストには v パラメータが必要です");
      const json = await handleRDPlaylist(targetIds[0], videoId);
      return res.json(json);
    }

    // 並列取得
    const results = await Promise.all(
      targetIds.map((listId) => handleNormalPlaylist(listId, token))
    );

    let allItems = results.flatMap((res) => res.items);

    const itemsWithSortKey = allItems.map((item) => {
      const secondsAgo = parsePublishedToSeconds(item.published, item.duration);
      return {
        ...item,
        _sortSeconds: secondsAgo,
      };
    });

    itemsWithSortKey.sort((a, b) => a._sortSeconds - b._sortSeconds);

    const finalItems = itemsWithSortKey.map((item) => {
      const { _sortSeconds, ...originalItem } = item;
      return originalItem;
    });

    const mergedTitle = targetIds.length > 1 ? "" : (results[0]?.title || "");

    const mergedResponse = {
      playlistId: targetIds.join(","),
      title: mergedTitle,
      author: "Multiple Channels",
      description: "Merged Playlist",
      responseItems: `${finalItems.length}`,
      totalItems: `${finalItems.length} 本`,
      url: "",
      lastUpdated: new Date().toISOString(),
      views: null,
      items: finalItems,
      nextToken: null,
    };

    return res.json(mergedResponse);
  } catch (err) {
    console.error("[/playlist] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});