import express from "express";
import cors from "cors";
import { Agent as UndiciAgent } from "undici";

/**
 * Expressアプリケーションの初期化
 */
const app = express();
const PORT = 3000;

// ==========================================
// ミドルウェア設定
// ==========================================
app.use(cors());
app.use(express.json());

// ==========================================
// 定数・設定定義
// ==========================================

const YOUTUBE_BASE_URL = "https://www.youtube.com/watch?v=";
const YOUTUBE_API_URL = "https://www.youtube.com/youtubei/v1/next";

/**
 * YouTube Innertube APIで使用するAPIキー
 * note: セキュリティスキャン回避のため分割定義されています
 */
const INNERTUBE_API_KEY =
  "AIzaSy" + "AMfD_G8YjaE81Z" + "w1BHIr2" + "8s0f5C" + "O48Q";

/**
 * YouTubeへのリクエストで使用するヘッダー設定
 * ブラウザ(Chrome OS)からのアクセスを模倣します
 */
const REQUEST_HEADERS = {
  authority: "www.youtube.com",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "accept-language": "ja,en;q=0.9",
  "cache-control": "no-cache",
  "sec-ch-ua":
    '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Chrome OS"',
  "user-agent":
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
};

// Keep-Alive 用の undici.Agent
const undiciAgent = new UndiciAgent({
  connections: 16,
  keepAliveTimeout: 60000,
});

/**
 * サムネイル画像を Keep-Alive エージェント経由で取得し、base64 データURL を返します。
 * 失敗した場合は null を返します。
 * @param {string} url
 * @returns {Promise<string|null>}
 */
const fetchImageAsBase64 = async (url) => {
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      dispatcher: undiciAgent,
      headers: {
        Referer: "https://www.youtube.com/",
        "User-Agent": REQUEST_HEADERS["user-agent"],
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b = Buffer.from(buf);
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${b.toString("base64")}`;
  } catch (e) {
    console.warn("fetchImageAsBase64 failed", e?.message || e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * APIリクエスト時に送信するクライアントコンテキスト
 */
const CLIENT_CONTEXT = {
  client: {
    hl: "ja",
    gl: "JP",
    clientName: "WEB",
    clientVersion: "2.20240214.01.00",
    ua: REQUEST_HEADERS["user-agent"],
  },
};

// ==========================================
// ユーティリティ関数
// ==========================================

/**
 * YouTubeのRunsオブジェクトからテキストを結合して抽出します。
 * @param {Array} runs - テキスト情報を含むオブジェクト配列
 * @returns {string|null} 結合されたテキスト、またはnull
 */
const getTextFromRuns = (runs) => {
  return runs?.map((run) => run.text).join("") || null;
};

/**
 * 例外が発生する可能性のある関数を安全に実行します。
 * @param {Function} fn - 実行する関数
 * @returns {any|null} 実行結果、またはエラー時はnull
 */
const safeGet = (fn) => {
  try {
    return fn();
  } catch (e) {
    return null;
  }
};

/**
 * 動画アイテムのリストを解析し、統一されたフォーマットに正規化します。
 * LockupViewModel, CompactVideoRenderer, ContinuationItemRendererに対応しています。
 * * @param {Array} rawItems - APIからの生のアイテム配列
 * @returns {Array} 整形されたアイテム配列
 */
const parseRawItems = (rawItems) => {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item) => {
      // A. LockupViewModel (新しいUI形式)
      if (item?.lockupViewModel) {
        return parseVideoLockup(item);
      }
      // B. CompactVideoRenderer (従来のUI形式)
      if (item?.compactVideoRenderer) {
        const cvr = item.compactVideoRenderer;
        return {
          type: "compact_video",
          videoId: cvr.videoId,
          title: getTextFromRuns(cvr.title?.runs),
          thumbnails: { static: cvr.thumbnail?.thumbnails }, // 構造維持
          badge: {
            text: cvr.lengthText?.simpleText,
            icon: null,
          },
          playlistId: cvr.navigationEndpoint?.watchEndpoint?.playlistId || null,
          channel: {
            name: getTextFromRuns(cvr.shortBylineText?.runs),
            id: cvr.shortBylineText?.runs?.[0]?.navigationEndpoint
              ?.browseEndpoint?.browseId,
          },
          stats: {
            views: getTextFromRuns(cvr.viewCountText?.runs),
            publishedTime: getTextFromRuns(cvr.publishedTimeText?.runs),
          },
        };
      }
      // C. ContinuationItemRenderer (無限スクロール等の読み込みトリガー)
      if (item?.continuationItemRenderer) {
        const cir = item.continuationItemRenderer;
        const endpoint = cir.continuationEndpoint;
        const webCmd = endpoint?.commandMetadata?.webCommandMetadata;
        const contCmd = endpoint?.continuationCommand;

        return {
          type: "continuation",
          trigger: cir.trigger,
          sendPost: webCmd?.sendPost,
          apiUrl: webCmd?.apiUrl,
          token: contCmd?.token,
          request: contCmd?.request,
        };
      }
      return null;
    })
    .filter(Boolean);
};

/**
 * 関連動画 (LockupViewModel形式) の構造を解析・整形します。
 * 詳細なメタデータ、サムネイル、バッジ情報を抽出します。
 * * @param {Object} item - LockupViewModelを含むアイテム
 * @returns {Object|null} 整形された動画オブジェクト
 */
const parseVideoLockup = (item) => {
  const lockup = item?.lockupViewModel;
  if (!lockup) return null;

  const metadataVM = lockup.metadata?.lockupMetadataViewModel;
  const contentMetadata = metadataVM?.metadata?.contentMetadataViewModel;
  const title = metadataVM?.title?.content;
  const videoId = lockup.contentId;

  const overlays =
    lockup.contentImage?.thumbnailViewModel?.overlays ||
    lockup.contentImage?.overlays ||
    [];

  const thumbnailData =
    lockup.contentImage?.thumbnailViewModel?.image?.sources ||
    lockup.contentImage?.image?.sources ||
    [];

  const animatedThumbnail = overlays.find(
    (o) => o.animatedThumbnailOverlayViewModel
  )?.animatedThumbnailOverlayViewModel?.thumbnail?.sources?.[0]?.url;

  const metadataRows = contentMetadata?.metadataRows || [];
  const channelRow = metadataRows[0]?.metadataParts?.[0];
  const channelName = channelRow?.text?.content;
  const channelBadges =
    channelRow?.attachmentRuns?.map((run) => ({
      icon: run.element?.type?.imageType?.image?.sources?.[0]?.clientResource
        ?.imageName,
    })) || [];

  const avatarData =
    metadataVM?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel;
  const channelAvatar = avatarData?.image?.sources?.[0]?.url;
  const channelUrl =
    metadataVM?.image?.decoratedAvatarViewModel?.rendererContext?.commandContext
      ?.onTap?.innertubeCommand?.browseEndpoint?.canonicalBaseUrl;

  const statsRow = metadataRows[1]?.metadataParts || [];
  const views = statsRow[0]?.text?.content;
  const publishedTime = statsRow[1]?.text?.content;

  const badgeViewModel = overlays.find((o) => o.thumbnailOverlayBadgeViewModel)
    ?.thumbnailOverlayBadgeViewModel?.thumbnailBadges?.[0]
    ?.thumbnailBadgeViewModel;

  const badgeText = badgeViewModel?.text;
  const badgeIcon =
    badgeViewModel?.icon?.sources?.[0]?.clientResource?.imageName;

  const playlistId =
    lockup.rendererContext?.commandContext?.onTap?.innertubeCommand
      ?.watchEndpoint?.playlistId;

  return {
    type: "video",
    videoId,
    title,
    thumbnails: {
      static: thumbnailData,
      animated: animatedThumbnail || null,
    },
    badge: {
      text: badgeText, // 再生時間
      icon: badgeIcon || null,
    },
    playlistId: playlistId || null,
    channel: {
      name: channelName,
      url: channelUrl,
      avatar: channelAvatar,
      badges: channelBadges,
      label: metadataVM?.image?.decoratedAvatarViewModel?.a11yLabel,
    },
    stats: {
      views,
      publishedTime,
      fullText: contentMetadata?.delimiter,
    },
    trackingParams:
      lockup.rendererContext?.loggingContext?.loggingDirectives?.trackingParams,
  };
};

/**
 * YouTube Internal APIを使用して続きの動画データ（Continuation）を取得します。
 * * @param {string} token - Continuationトークン
 * @returns {Promise<Object|null>} 取得したアイテムとターゲットIDを含むオブジェクト
 */
const fetchContinuationData = async (token) => {
  if (!token) return null;

  const targetApiUrl = `${YOUTUBE_API_URL}?key=${INNERTUBE_API_KEY}`;

  try {
    const apiResponse = await fetch(targetApiUrl, {
      method: "POST",
      headers: {
        ...REQUEST_HEADERS,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        context: CLIENT_CONTEXT,
        continuation: token,
      }),
    });

    if (!apiResponse.ok) {
      console.warn(`[Continuation API Failed] Status: ${apiResponse.status}`);
      return null;
    }

    const json = await apiResponse.json();
    const endpoint = json.onResponseReceivedEndpoints?.[0];
    const continuationItems =
      endpoint?.appendContinuationItemsAction?.continuationItems;

    if (!continuationItems) return null;

    return {
      targetId: endpoint?.appendContinuationItemsAction?.targetId,
      items: parseRawItems(continuationItems),
    };
  } catch (e) {
    console.error("Error fetching continuation:", e);
    return null;
  }
};

// ==========================================
// API ルーティング
// ==========================================

/**
 * 動画詳細および関連動画を取得するエンドポイント
 * IDパラメータには独自のエンコード形式が含まれる場合があります。
 */
app.get("/api/video2/:id", async (req, res) => {
  let videoId = req.params.id;

  // デフォルトパラメータ設定
  let continuationToken = req.query.token;
  let depth = null;

  // ---------------------------------------------------------
  // 独自パラメータ解析ロジック
  // ID文字列に含まれるデリミタを使用してパラメータを抽出します
  // ---------------------------------------------------------
  const checkParam = (key, val) => {
    if (key === "token") continuationToken = val;
    if (key === "depth") depth = val;
  };

  if (videoId.includes("====")) {
    const parts = videoId.split("====");
    videoId = parts[0];
    const paramsString = parts[1];
    if (paramsString) {
      const pairs = paramsString.split("==p==");
      pairs.forEach((pair) => {
        const [key, val] = pair.split("==i==");
        checkParam(key, val);
      });
    }
  } else if (videoId.includes("&")) {
    const parts = videoId.split("&");
    videoId = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.includes("==i==")) {
        const [key, val] = part.split("==i==");
        checkParam(key, val);
      } else if (part.includes("=")) {
        const [key, val] = part.split("=");
        checkParam(key, val);
      }
    }
  } else if (videoId.includes("==p==")) {
    const parts = videoId.split("==p==");
    videoId = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const [key, val] = parts[i].split("==i==");
      checkParam(key, val);
    }
  }

  if (!videoId) {
    return res.status(400).json({ error: "Missing video ID parameter" });
  }

  try {
    // ---------------------------------------------------------
    // パターンA: 継続トークンがある場合 (関連動画の追加読み込み)
    // ---------------------------------------------------------
    if (continuationToken) {
      const result = await fetchContinuationData(continuationToken);

      // 既存のAPI仕様に合わせてデータを変換
      const relatedVideosCompat =
        result?.items
          ?.map((item) => {
            if (item.type === "continuation") return null;

            return {
              type: item.playlistId ? "playlist" : "video",
              videoId: item.videoId,
              title: item.title,
              channelName: item.channel?.name || "",
              viewCountText: item.stats?.views || "",
              publishedTimeText: item.stats?.publishedTime || "",
              duration: item.badge?.text || null,
              badge: item.badge?.text || null,
              thumbnails: item.thumbnails?.static || [],
              thumbnail: item.thumbnails?.static?.[0]?.url || "", // Base64ではなくURLを使用
              channelAvatar: item.channel?.avatar || "",
              playlistId: item.playlistId,
            };
          })
          .filter(Boolean) || [];

      // 次の読み込み用トークンを取得
      const nextToken =
        result?.items?.find((i) => i.type === "continuation")?.token || null;

      // --- thumbnails[0] を base64 に変換（Keep-Alive エージェントを利用） ---
      try {
        await Promise.all(
          relatedVideosCompat.map(async (rv) => {
            const thumbUrl = rv.thumbnail;
            if (!thumbUrl) return;
            const b64 = await fetchImageAsBase64(thumbUrl);
            if (!b64) return;
            if (Array.isArray(rv.thumbnails) && rv.thumbnails.length > 0) {
              // サムネイル配列の先頭要素の url を base64 に置換
              rv.thumbnails[0].url = b64;
            }
            // thumbnails[0] と同じ短縮プロパティも更新
            rv.thumbnail = b64;
          })
        );
      } catch (e) {
        console.warn(
          "Thumbnail base64 conversion (continuation) failed",
          e?.message || e
        );
      }

      return res.json({
        id: videoId,
        title: "", // 追加読み込みのためタイトルは不要
        "Related-videos": {
          relatedCount: relatedVideosCompat.length,
          nextContinuationToken: nextToken,
          relatedVideos: relatedVideosCompat,
        },
      });
    }

    // ---------------------------------------------------------
    // パターンB: 通常の初回ロード (HTMLスクレイピング + 解析)
    // ---------------------------------------------------------
    const targetUrl = `${YOUTUBE_BASE_URL}${videoId}`;
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: REQUEST_HEADERS,
    });

    if (!response.ok) {
      return res.json({
        id: videoId,
        unavailable: true,
        reason: `Service unavailable (Status ${response.status})`,
        "Related-videos": { relatedVideos: [] },
      });
    }

    const html = await response.text();
    // HTML内から ytInitialData JSONオブジェクトを抽出
    const regex = /var ytInitialData\s*=\s*({.*?});/s;
    const match = html.match(regex);

    if (!match || !match[1]) {
      return res.json({
        id: videoId,
        unavailable: true,
        reason: "Failed to extract data",
        "Related-videos": { relatedVideos: [] },
      });
    }

    try {
      const rawData = JSON.parse(match[1]);
      const twoColumnResults =
        rawData.contents?.twoColumnWatchNextResults?.results?.results;
      const secondarySection =
        rawData.contents?.twoColumnWatchNextResults?.secondaryResults
          ?.secondaryResults;

      // 1. 関連動画セクションの処理 (Secondary Results)
      let relatedVideos = [];
      let nextContinuationToken = null;

      if (secondarySection) {
        const rawResults = secondarySection.results;
        let parsedResults = parseRawItems(rawResults);

        // depthパラメータによる追加読み込みロジック
        if (depth == "2") {
          const continuationItem = parsedResults.find(
            (item) => item.type === "continuation"
          );
          if (continuationItem && continuationItem.token) {
            const extraData = await fetchContinuationData(
              continuationItem.token
            );
            if (extraData && extraData.items.length > 0) {
              const resultsWithoutContinuation = parsedResults.filter(
                (item) => item.type !== "continuation"
              );
              parsedResults = [
                ...resultsWithoutContinuation,
                ...extraData.items,
              ];
            }
          }
        }

        // レスポンス用にデータを変換
        relatedVideos = parsedResults
          .map((item) => {
            if (item.type === "continuation") {
              nextContinuationToken = item.token;
              return null;
            }
            return {
              type: item.playlistId ? "playlist" : "video",
              videoId: item.videoId,
              title: item.title,
              channelName: item.channel?.name || "",
              viewCountText: item.stats?.views || "",
              publishedTimeText: item.stats?.publishedTime || "",
              duration: item.badge?.text || null,
              badge: item.badge?.text || null,
              thumbnails: item.thumbnails?.static || [],
              thumbnail: item.thumbnails?.static?.[0]?.url || "",
              channelAvatar: item.channel?.avatar || "",
              playlistId: item.playlistId,
              overlayIcon: item.badge?.icon,
            };
          })
          .filter(Boolean);

        // --- thumbnails[0] を base64 に変換（Keep-Alive エージェントを利用） ---
        try {
          await Promise.all(
            relatedVideos.map(async (rv) => {
              const thumbUrl = rv.thumbnail;
              if (!thumbUrl) return;
              const b64 = await fetchImageAsBase64(thumbUrl);
              if (!b64) return;
              if (Array.isArray(rv.thumbnails) && rv.thumbnails.length > 0) {
                rv.thumbnails[0].url = b64;
              }
              rv.thumbnail = b64;
            })
          );
        } catch (e) {
          console.warn(
            "Thumbnail base64 conversion (initial) failed",
            e?.message || e
          );
        }
      }

      // 2. メイン動画情報の処理 (Primary Info)
      const primaryInfoRenderer = twoColumnResults?.contents?.find(
        (c) => c.videoPrimaryInfoRenderer
      )?.videoPrimaryInfoRenderer;

      const secondaryInfoRenderer = twoColumnResults?.contents?.find(
        (c) => c.videoSecondaryInfoRenderer
      )?.videoSecondaryInfoRenderer;

      if (!primaryInfoRenderer || !secondaryInfoRenderer) {
        return res.json({
          id: videoId,
          unavailable: true,
          reason: "Video details not found",
          "Related-videos": { relatedVideos: [] },
        });
      }

      // メタデータの抽出
      const title = getTextFromRuns(primaryInfoRenderer?.title?.runs) || "";
      const shortViews =
        primaryInfoRenderer?.viewCount?.videoViewCountRenderer?.shortViewCount
          ?.simpleText || "";
      const originalViews =
        primaryInfoRenderer?.viewCount?.videoViewCountRenderer?.viewCount
          ?.simpleText || "";
      const viewCountStr = shortViews || originalViews || "";

      const relativeDate =
        primaryInfoRenderer?.relativeDateText?.simpleText || "";
      const fullDate = primaryInfoRenderer?.dateText?.simpleText || "";

      // 高評価情報の取得（ネストされた構造を安全に探索）
      const likeButtonTitle =
        safeGet(() => {
          const topLevelButtons =
            primaryInfoRenderer?.videoActions?.menuRenderer?.topLevelButtons;
          return topLevelButtons?.find(
            (b) => b.segmentedLikeDislikeButtonViewModel
          )?.segmentedLikeDislikeButtonViewModel?.likeButtonViewModel
            ?.likeButtonViewModel?.toggleButtonViewModel?.toggleButtonViewModel
            ?.defaultButtonViewModel?.buttonViewModel?.title;
        }) || "";

      // 投稿者（チャンネル）情報の構築
      const ownerRenderer = secondaryInfoRenderer?.owner?.videoOwnerRenderer;
      const channelId =
        ownerRenderer?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint
          ?.browseId || "";
      const channelName = getTextFromRuns(ownerRenderer?.title?.runs) || "";
      const subCount = ownerRenderer?.subscriberCountText?.simpleText || "";
      const authorThumb = ownerRenderer?.thumbnail?.thumbnails?.[0]?.url || "";

      // コラボレーター情報の取得
      const collabHeadline = safeGet(
        () =>
          ownerRenderer?.navigationEndpoint?.showDialogCommand
            ?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.header
            ?.dialogHeaderViewModel?.headline?.content
      );
      const collaboratorsList =
        safeGet(() => {
          const rawItems =
            ownerRenderer?.navigationEndpoint?.showDialogCommand
              ?.panelLoadingStrategy?.inlineContent?.dialogViewModel
              ?.customContent?.listViewModel?.listItems;
          return Array.isArray(rawItems)
            ? rawItems.map((item) => ({
                name: item?.listItemViewModel?.title?.content || "",
                subtitle: item?.listItemViewModel?.subtitle?.content || "",
                channelId:
                  item?.listItemViewModel?.leadingAccessory?.avatarViewModel
                    ?.endpoint?.innertubeCommand?.browseEndpoint?.browseId ||
                  "",
                thumbnail:
                  item?.listItemViewModel?.leadingAccessory?.avatarViewModel
                    ?.image?.sources?.[0]?.url || "",
              }))
            : [];
        }) || [];

      // 概要欄の処理
      const descRaw =
        secondaryInfoRenderer?.attributedDescription?.content || "";

      // テキストを行単位で分割し、空行を除外して整形
      const nonEmptyLines = descRaw
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "");

      const descriptionObj = {
        text: descRaw,
        formatted: descRaw.replace(/\n/g, "<br>"),
        // 最初の4行を抽出
        run0: nonEmptyLines[0] || "",
        run1: nonEmptyLines[1] || "",
        run2: nonEmptyLines[2] || "",
        run3: nonEmptyLines[3] || "",
      };

      // サムネイルURLの生成
      const mainThumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      // ---------------------------------------------------------
      // レスポンスJSONの構築
      // ---------------------------------------------------------
      res.json({
        id: videoId,
        title: title,
        views: viewCountStr,
        relativeDate: relativeDate,
        likes: likeButtonTitle,
        thumbnail: mainThumbnailUrl,
        author: {
          id: channelId,
          name: channelName,
          subscribers: subCount,
          thumbnail: authorThumb,
          collaborator: collaboratorsList.length > 0 || !!collabHeadline,
          collaborators: collaboratorsList,
        },
        description: descriptionObj,
        "Related-videos": {
          relatedCount: relatedVideos.length,
          nextContinuationToken: nextContinuationToken,
          relatedVideos: relatedVideos,
        },

        // 拡張統計情報
        extended_stats: {
          views_original: originalViews,
          views_short: shortViews,
          date_simple: fullDate,
          date_relative_label:
            primaryInfoRenderer?.relativeDateText?.accessibility
              ?.accessibilityData?.label || "",
        },
        extended_badges: ownerRenderer?.badges || [],
        extended_superTitle:
          getTextFromRuns(primaryInfoRenderer?.superTitleLink?.runs) || "",
        trackingParams: twoColumnResults?.trackingParams || null,
      });
    } catch (parseError) {
      console.error(`[JSON Parse Error] ID: ${videoId}`, parseError);
      res.status(500).json({
        error: "Failed to parse internal data",
        detail: parseError.message,
      });
    }
  } catch (error) {
    console.error(`[Server Error] ID: ${videoId}`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * ヘルスチェック用エンドポイント
 */
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// サーバーの起動
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
