<template>
  <div v-if="error" class="error-box">
    ⚠️ {{ error }}
    <button @click="reloadStream" class="reload-button">再取得</button>
  </div>
  <div v-else-if="selectedQuality && availableQualities.length > 0" class="video-container">
    <!-- single-stream (audio+video) が使える場合 -->
    <template v-if="isSingleStreamEntry(sources[selectedQuality])">
      <video
        ref="videoRef"
        controls
        :autoplay="autoplayEnabled"
        :loop="repeatEnabled"
        :key="sources[selectedQuality]?.url"
        @canplay="markPlayerReady"
        @playing="markPlayerPlaying"
        @waiting="markPlayerBuffering"
      >
        <source
          v-for="s in getSingleStreamSources(sources[selectedQuality])"
          :key="s.url"
          :src="s.url"
          :type="s.mimeType || (s.isM3u8 ? 'application/x-mpegURL' : undefined)"
        />
        <track
          v-for="track in subtitleTracks"
          :key="`${track.srclang}:${track.src}`"
          :src="track.src"
          :srclang="track.srclang"
          :label="track.label"
          :kind="track.kind"
          :default="track.default"
        />
      </video>

      <div v-if="showUnmutePrompt" class="unmute-prompt" @click.stop="handleUnmuteClick">
        ミュートを解除する
      </div>

      <div class="settings-box" v-show="settingsVisible">
        <label>
          繰り返し:
          <input type="checkbox" v-model="repeatEnabled" />
        </label>
        <label :class="{ 'autoplay-disabled': repeatEnabled }">
          自動再生:
          <input type="checkbox" v-model="autoplayEnabled" :disabled="repeatEnabled" />
        </label>

        <label>
          画質:
          <select v-model="selectedQuality" class="selector">
            <option v-for="q in availableQualities" :key="q" :value="q">
              {{ qualityLabels[q] || q }}
            </option>
          </select>
        </label>

        <!-- 非 Apple デバイスでは再生速度選択を常に表示 -->
        <label v-if="!isAppleDevice()">
          再生速度:
          <select v-model.number="selectedPlaybackRate" class="selector">
            <option v-for="rate in playbackRates" :key="rate" :value="rate">
              {{ rate }}x
            </option>
          </select>
        </label>

        <button @click="reloadStream" class="reload-button">再読込み</button>
      </div>
      <div v-if="isQualitySwitching" class="block-overlay" aria-hidden="true"></div>
    </template>

    <!-- その他: videourl (video+audio) の再生 / audio-only -->
    <template v-else>
      <template v-if="isAudioOnlyEntry(sources[selectedQuality])">
        <div class="audio-only">
          <audio
            ref="audioRef"
            preload="auto"
            :autoplay="autoplayEnabled"
            controls
            @canplay="markPlayerReady"
            @playing="markPlayerPlaying"
            @waiting="markPlayerBuffering"
          >
            <source :src="sources[selectedQuality]?.audio?.url" :type="sources[selectedQuality]?.audio?.mimeType" />
          </audio>
        </div>
      </template>
      <template v-else>
        <video
          ref="videoRef"
          preload="auto"
          :autoplay="autoplayEnabled"
          controls
          :key="separateAvKey"
          @canplay="markPlayerReady"
          @playing="markPlayerPlaying"
          @waiting="markPlayerBuffering"
        >
          <source
            v-for="s in getVideoSourcesForEntry(sources[selectedQuality])"
            :key="s.url"
            :src="s.url"
            :type="s.mimeType"
          />
          <track
            v-for="track in subtitleTracks"
            :key="`${track.srclang}:${track.src}`"
            :src="track.src"
            :srclang="track.srclang"
            :label="track.label"
            :kind="track.kind"
            :default="track.default"
          />
        </video>
        <div v-if="showUnmutePrompt" class="unmute-prompt" @click.stop="handleUnmuteClick">
          ミュートを解除する
        </div>
        <audio
          ref="audioRef"
          preload="auto"
          style="display:none;"
          autoplay
          :key="separateAvKey"
          @canplay="markPlayerReady"
          @playing="markPlayerPlaying"
          @waiting="markPlayerBuffering"
        >
          <source :src="sources[selectedQuality]?.audio?.url" :type="sources[selectedQuality]?.audio?.mimeType" />
        </audio>
      </template>

      <div class="settings-box" v-show="settingsVisible">
        <label>
          繰り返し:
          <input type="checkbox" v-model="repeatEnabled" />
        </label>
        <label :class="{ 'autoplay-disabled': repeatEnabled }">
          自動再生:
            <input type="checkbox" v-model="autoplayEnabled" :disabled="repeatEnabled" />
        </label>

        <label>
          画質:
          <select v-model="selectedQuality" class="selector">
            <option v-for="q in availableQualities" :key="q" :value="q">
              {{ qualityLabels[q] || q }}
            </option>
          </select>
        </label>

        <!-- 非 Apple デバイスでは再生速度選択を常に表示 -->
        <label v-if="!isAppleDevice()">
          再生速度:
          <select v-model.number="selectedPlaybackRate" class="selector">
            <option v-for="rate in playbackRates" :key="rate" :value="rate">
              {{ rate }}x
            </option>
          </select>
        </label>

        <button @click="reloadStream" class="reload-button">再読込み</button>
      </div>
      <div v-if="isQualitySwitching" class="block-overlay" aria-hidden="true"></div>
    </template>
    <PlayerLoading
      v-if="!playerReady || playerBuffering"
      overlay
    />
  </div>
  <PlayerLoading v-else-if="loading" />
</template>

<script setup>
import { ref, watch, onMounted, nextTick, onBeforeUnmount } from "vue";
import PlayerLoading from "@/components/PlayerLoading.vue";
import { stream as fetchStream } from "@/services/siatubeApi";
import { setupSyncPlayback } from "@/components/syncPlayback";
import { parseStream2Response } from "@/utils/type2StreamParser";
import {
  extractSubtitleTracks,
  normalizeStreamFormats,
} from "@/utils/siatubeAdapters";
import { loadPreferredQuality } from "@/utils/settingsManager";
import { loadHlsConstructor } from "@/utils/hlsLoader";
import {
  localizeSubtitleTracks,
  revokeSubtitleTracks,
  selectPlaybackSubtitleTracks,
} from "@/utils/subtitleTracks";

const props = defineProps({
  videoId: { type: String, required: true }
});
const emit = defineEmits([
  "ended",
  "play-autoplay-candidate",
  "autoplay-no-suitable-video",
]);
function reloadStream() {
  fetchStreamUrl(props.videoId, true);
}

const error = ref("");
const sources = ref({});
const selectedQuality = ref("");
const availableQualities = ref([]);
const qualityLabels = ref({}); // Map from internal key to display label
const subtitleTracks = ref([]);
const selectedPlaybackRate = ref(1.0);
const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];
const diffText = ref("0");
const videoRef = ref(null);
const audioRef = ref(null);
const separateAvKey = ref(0);
const repeatEnabled = ref(false);
// デフォルトはオフにする
const AUTOPLAY_SETTING_KEY = 'yt_autoplay_enabled_v1';
function loadAutoplaySetting() {
  try {
    const v = localStorage.getItem(AUTOPLAY_SETTING_KEY);
    if (v === null) return false; // default off
    return v === '1' ? true : false;
  } catch (e) { return false; }
}
function saveAutoplaySetting(val) {
  try { localStorage.setItem(AUTOPLAY_SETTING_KEY, val ? '1' : '0'); } catch (e) {}
}

const autoplayEnabled = ref(loadAutoplaySetting());
const loading = ref(false);
const playerReady = ref(false);
const playerBuffering = ref(false);
const isQualitySwitching = ref(false);
const showUnmutePrompt = ref(false);
const settingsVisible = ref(true);
const USER_GESTURE_KEY = 'yt_user_gesture_v1';
const AUTOPLAY_DELAY_MS = 3000;
const LOOP_BUFFER_SECONDS = 5; // バッファの為の待ち時間
let _autoplayTimer = null;
let _buffering = false;
let _loopResumeTimer = null;
let _loopBufferListenersAttached = false;
const BUFFER_RESUME_SECONDS = 4;
let _onEndedAttached = false;
let streamRequestSequence = 0;
let hlsInstance = null;
let HlsConstructor = null;

function destroyHls() {
  if (!hlsInstance) return;
  try { hlsInstance.destroy(); } catch (e) {}
  hlsInstance = null;
}

const endedHandler = {
  fn: async () => {
    try { emit('ended'); } catch (e) {}
    try { pushToHistory(props.videoId); } catch (e) {}
    if (!autoplayEnabled.value) return;
    try {
      const candId = getAutoplayCandidateId();
      if (!candId) return;
      emit('play-autoplay-candidate', { id: candId });
    } catch (e) {}
  }
};

let _onEnded = async () => { await endedHandler.fn(); };
const PLAY_HISTORY_KEY = 'yt_play_history_v1';

function loadPlayHistory() {
  try {
    const s = localStorage.getItem(PLAY_HISTORY_KEY);
    return s ? JSON.parse(s) : [];
  } catch (e) { return []; }
}

function savePlayHistory(arr) {
  try { localStorage.setItem(PLAY_HISTORY_KEY, JSON.stringify(arr.slice(-3))); } catch (e) {}
}

function pushToHistory(id) {
  if (!id) return;
  try {
    const h = loadPlayHistory();
    if (h[h.length - 1] === id) return;
    h.push(id);
    savePlayHistory(h);
  } catch (e) {}
}

// 自動再生候補選定
// window.__autoplayCandidates があればそこから選ぶ。なければ DOM の data-video-id から選ぶ。
function getAutoplayCandidateId() {
  try {
    const recent = new Set(loadPlayHistory());
    // avoid current video
    recent.add(props.videoId);

    // Get filter settings
    const filterConfig = window.__autoplayDurationFilter || { enabled: false, maxSeconds: 240 };
    const maxSeconds = filterConfig.enabled ? filterConfig.maxSeconds : Infinity;

    // Helper function to check if a video passes duration filter
    function passesFilter(durationStr) {
      if (!filterConfig.enabled) {
        return true; // No filter
      }
      if (!durationStr) {
        return true; // No duration info, allow it
      }
      const duration = parseInt(durationStr, 10);
      if (isNaN(duration)) {
        return true; // Invalid duration, allow it
      }
      return duration <= maxSeconds;
    }

    // list from window variable
    if (Array.isArray(window.__autoplayCandidates)) {
      for (const id of window.__autoplayCandidates) {
        if (!recent.has(id) && id) return id;
      }
    }

    // DOM: elements with data-video-id
    const els = document.querySelectorAll('[data-video-id]');
    let foundAnyVideo = false;
    for (const el of els) {
      const id = el.getAttribute('data-video-id');
      const durationStr = el.getAttribute('data-duration');
      
      if (!id) continue;
      if (recent.has(id)) continue;
      
      foundAnyVideo = true;
      
      // Check duration filter - MUST pass filter to be selected
      if (!passesFilter(durationStr)) {
        continue; // Skip this video, duration exceeds limit or invalid
      }
      return id; // Found a suitable candidate
    }
    
    // No suitable candidate found - signal to parent
    if (foundAnyVideo && filterConfig.enabled) emit('autoplay-no-suitable-video');
  } catch (e) {}
  return null;
}

// プリフェッチ関連は廃止。候補IDのみを返すユーティリティを使う。

const nativeHlsSupported = ref(false);
const hasM3u8 = ref(false);

onMounted(() => {
  // ブラウザがネイティブに m3u8 を扱えるか判定
  try {
    const tv = document.createElement('video');
    const can1 = tv.canPlayType && tv.canPlayType('application/vnd.apple.mpegurl');
    const can2 = tv.canPlayType && tv.canPlayType('application/x-mpegURL');
    nativeHlsSupported.value = !!(can1 || can2);
  } catch (e) {
    nativeHlsSupported.value = false;
  }

  if (videoRef.value) {
    videoRef.value.addEventListener('mousemove', showSettingsBox);
    videoRef.value.addEventListener('click', showSettingsBox);
    // ended リスナを初期化時に追加
    try {
      videoRef.value.addEventListener('ended', _onEnded);
      _onEndedAttached = true;
    } catch (e) {}
    // その他設定を反映
    applyRepeatAndAutoplay();
  }

  window.addEventListener('mousemove', showSettingsBox);
  window.addEventListener('click', showSettingsBox);
  window.addEventListener('scroll', showSettingsBox);
  // attach loop timeupdate handler if video element exists
  try {
    if (videoRef.value) videoRef.value.addEventListener('timeupdate', onTimeUpdateLoopHandler);
  } catch (e) {}
});

onBeforeUnmount(() => {
  destroyHls();
  revokeSubtitleTracks(subtitleTracks.value);
  try { cancelAutoplay(); } catch (e) {}
  try { detachBufferListeners(); } catch (e) {}
  try { detachLoopBufferListeners(); } catch (e) {}
  try {
    window.removeEventListener('mousemove', showSettingsBox);
    window.removeEventListener('click', showSettingsBox);
    window.removeEventListener('scroll', showSettingsBox);
  } catch (e) {}
  try {
    if (videoRef.value) videoRef.value.removeEventListener('timeupdate', onTimeUpdateLoopHandler);
  } catch (e) {}
});

// 再生時に m3u8 を使うべきか（Apple はそのまま、非 Apple は nativeHlsSupported を確認）
function isAppleDevice() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|Macintosh/.test(ua);
}
function useM3u8Playback() {
  try {
    if (!hasM3u8.value) return false;
    if (isAppleDevice()) return true;
    return nativeHlsSupported.value === true || Boolean(HlsConstructor?.isSupported());
  } catch (e) { return false; }
}

function isSingleStreamEntry(entry) {
  try {
    const list = getSingleStreamSources(entry);
    return Array.isArray(list) && list.length > 0;
  } catch (e) { return false; }
}

function getSingleStreamSources(entry) {
  try {
    if (!entry) return [];
    const rawList = Array.isArray(entry.sources) ? entry.sources : (entry.url ? [{ url: entry.url, mimeType: entry.mimeType, isM3u8: !!entry.isM3u8 }] : []);
    if (rawList.length === 0) return [];
    if (useM3u8Playback()) return rawList;
    return preferH264First(rawList.filter((s) => !s.isM3u8));
  } catch (e) {
    return [];
  }
}

function applyVideoSources(videoEl, sourcesList) {
  if (!videoEl) return;
  try {
    destroyHls();
    videoEl.querySelectorAll(":scope > source").forEach((source) => source.remove());
    const hlsSource = sourcesList.find((source) => source?.isM3u8 && source.url);
    const progressiveSources = sourcesList.filter((source) => !source?.isM3u8);
    const nativeHls = videoEl.canPlayType("application/vnd.apple.mpegurl") ||
      videoEl.canPlayType("application/x-mpegURL");
    if (hlsSource && progressiveSources.length === 0 && !nativeHls && HlsConstructor?.isSupported()) {
      hlsInstance = new HlsConstructor();
      hlsInstance.loadSource(hlsSource.url);
      hlsInstance.attachMedia(videoEl);
      return;
    }
    const playableSources = nativeHls || progressiveSources.length === 0
      ? sourcesList
      : progressiveSources;
    for (const s of playableSources) {
      if (!s || !s.url) continue;
      const sourceEl = document.createElement('source');
      sourceEl.src = s.url;
      if (s.mimeType) sourceEl.type = s.mimeType;
      videoEl.appendChild(sourceEl);
    }
    videoEl.load();
  } catch (e) {}
}

function isAudioOnlyEntry(entry) {
  try {
    return !!(entry && entry.audio && !entry.video && !entry.url);
  } catch (e) { return false; }
}

function getVideoSourcesForEntry(entry) {
  try {
    const sourcesList = entry?.video?.sources;
    if (Array.isArray(sourcesList) && sourcesList.length > 0) return preferH264First(sourcesList);
    if (entry?.video?.url) return preferH264First([{ url: entry.video.url, mimeType: entry.video.mimeType }]);
    return [];
  } catch (e) {
    return [];
  }
}

function preferH264First(list) {
  try {
    if (!Array.isArray(list) || list.length <= 1) return list || [];
    const isH264 = (s) => {
      const mt = (s && s.mimeType) ? String(s.mimeType).toLowerCase() : "";
      const url = (s && s.url) ? String(s.url).toLowerCase() : "";
      if (mt.includes("video/mp4")) return true;
      if (mt.includes("avc1") || mt.includes("h264")) return true;
      if (url.endsWith(".mp4")) return true;
      if (url.includes("codecs=avc1") || url.includes("codecs%3davc1")) return true;
      return false;
    };
    return list.slice().sort((a, b) => {
      const aw = isH264(a) ? 1 : 0;
      const bw = isH264(b) ? 1 : 0;
      return bw - aw;
    });
  } catch (e) {
    return list || [];
  }
}

function getBufferedAhead(el) {
  try {
    if (!el || !el.buffered) return 0;
    const cur = el.currentTime || 0;
    const buf = el.buffered;
    for (let i = buf.length - 1; i >= 0; i--) {
      const start = buf.start(i);
      const end = buf.end(i);
      if (end > cur) {
        if (start <= cur) return end - cur;
        return end - cur;
      }
    }
    return 0;
  } catch (e) { return 0; }
}

function showSettingsBox() {
  try {
    settingsVisible.value = true;
    clearTimeout(showSettingsBox._hideTimer);
    showSettingsBox._hideTimer = setTimeout(() => { settingsVisible.value = false; }, 3500);
  } catch (e) {}
}
showSettingsBox._hideTimer = null;

function checkAndResumeIfBuffered() {
  const vAhead = getBufferedAhead(videoRef.value);
  const aAhead = audioRef.value ? getBufferedAhead(audioRef.value) : vAhead;
  if (_buffering && vAhead >= BUFFER_RESUME_SECONDS && aAhead >= BUFFER_RESUME_SECONDS) {
    _buffering = false;
    try { if (videoRef.value) videoRef.value.play(); } catch (e) {}
    try { if (audioRef.value) audioRef.value.play(); } catch (e) {}
    // 再開後にバッファリスナーをデタッチする
    detachBufferListeners();
  }
}

let _bufferListenersAttached = false;
function attachBufferListeners() {
  if (_bufferListenersAttached) return;
  try {
    if (videoRef.value) {
      videoRef.value.addEventListener('waiting', onWaiting);
      videoRef.value.addEventListener('progress', onProgress);
      videoRef.value.addEventListener('playing', onPlaying);
    }
    if (audioRef.value) {
      audioRef.value.addEventListener('waiting', onWaiting);
      audioRef.value.addEventListener('progress', onProgress);
      audioRef.value.addEventListener('playing', onPlaying);
    }
    _bufferListenersAttached = true;
  } catch (e) {}
}

function detachBufferListeners() {
  if (!_bufferListenersAttached) return;
  try {
    if (videoRef.value) {
      videoRef.value.removeEventListener('waiting', onWaiting);
      videoRef.value.removeEventListener('progress', onProgress);
      videoRef.value.removeEventListener('playing', onPlaying);
    }
    if (audioRef.value) {
      audioRef.value.removeEventListener('waiting', onWaiting);
      audioRef.value.removeEventListener('progress', onProgress);
      audioRef.value.removeEventListener('playing', onPlaying);
    }
  } catch (e) {}
  _bufferListenersAttached = false;
}

function onWaiting() {
  _buffering = true;
  attachBufferListeners();
}

function onProgress() {
  if (!_buffering) return;
  checkAndResumeIfBuffered();
}

function onPlaying() {
  _buffering = false;
  detachBufferListeners();
}

function handleUnmuteClick() {
  try { localStorage.setItem(USER_GESTURE_KEY, '1'); } catch (e) {}
  showUnmutePrompt.value = false;
  try {
    if (videoRef.value) { videoRef.value.muted = false; videoRef.value.play(); }
    if (audioRef.value) { audioRef.value.muted = false; audioRef.value.play(); }
  } catch (e) {}
}

function onFirstUserGesture() {
  try { localStorage.setItem(USER_GESTURE_KEY, '1'); } catch (e) {}
  showUnmutePrompt.value = false;
  try {
    if (videoRef.value) { videoRef.value.muted = false; videoRef.value.play(); }
    if (audioRef.value) { audioRef.value.muted = false; audioRef.value.play(); }
  } catch (e) {}
}

function scheduleAutoplay() {
  try { if (_autoplayTimer) { clearTimeout(_autoplayTimer); _autoplayTimer = null; } } catch (e) {}
  if (!autoplayEnabled.value) return;
  _autoplayTimer = setTimeout(() => {
    try {
      if (videoRef.value) videoRef.value.play();
      if (audioRef.value) audioRef.value.play();
    } catch (e) {}
    _autoplayTimer = null;
  }, AUTOPLAY_DELAY_MS);
}

function cancelAutoplay() {
  try { if (_autoplayTimer) { clearTimeout(_autoplayTimer); _autoplayTimer = null; } } catch (e) {}
}

// 00:00で再生再開させたい
function onTimeUpdateLoopHandler() {
  try {
    if (!videoRef.value) return;
    if (repeatEnabled.value) {
      const cur = videoRef.value.currentTime || 0;
      if (cur <= 0.12 && videoRef.value.paused) {
        startLoopResume();
      }
    }
  } catch (e) {}
}

function startLoopResume() {
  try { cancelLoopResume(); } catch (e) {}
  _loopResumeTimer = setTimeout(() => {
    try { attemptResumeLoop(); } catch (e) {}
  }, LOOP_BUFFER_SECONDS * 1000);
}

function cancelLoopResume() {
  try { if (_loopResumeTimer) { clearTimeout(_loopResumeTimer); _loopResumeTimer = null; } } catch (e) {}
  detachLoopBufferListeners();
}

function attemptResumeLoop() {
  const vAhead = getBufferedAhead(videoRef.value);
  const aAhead = audioRef.value ? getBufferedAhead(audioRef.value) : vAhead;
  if (vAhead >= LOOP_BUFFER_SECONDS && aAhead >= LOOP_BUFFER_SECONDS) {
    try { if (videoRef.value) videoRef.value.play(); } catch (e) {}
    try { if (audioRef.value) audioRef.value.play(); } catch (e) {}
    cancelLoopResume();
  } else {
    attachLoopBufferListeners();
  }
}

function attachLoopBufferListeners() {
  if (_loopBufferListenersAttached) return;
  try {
    if (videoRef.value) {
      videoRef.value.addEventListener('progress', onLoopBufferProgress);
      videoRef.value.addEventListener('playing', onLoopBufferProgress);
    }
    if (audioRef.value) {
      audioRef.value.addEventListener('progress', onLoopBufferProgress);
      audioRef.value.addEventListener('playing', onLoopBufferProgress);
    }
    _loopBufferListenersAttached = true;
  } catch (e) {}
}

function detachLoopBufferListeners() {
  if (!_loopBufferListenersAttached) return;
  try {
    if (videoRef.value) {
      videoRef.value.removeEventListener('progress', onLoopBufferProgress);
      videoRef.value.removeEventListener('playing', onLoopBufferProgress);
    }
    if (audioRef.value) {
      audioRef.value.removeEventListener('progress', onLoopBufferProgress);
      audioRef.value.removeEventListener('playing', onLoopBufferProgress);
    }
  } catch (e) {}
  _loopBufferListenersAttached = false;
}

function onLoopBufferProgress() {
  try {
    const vAhead = getBufferedAhead(videoRef.value);
    const aAhead = audioRef.value ? getBufferedAhead(audioRef.value) : vAhead;
    if (vAhead >= LOOP_BUFFER_SECONDS && aAhead >= LOOP_BUFFER_SECONDS) {
      try { if (videoRef.value) videoRef.value.play(); } catch (e) {}
      try { if (audioRef.value) audioRef.value.play(); } catch (e) {}
      cancelLoopResume();
    }
  } catch (e) {}
}

// 繰り返し再生が選ばれた時
watch(repeatEnabled, (newVal) => {
  try {
    if (newVal) {
      // if repeat turned on, disable autoplay and clear any scheduled autoplay
      autoplayEnabled.value = false;
      try { cancelAutoplay(); } catch (e) {}
    } else {
      // if repeat turned off, leave autoplay as user-configured; do not force change
      // if sources ready, schedule autoplay
      try {
        if (autoplayEnabled.value) scheduleAutoplay();
      } catch (e) {}
    }
  } catch (e) {}
});

// persist autoplay setting across videos
watch(autoplayEnabled, (val) => {
  try { saveAutoplaySetting(!!val); } catch (e) {}
});

function clearType2SrcRepeated() {
  let count = 0;
  const interval = setInterval(() => {
    try {
      if (videoRef.value) {
        videoRef.value.removeAttribute("src");
        videoRef.value.load();
      }
      if (audioRef.value) {
        audioRef.value.removeAttribute("src");
        audioRef.value.load();
      }
    } catch (e) {}
    count++;
    if (count >= 2) {
      clearInterval(interval);
    }
  }, 200);
}

function reloadSrc() {
  const sel = selectedQuality.value;
  const entry = sources.value[sel];
  if (!entry) return;

  if (isSingleStreamEntry(entry)) {
    // single-stream
    if (videoRef.value) {
      applyVideoSources(videoRef.value, getSingleStreamSources(entry));
    }
    if (audioRef.value) {
      const aSource = audioRef.value.querySelector('source');
      if (aSource) aSource.removeAttribute('src');
      audioRef.value.removeAttribute('src');
      audioRef.value.load();
    }
  } else if (isAudioOnlyEntry(entry)) {
    if (audioRef.value && entry.audio.url) {
      const source = audioRef.value.querySelector('source');
      if (source) {
        source.src = entry.audio.url;
        if (entry.audio.mimeType) source.type = entry.audio.mimeType;
      } else {
        audioRef.value.src = entry.audio.url;
      }
      audioRef.value.load();
    }
  } else if (entry.video) {
    // video+audio
    if (videoRef.value) {
      applyVideoSources(videoRef.value, getVideoSourcesForEntry(entry));
    }
    if (audioRef.value && entry.audio.url) {
      const source = audioRef.value.querySelector('source');
      if (source) source.src = entry.audio.url;
      audioRef.value.load();
    }
  }
}

function checkPlayback() {
  if (videoRef.value) {
    videoRef.value.play().catch(() => {
      reloadSrc();
    });
  }
  if (audioRef.value) {
    audioRef.value.play().catch(() => {
      reloadSrc();
    });
  }
}

// single-stream 切替時の共通セットアップ（再生位置を維持）
function applyHlsSetup(prevTime = 0) {
  destroyHls();
  isQualitySwitching.value = true;
  setTimeout(() => { isQualitySwitching.value = false; }, 1000);

  // pause before src swap (テンプレート側で :key により再レンダリングされる)
  try { if (videoRef.value) { prevTime = videoRef.value.currentTime || prevTime; videoRef.value.pause(); } } catch (e) {}
  try {
    if (audioRef.value) {
      audioRef.value.pause();
      const aSource = audioRef.value.querySelector('source');
      if (aSource) aSource.removeAttribute('src');
      audioRef.value.removeAttribute('src');
      audioRef.value.load();
    }
  } catch (e) {}

  nextTick(() => {
    const entry = sources.value[selectedQuality.value];
    if (videoRef.value && isSingleStreamEntry(entry)) {
      applyVideoSources(videoRef.value, getSingleStreamSources(entry));
    }
    // 再レンダリング後に時間を復元して再生を試みる
    try {
      if (videoRef.value) {
        // HLS は currentTime 設定が成功しないこともあるため複数回試す
        videoRef.value.currentTime = prevTime;
        setTimeout(() => { try { if (videoRef.value) videoRef.value.currentTime = prevTime; } catch (e) {} }, 250);
      }
    } catch (e) {}

    // ended リスナを再attach
    if (videoRef.value) {
      try {
        videoRef.value.removeEventListener('ended', _onEnded);
        videoRef.value.addEventListener('ended', _onEnded);
        _onEndedAttached = true;
      } catch (e) {}
    }

    const granted2 = (() => { try { return localStorage.getItem(USER_GESTURE_KEY) === '1'; } catch (e) { return false; } })();

    try {
      if (videoRef.value) {
        videoRef.value.muted = !granted2;
        if (autoplayEnabled.value) scheduleAutoplay();
      }
      if (audioRef.value) {
        audioRef.value.muted = !granted2;
        if (autoplayEnabled.value) scheduleAutoplay();
      }
      attachBufferListeners();
      showUnmutePrompt.value = !granted2;
      if (!granted2) {
        window.addEventListener('click', onFirstUserGesture, { once: true });
        window.addEventListener('touchstart', onFirstUserGesture, { once: true });
      } else {
        scheduleAutoplay();
      }
    } catch (e) {}
    // Add playback check for HLS
    if (videoRef.value) {
      videoRef.value.addEventListener('canplay', checkPlayback, { once: true });
    }
  });
}

// selectedQuality の監視: 選択先が HLS(url) を持つかどうかで挙動を分ける
watch(selectedQuality, () => {
  playerReady.value = false;
  playerBuffering.value = false;
  const sel = selectedQuality.value;
  const entry = sources.value[sel];

  if (!entry) return;

  // If entry has single-stream URL and device can use it
  if (isSingleStreamEntry(entry)) {
    // preserve position and apply HLS setup
    let prevTime = 0;
    try { if (videoRef.value) prevTime = videoRef.value.currentTime || 0; } catch (e) {}
    applyHlsSetup(prevTime);
    return;
  }

  // Audio-only
  if (isAudioOnlyEntry(entry)) {
    isQualitySwitching.value = true;
    setTimeout(() => { isQualitySwitching.value = false; }, 1000);
    nextTick(() => {
      try {
        if (audioRef.value && entry.audio?.url) {
          const source = audioRef.value.querySelector('source');
          if (source) {
            source.src = entry.audio.url;
            if (entry.audio.mimeType) source.type = entry.audio.mimeType;
          } else {
            audioRef.value.src = entry.audio.url;
          }
          audioRef.value.load();
        }
      } catch (e) {}
      applyRepeatAndAutoplay();
      const granted2 = (() => { try { return localStorage.getItem(USER_GESTURE_KEY) === '1'; } catch (e) { return false; } })();
      try {
        if (audioRef.value) {
          audioRef.value.muted = !granted2;
          if (autoplayEnabled.value) scheduleAutoplay();
        }
        attachBufferListeners();
        showUnmutePrompt.value = !granted2;
        if (!granted2) {
          window.addEventListener('click', onFirstUserGesture, { once: true });
          window.addEventListener('touchstart', onFirstUserGesture, { once: true });
        } else {
          scheduleAutoplay();
        }
      } catch (e) {}
      if (audioRef.value) {
        audioRef.value.addEventListener('canplay', checkPlayback, { once: true });
      }
    });
    return;
  }

  // Otherwise use legacy video+audio sync flow (entry.video must exist)
  if (entry.video) {
    // Force element re-create for separated AV (Safari/iOS cache issues)
    separateAvKey.value += 1;
    isQualitySwitching.value = true;
    setTimeout(() => {
      isQualitySwitching.value = false;
    }, 4000);
    let prevTime = 0;
    if (videoRef.value) {
      prevTime = videoRef.value.currentTime;
      videoRef.value.pause();
    }
    if (audioRef.value) {
      audioRef.value.pause();
    }
    nextTick(() => {
      clearType2SrcRepeated();
      setupSyncPlayback(
        videoRef.value,
        audioRef.value,
        sources,
        selectedQuality,
        diffText,
        selectedPlaybackRate
      );
      applyRepeatAndAutoplay();
      
      // ended リスナを再attach
      if (videoRef.value) {
        try {
          videoRef.value.removeEventListener('ended', _onEnded);
          videoRef.value.addEventListener('ended', _onEnded);
          _onEndedAttached = true;
        } catch (e) {}
      }
      
      const granted2 = (() => { try { return localStorage.getItem(USER_GESTURE_KEY) === '1'; } catch (e) { return false; } })();
      try {
        if (videoRef.value) {
          videoRef.value.muted = !granted2;
          if (autoplayEnabled.value) scheduleAutoplay();
        }
        if (audioRef.value) {
          audioRef.value.muted = !granted2;
          if (autoplayEnabled.value) scheduleAutoplay();
        }
        attachBufferListeners();
        showUnmutePrompt.value = !granted2;
        if (!granted2) {
          window.addEventListener('click', onFirstUserGesture, { once: true });
          window.addEventListener('touchstart', onFirstUserGesture, { once: true });
        } else {
          scheduleAutoplay();
        }
      } catch (e) {}
      // Add playback check for video+audio
      if (videoRef.value) {
        videoRef.value.addEventListener('canplay', checkPlayback, { once: true });
      }
      if (audioRef.value) {
        audioRef.value.addEventListener('canplay', checkPlayback, { once: true });
      }
      setTimeout(() => {
        try {
          if (videoRef.value) videoRef.value.currentTime = prevTime;
          if (audioRef.value) audioRef.value.currentTime = prevTime;
        } catch (e) {}
        setTimeout(() => {
          try {
            if (videoRef.value) videoRef.value.currentTime = prevTime;
            if (audioRef.value) audioRef.value.currentTime = prevTime;
          } catch (e) {}
        }, 600);
      }, 600);
    });
  }
});

function applyRepeatAndAutoplay() {
  if (videoRef.value) {
    videoRef.value.loop = !!repeatEnabled.value;
    videoRef.value.autoplay = !!autoplayEnabled.value;
    videoRef.value.playbackRate = selectedPlaybackRate.value;
  }
  if (audioRef.value) {
    audioRef.value.loop = !!repeatEnabled.value;
    audioRef.value.autoplay = !!autoplayEnabled.value;
    audioRef.value.playbackRate = selectedPlaybackRate.value;
  }
}

async function fetchStreamUrl(id, forceRefresh = false) {
  const sequence = ++streamRequestSequence;
  destroyHls();
  error.value = "";
  sources.value = {};
  selectedQuality.value = "";
  selectedPlaybackRate.value = 1.0;
  diffText.value = "0";
  availableQualities.value = [];
  loading.value = true;
  playerReady.value = false;
  playerBuffering.value = false;
  hasM3u8.value = false;
  revokeSubtitleTracks(subtitleTracks.value);
  subtitleTracks.value = [];

  try {
    const data = await fetchStream(id, {
      forceRefresh,
      retries: 1,
      timeout: 30000,
    });
    if (sequence !== streamRequestSequence || id !== props.videoId) return;

    const locale = typeof navigator !== "undefined" ? navigator.language : "ja";
    const normalizedFormats = normalizeStreamFormats(data, locale);
    const hasHls = normalizedFormats.some((format) => format.isM3u8);
    if (hasHls && !nativeHlsSupported.value) {
      HlsConstructor = await loadHlsConstructor();
      if (sequence !== streamRequestSequence || id !== props.videoId) return;
    }

    const parsed = parseStream2Response({ formats: normalizedFormats });
    const rawSubtitleTracks = selectPlaybackSubtitleTracks(
      extractSubtitleTracks(data, locale)
    );
    localizeSubtitleTracks(rawSubtitleTracks).then((localizedTracks) => {
      if (sequence !== streamRequestSequence || id !== props.videoId) {
        revokeSubtitleTracks(localizedTracks);
        return;
      }
      revokeSubtitleTracks(subtitleTracks.value);
      subtitleTracks.value = localizedTracks;
    });
    if (!parsed || Object.keys(parsed.sources || {}).length === 0) {
      error.value = "利用可能なストリームがありません。";
      loading.value = false;
      return;
    }

    sources.value = parsed.sources;
    qualityLabels.value = parsed.qualityLabels || {};
    availableQualities.value = parsed.availableQualities || [];
    const preferred = (() => {
      try { return loadPreferredQuality(); } catch (e) { return "auto"; }
    })();
    const resolvePreferred = (pref, list) => {
      if (!pref || pref === "auto") return "";
      if (list.includes(pref)) return pref;
      const alt = `${pref}_2`;
      if (list.includes(alt)) return alt;
      return "";
    };
    const preferredResolved = resolvePreferred(preferred, availableQualities.value);
    selectedQuality.value = preferredResolved || parsed.defaultQuality || availableQualities.value[0] || "";
    hasM3u8.value = !!parsed.hasM3u8;

    // DOM 更新後のセットアップ
    nextTick().then(() => {
      if (sequence !== streamRequestSequence || id !== props.videoId) return;
      // decide actual playback mode for the selected quality:
      const sel = selectedQuality.value;
      const selEntry = sources.value[sel];

      const granted = (() => { try { return localStorage.getItem(USER_GESTURE_KEY) === '1'; } catch (e) { return false; } })();

      // ended リスナを確実に再attach
      if (videoRef.value) {
        try {
          videoRef.value.removeEventListener('ended', _onEnded);
          videoRef.value.addEventListener('ended', _onEnded);
          _onEndedAttached = true;
        } catch (e) {}
      }

      // If selected entry has single-stream URL and device can use it -> use single video flow
      if (isSingleStreamEntry(selEntry)) {
        try {
          if (videoRef.value) {
            applyVideoSources(videoRef.value, getSingleStreamSources(selEntry));
            videoRef.value.muted = !granted;
            if (autoplayEnabled.value) scheduleAutoplay();
          }
          attachBufferListeners();
          showUnmutePrompt.value = !granted;
          if (!granted) {
            window.addEventListener('click', onFirstUserGesture, { once: true });
            window.addEventListener('touchstart', onFirstUserGesture, { once: true });
          }
        } catch (e) {}
        // Add playback check
        if (videoRef.value) {
          videoRef.value.addEventListener('canplay', checkPlayback, { once: true });
        }
      } else if (isAudioOnlyEntry(selEntry)) {
        try {
          if (audioRef.value && selEntry.audio?.url) {
            const source = audioRef.value.querySelector('source');
            if (source) {
              source.src = selEntry.audio.url;
              if (selEntry.audio.mimeType) source.type = selEntry.audio.mimeType;
            } else {
              audioRef.value.src = selEntry.audio.url;
            }
            audioRef.value.load();
          }
          if (audioRef.value) {
            audioRef.value.muted = !granted;
            if (autoplayEnabled.value) scheduleAutoplay();
          }
          attachBufferListeners();
          showUnmutePrompt.value = !granted;
          if (!granted) {
            window.addEventListener('click', onFirstUserGesture, { once: true });
            window.addEventListener('touchstart', onFirstUserGesture, { once: true });
          }
        } catch (e) {}
        if (audioRef.value) {
          audioRef.value.addEventListener('canplay', checkPlayback, { once: true });
        }
      } else {
        // Use legacy video+audio synchronization if video URL exists
        if (selEntry?.video) {
          setupSyncPlayback(
            videoRef.value,
            audioRef.value,
            sources,
            selectedQuality,
            diffText,
            selectedPlaybackRate
          );
          try {
            if (videoRef.value) {
              videoRef.value.muted = !granted;
              if (autoplayEnabled.value) scheduleAutoplay();
            }
            if (audioRef.value) {
              audioRef.value.muted = !granted;
              if (autoplayEnabled.value) scheduleAutoplay();
            }
            attachBufferListeners();
            showUnmutePrompt.value = !granted;
            if (!granted) {
              window.addEventListener('click', onFirstUserGesture, { once: true });
              window.addEventListener('touchstart', onFirstUserGesture, { once: true });
            }
          } catch (e) {}
          // Add playback check
          if (videoRef.value) {
            videoRef.value.addEventListener('canplay', checkPlayback, { once: true });
          }
          if (audioRef.value) {
            audioRef.value.addEventListener('canplay', checkPlayback, { once: true });
          }
        }
      }
    });

    // 自動再生が有効なら候補IDだけ確認する（プリフェッチは行わない）
    try {
      if (autoplayEnabled.value) {
        // noop: 候補は ended 時にその場で選ぶ
        getAutoplayCandidateId();
      }
    } catch (e) {}

  } catch (err) {
    if (sequence !== streamRequestSequence || id !== props.videoId) return;
    loading.value = false;
    if (err && err.name === 'AbortError') {
      error.value = "ストリームURLの取得に失敗しました (タイムアウト)";
    } else {
      error.value = "ストリームURLの取得に失敗しました (fetch error)";
    }
    sources.value = {};
    availableQualities.value = [];
    selectedQuality.value = "";
  } finally {
    if (sequence === streamRequestSequence) loading.value = false;
  }
}

function markPlayerReady() {
  playerReady.value = true;
  playerBuffering.value = false;
}

function markPlayerPlaying() {
  playerReady.value = true;
  playerBuffering.value = false;
}

function markPlayerBuffering() {
  if (playerReady.value) playerBuffering.value = true;
}

watch(
  () => props.videoId,
  (newId) => {
    if (newId) {
      fetchStreamUrl(newId);
    } else {
      // videoId が空のときは取得をスキップ
    }
  },
  { immediate: true }
);

watch(selectedPlaybackRate, () => {
  if (videoRef.value) videoRef.value.playbackRate = selectedPlaybackRate.value;
  if (audioRef.value) audioRef.value.playbackRate = selectedPlaybackRate.value;
});

// videoRef の変化を監視して ended リスナの attach/detach を行う
watch(videoRef, (newEl, oldEl) => {
  if (oldEl && _onEndedAttached) {
    try { oldEl.removeEventListener('ended', _onEnded); } catch (e) {}
    _onEndedAttached = false;
  }
  if (newEl) {
    try {
      // リスナ追加前に既存のものがあれば削除
      newEl.removeEventListener('ended', _onEnded);
      newEl.addEventListener('ended', _onEnded);
      _onEndedAttached = true;
    } catch (e) {}
  }
}, { flush: 'post' });

</script>

<style scoped>
.video-container {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
  overflow: hidden;
}
.video-container video,
.video-container audio {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.audio-only {
  position: relative;
  width: 100%;
  height: auto;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.audio-only audio {
  padding-top: 200px;
  display: block;
  position: static;
  width: 100%;
  height: 48px;
}
.settings-box {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 20;
  background: rgba(0, 0, 0, 0.75);
  color: var(--on-accent);
  padding: 10px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  transition: opacity 0.3s ease;
}
.selector {
  background: var(--ui-dark);
  color: var(--on-accent);
  border: 1px solid var(--border-color);
  padding: 4px 8px;
  border-radius: 6px;
  margin-left: 6px;
}
.reload-button {
  margin-top: 6px;
  padding: 6px 15px;
  font-size: 9px;
  background: var(--text-type2-reload);
  color: var(--on-accent);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  width: 60%;
}
.reload-button:hover {
  background: var(--text-secondary-hover);
}
audio {
  display: none;
}
.block-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.315);
  pointer-events: all;
}

.unmute-prompt {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(128,128,128,0.6);
  color: var(--on-accent);
  padding: 8px 10px;
  border-radius: 6px;
  z-index: 50;
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.autoplay-disabled {
  color: rgba(255,255,255,0.5);
  position: relative;
}
.autoplay-disabled::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: rgba(255,255,255,0.6);
  transform: translateY(-50%);
  pointer-events: none;
}
</style>
