import express from "express";
import { Innertube } from "youtubei.js";

const router = express.Router();

let youtube;

(async () => {
  try {
    youtube = await Innertube.create({
      lang: "ja",
      location: "JP",
      retrieve_player: false,
    });
    console.log("YouTube API 初期化完了");
  } catch (initError) {
    console.error("YouTube API 初期化失敗:", initError);
  }
})();

// プレイリストIDを正規化
function normalizePlaylistId(id = "") {
  return id.length > 34 ? id.slice(2) : id;
}

// 指定された形式のURLから画像をBase64化するヘルパー関数
// quality引数で 'mqdefault' か 'default' を切り替え可能にします
async function fetchImageAsBase64(videoId, quality = 'mqdefault') {
  if (!videoId) return "";
  
  // 指定されたURL形式 (qualityを変数化)
  const url = `https://i.ytimg.com/vi_webp/${videoId}/${quality}.webp`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return "";
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:image/webp;base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error(`画像取得エラー [${videoId} (${quality})]:`, err.message);
    return "";
  }
}

// GET /api/channel/:id
router.get("/:id", async (req, res) => {
  const channelId = req.params.id;

  if (!youtube) {
    return res.status(503).json({ error: "YouTube APIがまだ初期化されていません" });
  }

  try {
    const channel = await youtube.getChannel(channelId);

    const metadata = channel.metadata ?? {};
    const header = channel.header ?? {};
    const currentTab = channel.current_tab ?? {};
    const contents = currentTab?.content?.contents ?? [];
    
    // TopVideoオブジェクトの抽出
    const topVideoRaw = contents?.[0]?.contents?.[0] ?? {};
    const topVideoId = topVideoRaw.id ?? topVideoRaw.video_id ?? "";

    // プレイリストセクションを抽出
    const playlistSections = contents.slice(1).filter(c => {
      if (c.type !== "ItemSection") return false;
      const title = c?.contents?.[0]?.title?.text ?? "";
      return title !== "メンバー" && title !== "投稿" && title !== "ショート" && title !== "複数の再生リスト";
    });

    // --- 並列処理の開始 ---
    const [topVideoThumbnail, playlists] = await Promise.all([
      // 1. TopVideo: mqdefault.webp を取得
      fetchImageAsBase64(topVideoId, 'mqdefault'),

      // 2. プレイリスト内の動画: default.webp を取得
      Promise.all(playlistSections.map(async (section) => {
        const content = section?.contents?.[0];
        const itemsRaw = content?.content?.items ?? [];
        const rawPlaylistId = content?.title?.endpoint?.payload?.browseId ?? "";
        const playlistId = normalizePlaylistId(rawPlaylistId);

        const items = await Promise.all(itemsRaw.map(async (item) => {
          const videoId = item.video_id ?? item.author?.id ?? "";
          
          // ここで 'default' を指定して軽量な画像を取得
          const thumbnailBase64 = await fetchImageAsBase64(videoId, 'default');

          return {
            videoId: videoId,
            title: item.title?.text ?? item.author?.name ?? "",
            duration: item.duration?.text ?? "",
            published: item.published?.text ?? "",
            author: item.author?.name ?? metadata.title ?? "",
            viewCount: item.short_view_count?.text ?? item.views?.text ?? item.subscribers?.text ?? "",
            thumbnail: thumbnailBase64,
            icon: item.author?.thumbnails?.[0]?.url ?? "",
          };
        }));

        return {
          title: content?.title?.text ?? "",
          playlistId,
          items: items
        };
      }))
    ]);

    // "UCxxxx" → "UUxxxx" に変換
    let uploadsPlaylistId = "";
    if (channelId.startsWith("UC")) {
      uploadsPlaylistId = "UU" + channelId.slice(2);
    }

    const response = {
      channelId,
      title: metadata.title ?? "",
      avatar: metadata.avatar?.[0]?.url ?? "",
      banner: header.content?.banner?.image?.[0]?.url ?? "",
      videoCount: header.content?.metadata?.metadata_rows?.[1]?.metadata_parts?.[0]?.text?.text ?? "",
      description: metadata.description ?? "",
      topVideo: {
        title: topVideoRaw.title?.text ?? "",
        videoId: topVideoId,
        viewCount: topVideoRaw.view_count?.text ?? "",
        published: topVideoRaw.published_time?.text ?? "",
        description: (topVideoRaw.description?.text ?? "").replace(/\n/g, "<br>"),
        thumbnail: topVideoThumbnail, // mqdefaultのBase64画像
      },
      playlists, // defaultのBase64画像を含むリスト
      uploadsPlaylistId,
    };

    res.json(response);
  } catch (err) {
    console.error(`チャンネル[${channelId}]情報取得エラー:`, err?.message || err);
    res.status(500).json({ error: "チャンネル情報の取得中にエラーが発生しました" });
  }
});

export default router;
