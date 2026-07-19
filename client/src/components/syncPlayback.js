export function setupSyncPlayback(video, audio, sources, selectedQuality, diffText, selectedPlaybackRate) {
  if (!video || !audio) return;

  // Safari/WebKit判定（iOS系は全ブラウザでWebKitのためSafari扱い）
  function isSafariLike() {
    const ua = navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    if (isIOS) return true;
    const isMac = /Macintosh/.test(ua);
    if (!isMac) return false;
    return /Safari/.test(ua) && !/(Chrome|Chromium|Edg|OPR|Brave|Vivaldi)/.test(ua);
  }
  const safariMode = isSafariLike();

  function normalizeSources(v) {
    if (!v) return [];
    if (Array.isArray(v.sources) && v.sources.length > 0) {
      return preferH264First(v.sources
        .map((s) => ({
          url: typeof s === "string" ? s : (s?.url || ""),
          mimeType: typeof s === "string" ? "" : (s?.mimeType || ""),
        }))
        .filter((s) => s.url));
    }
    if (typeof v === "string") return preferH264First([{ url: v, mimeType: "" }]);
    if (v.url) return preferH264First([{ url: v.url, mimeType: v.mimeType || "" }]);
    return [];
  }

  function preferH264First(list) {
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
  }

  function clearMediaSources(media) {
    if (!media) return;
    const sources = media.querySelectorAll(":scope > source");
    sources.forEach((source) => {
      source.removeAttribute("src");
      source.removeAttribute("type");
      source.remove();
    });
    media.removeAttribute("src");
    media.load();
  }

  function setMediaSources(media, sourcesList) {
    if (!media) return;
    media.querySelectorAll(":scope > source").forEach((source) => source.remove());
    if (Array.isArray(sourcesList) && sourcesList.length > 0) {
      for (const s of sourcesList) {
        if (!s || !s.url) continue;
        const source = document.createElement("source");
        source.src = s.url;
        if (s.mimeType) source.type = s.mimeType;
        media.appendChild(source);
      }
    } else {
      media.src = "";
    }
    media.load();
  }

  // 以前の同期ループを無効化（古いループを止める）
  const syncToken = (video.__syncPlaybackToken || 0) + 1;
  video.__syncPlaybackToken = syncToken;
  const isActive = () => video.__syncPlaybackToken === syncToken;

  let videoSrc, audioSrc;
  if (selectedQuality.value !== "muxed360p" && sources.value[selectedQuality.value]) {
    videoSrc = sources.value[selectedQuality.value].video;
    audioSrc = sources.value[selectedQuality.value].audio;
  } else if (sources.value.separateHigh) {
    videoSrc = sources.value.separateHigh.video;
    audioSrc = sources.value.separateHigh.audio;
  } else {
    return;
  }
  const videoSources = normalizeSources(videoSrc);
  const audioSources = normalizeSources(audioSrc);
  const audioUrl = audioSources[0]?.url || "";
  const audioMime = audioSources[0]?.mimeType || "";

  if (safariMode) {
    video.pause();
    audio.pause();
    clearMediaSources(video);
    clearMediaSources(audio);

    // 新しいソースをセット
    setMediaSources(video, videoSources);
    setMediaSources(audio, audioUrl ? [{ url: audioUrl, mimeType: audioMime }] : []);

    // 初期倍速反映
    video.playbackRate = selectedPlaybackRate.value;
    audio.playbackRate = selectedPlaybackRate.value;

    // イベント登録（上書き）
    video.onplay = () => {
      video.playbackRate = selectedPlaybackRate.value;
      audio.playbackRate = selectedPlaybackRate.value;
      if (audio.paused) audio.play().catch(() => {});
    };
    audio.onplay = () => {
      video.playbackRate = selectedPlaybackRate.value;
      audio.playbackRate = selectedPlaybackRate.value;
      if (video.paused) video.play().catch(() => {});
    };
    video.onpause = () => {
      if (!audio.paused) audio.pause();
    };
    audio.onpause = () => {
      if (!video.paused) video.pause();
    };
    video.onseeking = () => {
      audio.currentTime = video.currentTime;
    };

    // 再生再開時にも音声再生を保証
    video.onplaying = () => {
      if (audio.paused) audio.play().catch(() => {});
    };

    // --- Safari用：緩い同期補正 ---
    let lastJumpTime = 0;
    const jumpInterval = 1000; // ms
    function looseSync() {
      if (!isActive()) return;
      if (!video.paused) {
        // 音声が流れていない場合は再生
        if (audio.paused) {
          audio.play().catch(() => {});
        }
        const diff = video.currentTime - audio.currentTime;
        diffText.value = `${(diff * 1000).toFixed(0)} ms`;

        // ±0.5秒は何もしない
        if (Math.abs(diff) <= 0.5) {
          audio.playbackRate = selectedPlaybackRate.value;
          if (audio.paused) {
            audio.play().catch(() => {});
          }
        }
        // 1秒以上ズレたらジャンプ（1000msに1回だけ）
        else if (Math.abs(diff) >= 1) {
          const now = performance.now();
          if (now - lastJumpTime > jumpInterval) {
            audio.currentTime = video.currentTime;
            audio.playbackRate = selectedPlaybackRate.value;
            lastJumpTime = now;
          }
        }
        // 0.5秒～1秒の間は再生速度で補正
        else {
          // 最大±10%だけ補正
          const rateAdjust = 1 + Math.min(Math.abs(diff) / 1, 0.1) * (diff > 0 ? 1 : -1);
          audio.playbackRate = selectedPlaybackRate.value * rateAdjust;
        }
      }
      requestAnimationFrame(looseSync);
    }
    requestAnimationFrame(looseSync);

    return; // Safariはここで終了
  }

  // --- ここから非 Safari 用の既存同期処理 ---
  // 画質変更時は必ず pause して src をクリア
  video.pause();
  audio.pause();
  clearMediaSources(video);
  clearMediaSources(audio);
  // 新しいソースをセット
  setMediaSources(video, videoSources);
  setMediaSources(audio, audioUrl ? [{ url: audioUrl, mimeType: audioMime }] : []);

  let isStartupJumpDone = false;
  let isBuffering = false;
  let isSyncingPlayback = false;
  let lastJumpTime = 0;
  const jumpCooldown = 500; // ms

  function jumpAudioToVideo() {
    const now = performance.now();
    if (now - lastJumpTime < jumpCooldown) return;
    const target = Math.max(0, video.currentTime - 0.05);
    audio.currentTime = target;
    lastJumpTime = now;
  }

  function correctPlaybackRate(diff) {
    const abs = Math.abs(diff);

    if (safariMode) {
      let maxAdjust = 0.1;
      if (abs >= 2) {
        jumpAudioToVideo();
        return;
      }
      if (abs < 0.01) {
        audio.playbackRate = 1.0;
      } else if (abs < 0.1) {
        audio.playbackRate = diff > 0 ? 1.02 : 0.98;
      } else if (abs < 1.5) {
        audio.playbackRate = diff > 0 ? 1.06 : 0.94;
      } else if (abs < 2.0) {
        audio.playbackRate = diff > 0 ? 1.1 : 0.9;
      } else {
        audio.playbackRate = 1.0;
        jumpAudioToVideo();
      }
      if (abs < 0.015) {
        audio.playbackRate = selectedPlaybackRate.value;
        return;
      }
      const adjustmentRatio = abs / 1.5;
      const rateAdjust = 1 + adjustmentRatio * maxAdjust * (diff > 0 ? 1 : -1);
      audio.playbackRate = selectedPlaybackRate.value * rateAdjust;
      return;
    }

    if (performance.now() - lastJumpTime < jumpCooldown) {
      audio.playbackRate = selectedPlaybackRate.value;
      return;
    }
    if (abs >= 0.9) {
      jumpAudioToVideo();
      return;
    }

    let maxAdjust;
    if (abs >= 0.8) {
      maxAdjust = 0.85;
    } else if (abs >= 0.1) {
      maxAdjust = 0.75;
    } else {
      maxAdjust = 0.015;
    }

    if (abs < 0.015) {
      audio.playbackRate = selectedPlaybackRate.value;
      return;
    }

    const adjustmentRatio = abs / 0.9;
    const rateAdjust = 1 + adjustmentRatio * maxAdjust * (diff > 0 ? 1 : -1);
    audio.playbackRate = selectedPlaybackRate.value * rateAdjust;
  }

  // 再生・停止イベント
  async function playBoth(withJump = false) {
    if (isSyncingPlayback) return;
    isSyncingPlayback = true;
    try {
      if (video.paused) await video.play();
      if (audio.paused) await audio.play();
      if (withJump) jumpAudioToVideo();
    } catch (e) {
      // 再生失敗時は何もしない
    } finally {
      isSyncingPlayback = false;
    }
  }

  async function pauseBoth() {
    if (isSyncingPlayback) return;
    isSyncingPlayback = true;
    try {
      video.pause();
      audio.pause();
    } finally {
      isSyncingPlayback = false;
    }
  }

  audio.onplay = () => playBoth(true);
  video.onpause = () => pauseBoth();
  audio.onpause = () => pauseBoth();

  video.onwaiting = () => {
    isBuffering = true;
    if (!audio.paused) audio.pause();
  };

  video.onplaying = () => {
    // Safari: 映像再生再開時に音声も再生
    if (safariMode) {
      if (audio.paused && !isSyncingPlayback) {
        audio.play().catch(() => {});
      }
    }
    // 既存の処理
    if (isBuffering) {
      isBuffering = false;
      jumpAudioToVideo();
      if (video.paused) return;
      if (audio.paused && !isSyncingPlayback) {
        audio.play().catch(() => {});
      }
    }
  };

  // 再生開始
  video.onplay = () => {
    playBoth(true);
    video.playbackRate = selectedPlaybackRate.value;
    audio.playbackRate = selectedPlaybackRate.value; // 先に設定

    if (video.readyState >= 2) {
      if (audio.paused && !isSyncingPlayback) {
        // audio.play() の直後は playbackRate を変更しない
        audio.play().catch(() => {});
      }
    } else {
      const onCanPlay = () => {
        if (audio.paused && !isSyncingPlayback) {
          audio.play().catch(() => {});
        }
        video.removeEventListener("canplay", onCanPlay);
      };
      video.addEventListener("canplay", onCanPlay);
    }
    if (!isStartupJumpDone) {
      setTimeout(() => {
        jumpAudioToVideo();
        isStartupJumpDone = true;
      }, 100);
    }
  };

  video.onseeking = () => {
    setTimeout(() => jumpAudioToVideo(), 100);
  };

  function syncLoop() {
    if (!isActive()) return;
    if (!video.paused && !audio.paused) {
      const diff = video.currentTime - audio.currentTime;
      diffText.value = `${(diff * 1000).toFixed(0)} ms`;
      correctPlaybackRate(diff);
    }
    requestAnimationFrame(syncLoop);
  }
  requestAnimationFrame(syncLoop);

  // 初期倍速反映
  video.playbackRate = selectedPlaybackRate.value;
  audio.playbackRate = selectedPlaybackRate.value;
}
