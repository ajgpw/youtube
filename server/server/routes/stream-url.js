import express from "express";
import https from "https";
import fetch from "node-fetch";

const router = express.Router();

const CONFIG_URL =
  "https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json";

// ==================================================
// 共通 async エラーハンドラ
// ==================================================
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// エラーを統一フォーマットで作成
function createError(name, message, status = 500) {
  const err = new Error(message);
  err.name = name;
  err.status = status;
  return err;
}

// ==================================================
// YouTube ID バリデーション
// ==================================================
function validateYouTubeId(req, res, next) {
  const { id } = req.params;
  if (!/^[\w-]{11}$/.test(id)) {
    return next(createError("ValidateYouTubeIdError", "YouTube ID が不正です", 400));
  }
  next();
}

// ==================================================
// 設定ファイル取得（キャッシュなし）
// ==================================================
function fetchConfigJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        if (res.statusCode !== 200) {
          res.resume();
          return reject(
            createError("ConfigFetchError", `HTTP ${res.statusCode} エラー`)
          );
        }

        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(createError("ConfigParseError", "JSON パースに失敗"));
          }
        });
      })
      .on("error", () => reject(createError("ConfigFetchError", "リクエスト失敗")));
  });
}

// ==================================================
// URL配列から lang=ja を優先して返す
// ==================================================
function selectUrl(urls) {
  if (!urls || urls.length === 0) return null;
  const ja = urls.find((u) => u.includes("lang=ja"));
  return encodeURIComponent(ja || urls[0]);
}

// ==================================================
// type1: 設定ファイルを読み込んで埋め込みURL返す
// ==================================================
router.get(
  "/:id",
  validateYouTubeId,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const config = await fetchConfigJson(CONFIG_URL);
    const params = config.params || "";

    res.json({ url: `https://www.youtubeeducation.com/embed/${id}${params}` });
  })
);

// ==================================================
// type2: ローカルAPI取得のみ（WebM→MP4→AV1優先）
// ==================================================
router.get(
  "/:id/type2",
  validateYouTubeId,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const apiUrl = `http://192.168.11.4:3005/api/streams/${id}`;

    const response = await fetch(apiUrl).catch(() => {
      throw createError("LocalAPIConnectionError", "ローカルAPIへ接続できません");
    });

    if (!response.ok) {
      throw createError(
        "LocalAPIResponseError",
        `ローカルAPI失敗 (HTTP ${response.status})`
      );
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw createError("LocalAPIParseError", "ローカルAPI JSON が壊れています");
    }

    const formats = Array.isArray(data.formats) ? data.formats : [];

    const videourl = {};
    const m3u8 = {};
    const extPriority = ["webm", "mp4", "av1"];

    const parseHeight = (format) => {
      if (typeof format.height === "number") return format.height;
      const m = /x(\d+)/.exec(format.resolution || "");
      return m ? parseInt(m[1]) : null;
    };

    const selectUrlLocal = (urls) => {
      if (!urls?.length) return null;
      const ja = urls.find((u) => decodeURIComponent(u).includes("lang=ja"));
      return ja || urls[0];
    };

    const formatsByHeight = {};

    for (const f of formats) {
      const height = parseHeight(f);
      if (!height || f.vcodec === "none" || !f.url) continue;
      const label = `${height}p`;
      if (!formatsByHeight[label]) formatsByHeight[label] = [];
      formatsByHeight[label].push(f);
    }

    const audioUrls = formats
      .filter((f) => f.acodec !== "none" && f.vcodec === "none")
      .map((f) => f.url);
    const audioOnlyUrl = selectUrlLocal(audioUrls);

    for (const [label, list] of Object.entries(formatsByHeight)) {
      const m3u8List = list.filter((f) => f.url.includes(".m3u8"));
      if (m3u8List.length > 0) {
        m3u8[label] = { url: { url: selectUrlLocal(m3u8List.map((f) => f.url)) } };
      }

      const normalList = list
        .filter((f) => !f.url.includes(".m3u8"))
        .sort(
          (a, b) =>
            extPriority.indexOf(a.ext || "") -
            extPriority.indexOf(b.ext || "")
        );

      if (normalList.length > 0) {
        videourl[label] = {
          video: { url: selectUrlLocal([normalList[0].url]) },
          audio: { url: audioOnlyUrl },
        };
      }
    }

    res.json({ videourl, m3u8 });
  })
);

// ==================================================
// ダウンロード用
// ==================================================
router.get(
  "/download/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const response = await fetch(`http://192.168.11.4:3005/api/streams/${id}`).catch(
      () => {
        throw createError("LocalAPIConnectionError", "3005 APIへ接続できません");
      }
    );

    if (!response.ok) {
      throw createError(
        "LocalAPIResponseError",
        `API失敗 (HTTP ${response.status})`
      );
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw createError("LocalAPIParseError", "API JSON が壊れています");
    }

    if (!data.formats || !Array.isArray(data.formats)) {
      throw createError("FormatDataError", "formats が欠損しています");
    }

    const result = {
      "audio only": [],
      "video only": [],
      "audio&video": [],
      "m3u8 raw": [],
      "m3u8 proxy": [],
    };

    for (const f of data.formats) {
      if (!f.url) continue;

      const url = f.url.toLowerCase();

      if (url.includes("lang=") && !url.includes("lang=ja")) continue;

      if (url.endsWith(".m3u8")) {
        const m3u8Data = {
          url: f.url,
          resolution: f.resolution,
          vcodec: f.vcodec,
          acodec: f.acodec,
        };
        result["m3u8 raw"].push(m3u8Data);
        result["m3u8 proxy"].push({
          ...m3u8Data,
          url: `https://proxy-siawaseok.duckdns.org/proxy/m3u8?url=${encodeURIComponent(f.url)}`,
        });
        continue;
      }

      if (f.resolution === "audio only" || f.vcodec === "none") {
        result["audio only"].push(f);
      } else if (f.acodec === "none") {
        result["video only"].push(f);
      } else {
        result["audio&video"].push(f);
      }
    }

    res.json(result);
  })
);

// ==================================================
// 共通エラーハンドラ
// ==================================================
router.use((err, req, res, next) => {
  console.error("🔥 Error:", err.name, err.message);

  res.status(err.status || 500).json({
    error: err.name,
    message: err.message,
  });
});

export default router;