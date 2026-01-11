<template>
  <div v-if="error" class="error-box">
    ⚠️ {{ error }}
    <button @click="reloadStream" class="reload-button">再取得</button>
  </div>
  <div v-else-if="selectedQuality && availableQualities.length > 0" class="video-container">
    <!-- m3u8 再生が選択された端末かつ選択画質が HLS URL を持つ場合 -->
    <template v-if="useM3u8Playback() && sources[selectedQuality]?.url">
      <video
        ref="videoRef"
        controls
        :autoplay="autoplayEnabled"
        :loop="repeatEnabled"
        :src="sources[selectedQuality]?.url"
        type="application/x-mpegURL"
        :key="sources[selectedQuality]?.url"
      ></video>

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
              {{ q.replace('p', '') }}p
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

    <!-- その他: videourl (video+audio) の再生 -->
    <template v-else>
      <video ref="videoRef" preload="auto" :autoplay="autoplayEnabled" controls>
        <source :src="sources[selectedQuality]?.video?.url" :type="sources[selectedQuality]?.video?.mimeType" />
      </video>
      <div v-if="showUnmutePrompt" class="unmute-prompt" @click.stop="handleUnmuteClick">
        ミュートを解除する
      </div>
      <audio ref="audioRef" preload="auto" style="display:none;" autoplay>
        <source :src="sources[selectedQuality]?.audio?.url" :type="sources[selectedQuality]?.audio?.mimeType" />
      </audio>

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
              {{ q.replace('p', '') }}p
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
  </div>
  <div v-else-if="loading" style="height: 50px">読み込み中...</div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick, onBeforeUnmount } from "vue";
import { apiRequest } from "@/services/requestManager";
import { setupSyncPlayback } from "@/components/syncPlayback";

const props = defineProps({
  videoId: { type: String, required: true }
});
const emit = defineEmits(["ended", "play-autoplay-candidate"]);
function reloadStream() {
  fetchStreamUrl(props.videoId);
}

const error = ref("");
const sources = ref({});
const selectedQuality = ref("");
const availableQualities = ref([]);
const selectedPlaybackRate = ref(1.0);
const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];
const diffText = ref("0");
const videoRef = ref(null);
const audioRef = ref(null);
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
// window.__autoplayCandidates (配列) があればそこから選ぶ
// DOM 上に data-video-id 属性を持つ要素があれば上から選ぶ
function getAutoplayCandidateId() {
  try {
    const recent = new Set(loadPlayHistory());
    // avoid current video
    recent.add(props.videoId);

    // Get filter settings
    const filterConfig = window.__autoplayDurationFilter || { enabled: false, maxSeconds: 240 };
    const maxSeconds = filterConfig.enabled ? filterConfig.maxSeconds : Infinity;

    console.log(`[getAutoplayCandidateId] filterConfig:`, filterConfig, `maxSeconds: ${maxSeconds}`);

    // Helper function to check if a video passes duration filter
    function passesFilter(durationStr) {
      if (!filterConfig.enabled) {
        console.log(`    passesFilter: filter disabled → true`);
        return true; // No filter
      }
      if (!durationStr) {
        console.log(`    passesFilter: no duration info → true`);
        return true; // No duration info, allow it
      }
      const duration = parseInt(durationStr, 10);
      if (isNaN(duration)) {
        console.log(`    passesFilter: invalid duration "${durationStr}" → true`);
        return true; // Invalid duration, allow it
      }
      const passes = duration <= maxSeconds;
      console.log(`    passesFilter: ${duration}s <= ${maxSeconds}s? → ${passes}`);
      return passes;
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
      if (recent.has(id)) {
        console.log(`Checking video ${id}: SKIPPED (in recent history)`);
        continue;
      }
      
      foundAnyVideo = true;
      
      // Debug logging
      console.log(`Checking video ${id}: duration="${durationStr}"`);
      
      // Check duration filter - MUST pass filter to be selected
      if (!passesFilter(durationStr)) {
        console.log(`  → SKIPPED: duration exceeds limit`);
        continue; // Skip this video, duration exceeds limit or invalid
      }
      
      console.log(`  → SELECTED`);
      return id; // Found a suitable candidate
    }
    
    // No suitable candidate found - signal to parent
    if (foundAnyVideo && filterConfig.enabled) {
      // Videos exist but don't match filter criteria
      console.log(`[getAutoplayCandidateId] No suitable candidate found. Emitting autoplay-no-suitable-video`);
      emit('autoplay-no-suitable-video');
    }
  } catch (e) {
    console.error("getAutoplayCandidateId error:", e);
  }
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
  try { fetchStreamUrl(props.videoId); } catch (e) {}
});

onBeforeUnmount(() => {
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
    return nativeHlsSupported.value === true;
  } catch (e) { return false; }
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

  if (entry.url && useM3u8Playback()) {
    // HLS
    if (videoRef.value) {
      videoRef.value.src = entry.url;
      videoRef.value.load();
    }
  } else if (entry.video) {
    // video+audio
    if (videoRef.value && entry.video.url) {
      const source = videoRef.value.querySelector('source');
      if (source) source.src = entry.video.url;
      videoRef.value.load();
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
      console.log('Video playback failed, reloading src');
      reloadSrc();
    });
  }
  if (audioRef.value) {
    audioRef.value.play().catch(() => {
      console.log('Audio playback failed, reloading src');
      reloadSrc();
    });
  }
}

// HLS 切替時の共通セットアップ（再生位置を維持）
function applyHlsSetup(prevTime = 0) {
  isQualitySwitching.value = true;
  setTimeout(() => { isQualitySwitching.value = false; }, 1000);

  // pause before src swap (テンプレート側で :key により再レンダリングされる)
  try { if (videoRef.value) { prevTime = videoRef.value.currentTime || prevTime; videoRef.value.pause(); } } catch (e) {}
  try { if (audioRef.value) audioRef.value.pause(); } catch (e) {}

  nextTick(() => {
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
  const sel = selectedQuality.value;
  const entry = sources.value[sel];

  if (!entry) return;

  // If entry has HLS URL and device should use HLS
  if (entry.url && useM3u8Playback()) {
    // preserve position and apply HLS setup
    let prevTime = 0;
    try { if (videoRef.value) prevTime = videoRef.value.currentTime || 0; } catch (e) {}
    applyHlsSetup(prevTime);
    return;
  }

  // Otherwise use legacy video+audio sync flow (entry.video must exist)
  if (entry.video) {
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

async function fetchStreamUrl(id) {
  error.value = "";
  sources.value = {};
  selectedQuality.value = "";
  selectedPlaybackRate.value = 1.0;
  diffText.value = "0";
  availableQualities.value = [];
  loading.value = true;
  hasM3u8.value = false;

  try {
    const data = await apiRequest({
      params: { stream2: id },
      retries: 1,
      timeout: 30000,
      jsonpFallback: false,
    });

    // parse videourl and m3u8 into separate maps
    let srcs = {}; // progressive: { video: {url,mimeType}, audio: {...} }
    let qualities = [];
    let m3u8srcs = {}; // hls: { url, mimeType }
    let m3u8Qualities = [];

    // videourl: support array/object
    if (Array.isArray(data.videourl)) {
      data.videourl.forEach((item) => {
        const key = Object.keys(item)[0];
        if (/^\d{3,4}p$/.test(key)) {
          qualities.push(key);
          const vv = item[key];
          srcs[key] = {
            video: { url: vv.video?.url, mimeType: vv.video?.mimeType || "video/mp4" },
            audio: { url: vv.audio?.url, mimeType: vv.audio?.mimeType || "audio/webm" }
          };
        }
      });
    } else if (typeof data.videourl === 'object' && data.videourl !== null) {
      Object.keys(data.videourl).forEach((key) => {
        if (/^\d{3,4}p$/.test(key)) {
          qualities.push(key);
          const vv = data.videourl[key];
          srcs[key] = {
            video: { url: vv.video?.url, mimeType: vv.video?.mimeType || "video/mp4" },
            audio: { url: vv.audio?.url, mimeType: vv.audio?.mimeType || "audio/webm" }
          };
        }
      });
    }

    // m3u8: support array/object
    if (Array.isArray(data.m3u8)) {
      data.m3u8.forEach((item) => {
        const key = Object.keys(item)[0];
        if (/^\d{3,4}p$/.test(key)) {
          let murl = item[key]?.url;
          if (typeof murl === 'object' && murl?.url) murl = murl.url;
          if (murl) {
            m3u8Qualities.push(key);
            m3u8srcs[key] = { url: murl, mimeType: "application/x-mpegURL" };
          }
        }
      });
    } else if (typeof data.m3u8 === 'object' && data.m3u8 !== null) {
      Object.keys(data.m3u8).forEach((key) => {
        if (/^\d{3,4}p$/.test(key)) {
          let murl = data.m3u8[key]?.url;
          if (typeof murl === 'object' && murl?.url) murl = murl.url;
          if (murl) {
            m3u8Qualities.push(key);
            m3u8srcs[key] = { url: murl, mimeType: "application/x-mpegURL" };
          }
        }
      });
    }

    hasM3u8.value = m3u8Qualities.length > 0;

    const allQualSet = new Set([...(qualities || []), ...(m3u8Qualities || [])]);
    let allQuals = Array.from(allQualSet).sort((a,b) => parseInt(b) - parseInt(a));

    // Build sources but keep types distinct: HLS entries have .url, progressive entries have .video/.audio
    const combined = {};
    allQuals.forEach((q) => {
      if (m3u8srcs[q]) {
        combined[q] = { url: m3u8srcs[q].url, mimeType: m3u8srcs[q].mimeType };
      }
      if (srcs[q]) {
        // If both exist, keep both; progressive under .video/.audio, hls under .url
        combined[q] = Object.assign({}, combined[q] || {}, srcs[q]);
      }
    });

    if (Object.keys(combined).length === 0) {
      error.value = "利用可能なストリームがありません。";
      loading.value = false;
      return;
    }

    // decide default quality
    const defaultQuality = ["1080p","720p","480p"].find(q => allQuals.includes(q)) || allQuals[0];

    sources.value = combined;
    availableQualities.value = allQuals;
    selectedQuality.value = defaultQuality || Object.keys(combined)[0];

    // DOM 更新後のセットアップ
    nextTick().then(() => {
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

      // If selected entry has HLS URL and device can/wants HLS -> use single video HLS flow
      if (selEntry?.url && useM3u8Playback()) {
        try {
          if (videoRef.value) {
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
    loading.value = false;
  }
}

watch(
  () => props.videoId,
  (newId) => {
    if (newId) fetchStreamUrl(newId);
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
