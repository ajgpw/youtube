<template>
  <div v-if="error" class="error-box">
    ⚠️ {{ error }}
    <button @click="reloadStream" class="reload-button">再取得</button>
  </div>
  <div v-else-if="streamUrl" class="video-container">
    <iframe
      :src="streamUrl"
      frameborder="0"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
      :title="videoTitle || '動画ストリーム'"
      @load="iframeLoaded = true"
    ></iframe>
    <PlayerLoading v-if="!iframeLoaded" overlay />
  </div>
  <PlayerLoading v-else-if="loading" />
</template>

<script setup>
import { ref, watch } from "vue";
import PlayerLoading from "@/components/PlayerLoading.vue";
import { apiRequest } from "@/services/requestManager";

const props = defineProps({
  videoId: { type: String, required: true },
  videoTitle: { type: String, default: "" }
});

const streamUrl = ref("");
const error = ref("");
const loading = ref(false);
const iframeLoaded = ref(false);

// --- キャッシュ用 ---
let cachedParams = null;
let cachedAt = 0; // タイムスタンプ(ms)

function reloadStream() {
  fetchStream(props.videoId);
}

const sheetId = "1dily2wiik92TAyK3zyIsu8TDuyYNoF20IM1iMk_X-pg";
const sheetName = "Youtube-education-parameter";
const range = "A1";

async function fetchParamsFromSheet() {
  const now = Date.now();
  // 1時間(3600000ms)以内ならキャッシュを使う
  if (cachedParams && now - cachedAt < 3600000) {
    return cachedParams;
  }

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}&range=${range}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    const jsonStr = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/s)[1];
    const data = JSON.parse(jsonStr);
    const params = data.table.rows?.[0]?.c?.[0]?.v;
    if (!params) throw new Error("スプレッドシートに値がありません");

    // キャッシュ更新
    cachedParams = params;
    cachedAt = now;

    return params;
  } catch (err) {
    console.warn("スプレッドシート取得失敗:", err);
    return null; // 失敗したら null を返す
  }
}

async function fetchStream(id) {
  streamUrl.value = "";
  error.value = "";
  loading.value = true;
  iframeLoaded.value = false;

  let params = await fetchParamsFromSheet();

  // スプレッドシート取得できなかったら従来の apiRequest
  if (!params) {
    try {
      const data = await apiRequest({
        params: { stream: id },
        retries: 1,
        timeout: 60000,
        jsonpFallback: false,
      });
      if (data && data.url) {
        streamUrl.value = data.url;
      } else {
        error.value = "ストリームURLが空です (JSON)";
      }
      return;
    } catch (err) {
      if (err && err.name === "AbortError") {
        error.value = "ストリームURLの取得に失敗しました (タイムアウト)";
      } else {
        error.value = "ストリームURLの取得に失敗しました (fetch error)";
      }
      return;
    } finally {
      loading.value = false;
    }
  }

  // スプレッドシートから params が取れた場合
  streamUrl.value = `https://www.youtubeeducation.com/embed/${id}${params}`;
  loading.value = false;
}

watch(
  () => props.videoId,
  (newId) => {
    if (newId) fetchStream(newId);
  },
  { immediate: true }
);
</script>

<style scoped>
.video-container {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
  overflow: hidden;
}
.video-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.error-box {
  color: var(--accent-weak);
  margin: 10px;
}
.reload-button {
  margin-top: 6px;
  padding: 6px 12px;
  font-size: 9px;
  background: var(--text-secondary);
  color: var(--on-accent);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  width: 50%;
}
.reload-button:hover {
  background: var(--text-secondary-hover);
  color: var(--on-accent);
}
</style>
