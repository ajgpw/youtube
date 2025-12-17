<template>
  <section v-if="error" class="error-message" style="color: var(--text-primary);">
    プレイリストの取得に失敗しました。
  </section>

  <section v-else-if="playlist" class="playlist-section" :class="`type-${displayType}`">
    <template v-if="displayType !== 'channel'">
      <h2 class="playlist-title" style="color: var(--text-primary);">{{ playlist.title }}</h2>
      <p class="playlist-meta" style="color: var(--text-primary);">
        動画本数: {{ playlist.totalItems }}
        <span  class="views"  v-if="displayType !== 'watch' && playlist.views">  ｜ {{ playlist.views }}</span>      </p>
    </template>

    <div
      ref="scrollContainer"
      class="playlist-items-scroll"
      :class="`scroll-${displayType}`"
    >
      <div
        v-for="(item, idx) in playlist.items"
        :key="item.videoId || idx"
        class="playlist-item"
        :class="{ active: item.videoId === playVideoId }"
        :data-video-id="item.videoId"
      >
        <router-link :to="displayType !== 'channel' ? `/watch?v=${item.videoId}&list=${playlist.playlistId}` : `/watch?v=${item.videoId}`" class="video-link">
          
          <div v-if="displayType === 'watch'" class="watch-layout" style="margin-block-end: 0px; margin-block-start: 0px;">
            <div class="thumbnail-wrapper small-thumb">
              <img
                :src="item.thumbnail || getPrimaryThumbnail(item.videoId)"
                alt="動画サムネイル"
                class="thumbnail"
                @error="onImageError($event, item.videoId)"
              />
              <span class="duration" v-if="item.duration">{{ item.duration }}</span>
            </div>
            <div class="text-content">
              <p class="title" :title="item.title" style="margin-block-end: 0px; margin-block-start: 0px; padding-top: 7px;">{{ item.title }}</p>
              <p class="author" style="margin-block-end: 0px; margin-block-start: 5px;">{{ item.author }}</p>
              <p class="meta-info" style="margin-block-end: 0px;" v-if="item.views || item.published">
                <span v-if="item.views">{{ item.views }}</span>
                <span v-if="item.views && item.published"> • </span>
                <span v-if="item.published">{{ item.published }}</span>
              </p>
              </div>
          </div>

          <div v-else>
            <div class="thumbnail-wrapper">
              <img
                :src="item.thumbnail || getPrimaryThumbnail(item.videoId)"
                alt="動画サムネイル"
                class="thumbnail"
                @error="onImageError($event, item.videoId)"
              />
              <span class="duration" v-if="item.duration">{{ item.duration }}</span>
            </div>
            <p class="title" :title="item.title">{{ item.title }}</p>
            <p class="author" style="margin-block-end: 0px;">{{ item.author }}</p>
            <p class="meta-info" v-if="item.views || item.published">
              <span v-if="item.views">{{ item.views }}</span>
              <span v-if="item.views && item.published"> • </span>
              <span v-if="item.published">{{ item.published }}</span>
            </p>
            </div>
        </router-link>
      </div>
    </div>
  </section>

  <section v-else>
    <p style="color: var(--text-primary);">プレイリストを読み込み中...</p>
  </section>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import { useRoute } from "vue-router";
import { apiRequest } from "@/services/requestManager";

const props = defineProps({
  playlistId: String,
  playVideoId: String,
  displayType: {
    type: String,
    default: "default",
  },
});

const route = useRoute();

const playlist = ref(null);
const loading = ref(false);
const error = ref(false);

const scrollContainer = ref(null);

const playlistId = computed(() => props.playlistId || route.query.list || "");
const playVideoId = computed(() => props.playVideoId || route.query.play || "");
const displayType = computed(() => props.displayType || route.query.type || "default");

onMounted(async () => {
  if (!playlistId.value) {
    console.error("playlistId が指定されていません");
    error.value = true;
    return;
  }

  loading.value = true;
  error.value = false;

  try {
    const isCustomPlaylist = playlistId.value.startsWith('local-');
    let data;

    data = await apiRequest({
      params: { playlist: playlistId.value },
      retries: 1,
      timeout: 30000,
      jsonpFallback: true,
    });

    playlist.value = data;

    if (displayType.value !== "watch" && displayType.value !== "channel" && playlist.value?.title) {
      document.title = `${playlist.value.title} - プレイリスト`;
    }

    await nextTick();
    if (playVideoId.value && scrollContainer.value) {
      const containerEl = scrollContainer.value;
      const target = containerEl.querySelector(`.playlist-item[data-video-id="${playVideoId.value}"]`);
      if (target) {
        const containerRect = containerEl.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const relativeTop = targetRect.top - containerRect.top;
        const scrollOffset =
          containerEl.scrollTop + relativeTop - containerEl.clientHeight / 2 + target.clientHeight / 2;
        containerEl.scrollTo({ top: scrollOffset, behavior: 'smooth' });
      }
    }
  } catch (err) {
    console.error("プレイリスト取得失敗:", err);
    error.value = true;
  } finally {
    loading.value = false;
  }
});

function getPrimaryThumbnail(id) {
  return `https://i.ytimg.com/vi/${id}/sddefault.jpg`;
}

function onImageError(event, id) {
  if (!event.target.dataset.error) {
    event.target.src = `https://i.ytimg.com/vi/${id}/sddefault.jpg`;
    event.target.dataset.error = "true";
  }
}
</script>

<style scoped>
/* 既存のスタイル */
.playlist-item.active {
  background-color: var(--hover-bg);
  transition: background-color 0.2s ease;
}

.playlist-section {
  max-width: 100%;
  margin: 0 auto;
  padding: 0.9rem;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.type-watch {
  background-color: transparent;
  border: 1px solid var(--border-color); 
  border-radius: 8px;
  padding: 0.9rem;
  max-width: 360px;
}

.playlist-title {
  font-size: 1.4rem;
  margin-bottom: 0.2rem;
  margin-block-start:0.3em;
  color: var(--text-primary);
}

.playlist-meta {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.scroll-default,
.scroll-channel {
  display: grid;
  grid-template-columns: repeat(auto-fill, 210px);
  justify-content: center;
  gap: 12px;
  padding-bottom: 1rem;
}

.scroll-watch {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: 420px;
  padding-right: 6px;
}

.playlist-item {
  width: 210px;
  flex-shrink: 0;
}

.type-watch .playlist-item {
  width: 100%;
}

.video-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.thumbnail-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 0.5rem;
  margin-block: 10px;
  background-color: var(--bg-secondary);
}

.thumbnail-wrapper.small-thumb {
  width: 160px;
  aspect-ratio: 16 / 9;
  flex-shrink: 0;
}

.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.duration {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: 0.75rem;
  color: var(--on-accent);
  background-color: rgba(0, 0, 0, 0.7);
  padding: 2px 5px;
  border-radius: 4px;
}

.title {
  font-size: 0.9rem;
  font-weight: 600;
  text-align: left;
  margin-top: 1;
  line-height: 1.3;
  max-height: calc(1.3em * 2); 
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  text-overflow: ellipsis;
  white-space: normal;
  margin-left: 2px;
  color: var(--text-primary);
}

.author {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 2px;
}

.meta-info {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 2px;
  margin-top: 2px;
}

.watch-layout {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.text-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  flex: 1;
}

@media (max-width: 600px) {
  .playlist-item {
    width: 100%;
  }
}

.error-message {
  color: var(--accent-weak);
  padding: 1rem;
  text-align: center;
}
</style>