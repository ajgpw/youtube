<template>
  <section class="channel-view" v-if="channel && channel.title">
    <!-- バナー -->
    <div
      class="banner"
      :style="{ backgroundImage: loadingChannel ? '' : `url(${channel.banner || defaultBanner})` }"
    >
      <div v-if="loadingChannel" class="skeleton"></div>
    </div>

    <!-- チャンネル概要 -->
    <div class="channel-header">
      <div class="avatar-wrapper">
        <img
          v-if="!loadingChannel"
          :src="channel.avatar || defaultAvatar"
          alt="チャンネルアイコン"
          class="avatar"
        />
        <div v-else class="skeleton avatar"></div>
      </div>
      <div class="info">
        <div v-if="!loadingChannel" style="display:flex;align-items:center;gap:12px;">
          <h1 style="font-size: 2.1em; margin-block-end: 0.4em; margin:0">{{ channel.title }}</h1>
          <button class="subscribe-btn" :class="{ subscribed }" @click="toggleSubscribeOnChannel" :title="subscribed ? '登録解除' : '登録'">{{ subscribed ? '登録解除' : '登録' }}</button>
        </div>
        <div v-else class="skeleton skeleton-text" style="width: 60%; height: 2.1em; margin-bottom: 0.4em;"></div>
        <p v-if="!loadingChannel" class="video-count">{{ channel.videoCount }}</p>
        <div v-else class="skeleton skeleton-text" style="width: 30%; height: 1.2em; margin-bottom: 0.4em;"></div>
        <p v-if="!loadingChannel" class="description">{{ channel.description }}</p>
        <div v-else class="skeleton skeleton-text" style="width: 90%; height: 2em;"></div>
      </div>
    </div>

    <!-- タブ -->
    <div class="tabs">
      <div
        :class="{ active: tab === 'home' }"
        role="button"
        tabindex="0"
        @click="tab = 'home'"
        @keydown.enter.space.prevent="tab = 'home'"
        style="margin-right: 24px;"
      >
        <span v-if="!loadingChannel">ホーム</span>
        <span v-else class="skeleton skeleton-text" style="width: 60px; height: 1.3em;"></span>
      </div>
      <div
        :class="{ active: tab === 'videos' }"
        role="button"
        tabindex="0"
        @click="tab = 'videos'"
        @keydown.enter.space.prevent="tab = 'videos'"
      >
        <span v-if="!loadingChannel">動画</span>
        <span v-else class="skeleton skeleton-text" style="width: 60px; height: 1.3em;"></span>
      </div>
    </div>

    <!-- ホームタブ -->
    <div v-if="tab === 'home'" class="tab-content">
      <!-- トップ動画 -->
      <section class="top-video" v-if="channel.topVideo?.videoId">
        <router-link
          :to="`/watch?v=${channel.topVideo.videoId}`"
          class="top-video-link"
        >
          <div class="thumbnail-wrapper">
            <img
              v-if="!loadingChannel"
              :src="getPrimaryThumbnail(channel.topVideo.videoId)"
              alt="トップ動画サムネイル"
              class="thumbnail"
              @error="onImageError($event, channel.topVideo.videoId)"
            />
            <div v-else class="skeleton" style="width: 100%; height: 100%;"></div>
            <span class="duration" v-if="channel.topVideo.duration && !loadingChannel">
              {{ channel.topVideo.duration }}
            </span>       
            <div v-else-if="loadingChannel" class="skeleton skeleton-text" style="width: 40px; height: 1em; position: absolute; bottom: 6px; right: 6px;"></div>
          </div>
          <div class="top-video-info">
            <h3 v-if="!loadingChannel" style="margin-block-start: 0em; font-size: 1.45em; margin-block-end: 0.5em;">{{ channel.topVideo.title }}</h3>
            <div v-else class="skeleton skeleton-text" style="width: 70%; height: 1.45em; margin-bottom: 0.5em;"></div>
            <p v-if="!loadingChannel"><strong>再生回数:</strong> {{ channel.topVideo.viewCount }}</p>
            <div v-else class="skeleton skeleton-text" style="width: 40%; height: 1em;"></div>
            <p v-if="!loadingChannel"><strong>投稿日:</strong> {{ channel.topVideo.published }}</p>
            <div v-else class="skeleton skeleton-text" style="width: 40%; height: 1em;"></div>
            <p v-if="!loadingChannel" class="description-text" v-html="channel.topVideo.description"></p>
            <div v-else class="skeleton skeleton-text" style="width: 90%; height: 2em;"></div>
          </div>
        </router-link>
      </section>

      <section class="playlists">
        <div
          v-for="(playlist, index) in channel.playlists"
          :key="playlist.playlistId || index"
          class="playlist-wrapper"
        >
          <h2 class="playlist-title">
            <span v-if="!loadingChannel">{{ playlist.title }}</span>
            <span v-else class="skeleton skeleton-text" style="width: 40%; height: 1.2em;"></span>
            <router-link v-if="playlist.playlistId && !loadingChannel" :to="`/playlist?list=${playlist.playlistId}`" class="playlist-video-link-to">▶ 全てを再生<span style="font-size: small; color: var(--text-secondary);">(プレイリスト再生モード)</span></router-link>
            <span v-else-if="loadingChannel" class="skeleton skeleton-text" style="width: 80px; height: 1em; margin-left: 10px;"></span>
          </h2>
          <div class="playlist-items-scroll">
            <div
              v-for="(item, idx) in playlist.items"
              :key="item.videoId || idx"
              class="playlist-item"
            >
              <router-link :to="item.icon ? `/channel/${item.videoId}` : `/watch?v=${item.videoId}`" class="video-link">
                <div class="thumbnail-wrapper small-thumb">
                  <div>
                    <!-- icon がある場合 -->
                    <template v-if="item.icon && !loadingChannel">
                      <div class="center">
                        <a :to="`/channel/${item.videoId}`">
                          <img
                            :src="item.icon"
                            alt="チャンネルアイコン"
                            class="round"
                          />
                        </a>
                      </div>
                    </template>
                    <template v-else-if="item.icon && loadingChannel">
                      <div class="skeleton round"></div>
                    </template>
                    <!-- icon がない場合 -->
                    <template v-else-if="!item.icon && !loadingChannel">
                      <img
                        :src="item.thumbnail || getPrimaryThumbnail(item.videoId)"
                        alt="動画サムネイル"
                        class="thumbnail"
                        @error="onImageError($event, item.videoId)"
                      />
                    </template>
                    <template v-else>
                      <div class="skeleton thumbnail"></div>
                    </template>
                  </div>
                  <span class="duration" v-if="item.duration && !loadingChannel">{{ item.duration }}</span>
                  <div v-else-if="loadingChannel" class="skeleton skeleton-text" style="width: 40px; height: 1em; position: absolute; bottom: 6px; right: 6px;"></div>
                </div>
                <p v-if="item.icon && !loadingChannel" class="center-text">{{ item.title }}</p>
                <div v-else-if="item.icon && loadingChannel" class="skeleton skeleton-text center-text" style="width: 60%; height: 1em;"></div>
                <p :class="title" v-if="!item.icon && !loadingChannel" class="left-text" style="font-weight: 600;">{{ item.title }}</p>
                <div v-else-if="!item.icon && loadingChannel" class="skeleton skeleton-text left-text" style="width: 80%; height: 1em;"></div>
                <p class="author" v-if="!item.icon && !loadingChannel">{{ item.author }}</p>
                <div v-else-if="!item.icon && loadingChannel" class="skeleton skeleton-text left-text" style="width: 40%; height: 1em;"></div>
                <p class="meta" :class="item.icon ? 'center-text' : 'left-text'" v-if="!loadingChannel">{{ item.viewCount }}<template v-if="item.published">・{{ item.published }}</template></p>
                <div v-else class="skeleton skeleton-text" style="width: 60%; height: 1em;"></div>
              </router-link>
            </div>
          </div>
        </div>
      </section>
    </div>
    <!-- 動画タブ -->
    <div v-else-if="tab === 'videos'" class="tab-content">
        <VideoList :playlist-id="channel.uploadsPlaylistId" displayType="channel" />
    </div>
  </section>
  <section v-else-if="loadingChannel" class="loading">
    読み込み中...<br>読み込む速度を早くする方法。↓<br>右上の設定マークからカスタムエンドポイントのを追加してください　＊方法は簡単で1~3分で作れます。
  </section>
  <section v-else class="error-section">
    <div class="skeleton" style="width: 100%; height: 180px; margin-bottom: 24px;"></div>
    <div class="skeleton skeleton-text" style="width: 60%; height: 2.1em; margin: 0 auto 16px auto;"></div>
    <div class="skeleton skeleton-text" style="width: 30%; height: 1.2em; margin: 0 auto 16px auto;"></div>
    <div class="skeleton skeleton-text" style="width: 90%; height: 2em; margin: 0 auto 16px auto;"></div>
    <p style="color: var(--accent-weak); margin: 24px 0;">チャンネル情報の取得に失敗しました。</p>
    <button class="reload-btn" @click="reloadChannel">再取得</button>
  </section>
  <div v-if="tab === 'home'" class="page-end">
    <div>
      <br>
      <p v-if="!loadingChannel" style="color: var(--text-primary);">すべての動画を見るには「動画」セクションに移動してください</p>
      <div v-else class="skeleton skeleton-text" style="width: 60%; height: 1em; margin: 0 auto;"></div>
    </div>
    <div class="tabs">
      <div
        :class="{ active: tab === 'videos' }"
        class="page-end-tab"
        role="button"
        tabindex="0"
        @click="tab = 'videos'"
        @keydown.enter.space.prevent="tab = 'videos'"
      >
        <span v-if="!loadingChannel">動画セクションに移動<img :src="settingIcon" width="21" height="21"></span>
        <span v-else class="skeleton skeleton-text" style="width: 120px; height: 1.3em;"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import settingIcon from '/Image/linkicon.txt?raw'
import { ref, onMounted, watch, computed, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import VideoList from "@/components/Playlist.vue";
import { apiRequest } from "@/services/requestManager";
import subscriptionManager from '@/utils/subscriptionManager';

const props = defineProps({ channelId: String });

// ルートパラメータ
const route = useRoute();
const effectiveId = computed(() => props.channelId || route.params.id);

// 状態
const channel = ref(null);
const tab = ref("home");
const loadingChannel = ref(false);
const subscribed = ref(false);

function updateSubscribed() {
  subscribed.value = subscriptionManager.isSubscribed(effectiveId.value);
}

async function toggleSubscribeOnChannel() {
  try {
    const id = effectiveId.value;
    if (!id) return;
    if (subscriptionManager.isSubscribed(id)) {
      subscriptionManager.removeSubscription(id);
      subscribed.value = false;
      try { window.dispatchEvent(new CustomEvent('subscriptions-changed')); } catch(e){}
    } else {
      // Optimistically add (use avatar URL if present so the icon displays immediately)
      const initialIcon = channel.value?.avatar || null;
      subscriptionManager.addSubscription({ id, name: channel.value?.title || '', icon: initialIcon });
      subscribed.value = true;
      try { window.dispatchEvent(new CustomEvent('subscriptions-changed')); } catch(e){}
      // Fetch icon async
      (async () => {
        try {
          const icon = channel.value?.avatar ? await subscriptionManager.fetchImageAsBase64(channel.value.avatar) : null;
          if (icon) {
            subscriptionManager.updateSubscription(id, { icon });
          } else if (channel.value?.avatar) {
            subscriptionManager.updateSubscription(id, { icon: channel.value.avatar });
          }
        } catch (e) {
          console.warn('icon fetch failed', e);
        }
      })();
    }
  } catch (e) {
    console.error('toggleSubscribeOnChannel error', e);
  }
}

// デフォルト画像
const defaultAvatar = "/default-avatar.png";
const defaultBanner = "/default-banner.png";

// 関数
function getPrimaryThumbnail(id) {
  return `https://i.ytimg.com/vi/${id}/sddefault.jpg`;
}

function onImageError(event, id) {
  if (!event.target.dataset.error) {
    event.target.src = `https://i.ytimg.com/vi/${id}/sddefault.jpg`;
    event.target.dataset.error = true;
  }
}

function fetchChannelInfo(channelId) {
  loadingChannel.value = true;
  channel.value = null;
  apiRequest({
    params: { channel: channelId },
    method: "GET",
    retries: 2,
    timeout: 15000,
  })
    .then((data) => {
      channel.value = data;
    })
    .catch((err) => {
      console.error("チャンネル情報取得失敗:", err);
      channel.value = null;
    })
    .finally(() => {
      loadingChannel.value = false;
    });
}

function reloadChannel() {
  fetchChannelInfo(route.params.id);
}

// 初回取得
onMounted(() => {
  fetchChannelInfo(effectiveId.value);
  updateSubscribed();
  window.addEventListener('subscriptions-changed', updateSubscribed);
  window.addEventListener('storage', (e) => {
    if (e.key === 'subscriptions_v1') updateSubscribed();
  });
});

// ID変更時（prop かルートどちらでも追跡）
watch(
  () => effectiveId.value,
  (newId, oldId) => {
    if (newId !== oldId) {
      fetchChannelInfo(newId);
      updateSubscribed();
      window.scrollTo(0, 0);
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('subscriptions-changed', updateSubscribed);
});

// channel変更時にタイトル更新
watch(
  () => channel.value,
  (newChannel) => {
    document.title = newChannel?.title || "読み込み中…";
  },
  { immediate: true }
);
</script>

<style scoped>
.page-end-tab{
  margin: 0 auto;
  text-decoration: underline;
  font-size: 21px;
}

.subscribe-btn{
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}
.subscribe-btn.subscribed{
  background: var(--accent-color);
  color: var(--on-accent);
  border-color: rgba(0,0,0,0.05);
}
.page-end {
  text-align: center;
}

.left-text {
  font-size: 1.1rem;
  margin-block-end: 0.1em;
  margin-top: 1;
  line-height: 1.3;
  max-height: calc(1.3em * 2); 
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  text-overflow: ellipsis;
  white-space: normal;
}

.center-text {
  text-align: center;
}

.left-text {
  text-align: left;
  font-size: 18px;
}

.center {
  text-align: center;
}

.round {
  width: 103px;
  height: 103px;
  border-radius: 50%;
  object-fit: cover;
  display: inline-block;
}

.playlist-video-link-to {
  font-size: 16px;
  font-weight: normal;
  color: var(--text-primary);
  text-decoration: none;
  position: relative;
  cursor: pointer;
}

.playlist-video-link-to::before {
  content: "";
  display: inline-block;
  width: 20px; 
}

.playlist-video-link-to:hover {
  text-decoration: underline;
  text-decoration-color: var(--text-primary);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px; 
}

.playlist-items-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 6px;
}

.playlist-item {
  width: 210px;
  flex-shrink: 0;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s, background-color 0.3s ease;
  padding: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.playlist-item:hover {
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.2);
}

.playlist-item .video-link {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  height: 100%;
}

.playlist-item .thumbnail-wrapper {
  position: relative;
  width: 100%;
  height: 118px;
  border-radius: 8px;
  overflow: hidden;
}

.playlist-item .thumbnail {
  width: 100%;
  height: 118px;
  object-fit: cover;
  background-color: var(--bg-secondary);
  border-radius: 8px;
}

.playlist-item .duration {
  position: absolute;
  bottom: 6px;
  right: 6px;
  padding: 2px 6px;
  font-size: 0.8rem;
  color: var(--on-accent);
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 3px;
  user-select: none;
}

.playlist-item .title {
  font-weight: 600;
  margin-top: 8px;
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  display: block;
  color: var(--text-primary);
}

.playlist-item .author {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 2px;
}

.playlist-item .meta {
  font-size: 0.79rem;
  color: var(--text-secondary);
  margin-top: 0px;
}

.channel-view {
  padding: 16px;
  max-width: 95%;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.banner {
  width: 100%;
  height: 200px;
  background-size: cover;
  background-position: center;
  border-radius: 8px;
  margin-bottom: 1rem;
  background-color: var(--bg-secondary);
}

.channel-header {
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
}

.avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  background-color: var(--bg-secondary);
}

.info {
  margin-left: 16px;
  flex-grow: 1;
}

.info h2 {
  margin: 0 0 8px;
  font-size: 1.8rem;
}

.video-count {
  margin: 0 0 8px;
  color: var(--text-secondary);
}

.description {
  margin: 0;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 1.5rem;
  padding: 10px 0;
  border-radius: 0;
  border: none;
  border-radius: 6px;
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 1.3rem;
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.tabs .active {
  border-bottom: 2px solid var(--text-primary);
  color: var(--text-primary);
}

.tab-content {
  margin-top: 1rem;
}

.top-video {
  display: flex;
  gap: 16px;
  margin-bottom: 2rem;
}

.top-video-link {
  display: flex;
  gap: 16px;
  text-decoration: none;
  color: inherit;
  width: 100%;
}

.thumbnail-wrapper {
  position: relative;
  width: 400px;
  height: 224px;
  flex-shrink: 0;
}

.small-thumb {
  width: 160px;
  height: 90px;
}

.top-video .thumbnail,
.video-item .thumbnail {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  object-fit: cover;
  background-color: var(--bg-secondary);
}

.top-video .duration {
  position: absolute;
  bottom: 6px;
  right: 6px;
  padding: 2px 6px;
  font-size: 0.8rem;
  color: var(--on-accent);
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 3px;
  user-select: none;
}

.top-video-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.top-video-info p {
  margin: 4px 0;
}

.description-text {
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  max-height: 120px;
  color: var(--text-secondary);
  margin-top: 8px;
}

.playlists {
  margin-top: 1rem;
}

.playlist-wrapper {
  margin-bottom: 2rem;
}

.playlist-title {
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.video-list.compact {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.video-item {
  background: var(--bg-primary);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 6px rgb(0 0 0 / 0.1);
  transition: box-shadow 0.2s;
  padding: 8px;
}

.video-item:hover {
  box-shadow: 0 0 12px rgb(0 0 0 / 0.15);
}

.loading {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
}

.skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    100deg,
    var(--bg-secondary) 30%,
    var(--hover-bg) 50%,
    var(--bg-secondary) 70%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
  border-radius: 8px;
}

.skeleton-text {
  background: var(--border-color);
  border-radius: 6px;
  animation: shimmer 1.5s infinite linear;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.avatar-wrapper {
  position: relative;
  width: 96px;
  height: 96px;
}

.avatar.skeleton {
  width: 96px;
  height: 96px;
  border-radius: 50%;
}

.round.skeleton {
  width: 103px;
  height: 103px;
  border-radius: 50%;
}

.thumbnail.skeleton {
  width: 100%;
  height: 118px;
  border-radius: 8px;
}

.reload-btn {
  padding: 10px 24px;
  background: var(--text-secondary);
  color: var(--on-accent);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1.1em;
  cursor: pointer;
  margin-top: 12px;
  transition: background 0.2s, color 0.2s;
}
.reload-btn:hover {
  background: var(--text-secondary-hover);
  color: var(--on-accent);
}
.error-section {
  text-align: center;
  padding: 32px 0;
}
</style>