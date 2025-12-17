<template>
  <div class="page-container yt-watch-page">
    <div class="main-content" v-if="video">
      <div class="video-wrapper">
        <StreamPlayer :videoId="videoId" :streamType="resolvedStreamType" @ended="onPlayerEnded" @play-autoplay-candidate="onPlayAutoplayCandidate" @autoplay-no-suitable-video="onAutoplayNoSuitableVideo" />
      </div>

      <h1 class="video-title" ref="videoTitle">{{ title }}</h1>
      <div class="video-info channel-info">
        <router-link :to="`/channel/${authorId}`" class="channel-icon-link">
          <img
            :src="authorThumbnailUrl"
            alt="チャンネルアイコン"
            class="channel-icon"
            @error="onImageError($event, authorId)"
          />
        </router-link>
        <div class="channel-text">
          <router-link :to="`/channel/${authorId}`" class="channel-name">
            {{ authorName }}
          </router-link>
          <p class="subscriber-count">{{ subscriberCount }}</p>
        </div>

        <StreamTypeDropdown
          :resolvedStreamType="resolvedStreamType"
          :isOpen="isDropdownOpen"
          @toggle="toggleDropdown"
          @select="selectStreamType"
          style="margin-left: auto"
        />
        <button
          class="subscribe-btn"
          :class="{ subscribed: subscribedLocal }"
          @click.stop="toggleSubscribe"
          :title="subscribedLocal ? '登録解除' : '登録'"
          style="margin-left: 12px;"
        >
          {{ subscribedLocal ? '登録解除' : '登録' }}
        </button> 
      </div>
      <div
        style="
          padding: 10px 10px 0 10px;
          border-radius: 8px;
          background-color: var(--video-meta-bg);
        "
      >
        <div class="video-meta">
          <span>{{ viewCount.replace(/\s+/g, '') }}</span>
          <span>・{{ relativeDate }}</span>
          <div style="padding-top: 10px; display: flex; align-items:center; gap:8px;">
            <div id=mainvideo-likeCount>
              <svg style="padding-top: 2px; padding-right: 4px;" width="20" height="20" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" transform="translate3d(0px, 0px, 0px)"> <defs>  <clipPath id="__lottie_element_402">   <rect height="48" id="svg_1" width="48" x="0" y="0"/>  </clipPath>  <clipPath id="__lottie_element_419">   <path d="m-37.97,-32.54l480,0l0,480l-480,0l0,-480z" id="svg_2"/>  </clipPath>  <clipPath id="__lottie_element_429">   <path d="m-37.97,-32.54l480,0l0,480l-480,0l0,-480z" id="svg_3"/>  </clipPath>  <clipPath id="__lottie_element_439">   <path d="m-37.97,-32.54l480,0l0,480l-480,0l0,-480z" id="svg_4"/>  </clipPath>  <clipPath id="__lottie_element_449">   <path d="m-37.97,-32.54l480,0l0,480l-480,0l0,-480z" id="svg_5"/>  </clipPath>  <clipPath id="__lottie_element_459">   <path d="m-37.97,-32.54l480,0l0,480l-480,0l0,-480z" id="svg_6"/>  </clipPath> </defs> <g class="layer">  <title>レイヤー1</title>  <g clip-path="url(#__lottie_element_402)" id="svg_7">   <g clip-path="url(#__lottie_element_459)" display="none" id="svg_8" transform="matrix(0.0567383 -0.166685 0.174622 0.0541596 -11.6766 76.011)">    <g display="block" id="svg_9" transform="matrix(0.750315 0.66108 -0.66108 0.750315 286.276 187.478)">     <path d="m-51.09,-298.22c0,0 0,-0.62 0,-0.62" fill-opacity="0" id="svg_10" stroke="rgb(255,39,145)" stroke-linecap="round" stroke-linejoin="round" stroke-width="0"/>     <g id="svg_11" transform="matrix(1 0 0 1.2 0 0)"/>    </g>    <g display="block" id="svg_12" transform="matrix(0.994522 -0.104524 0.104524 0.994522 231.638 160.438)">     <path d="m97.01,-278.06c0,0 0,-0.63 0,-0.63" fill-opacity="0" id="svg_13" stroke="rgb(255,0,51)" stroke-linecap="round" stroke-linejoin="round" stroke-width="0"/>     <g id="svg_14" transform="matrix(1 0 0 1.2 0 0)"/>    </g>   </g>   <g clip-path="url(#__lottie_element_449)" display="none" id="svg_15" transform="matrix(-0.148543 -0.103018 0.107923 -0.141791 53.5988 107.759)">    <g display="block" id="svg_16" transform="matrix(0.750315 0.66108 -0.66108 0.750315 286.276 187.478)">     <path d="m154.29,-223.23c0,0 0,-0.62 0,-0.62" fill-opacity="0" id="svg_17" stroke="rgb(255,39,145)" stroke-linecap="round" stroke-linejoin="round" stroke-width="0"/>     <g id="svg_18" transform="matrix(1 0 0 1.2 0 0)"/>    </g>    <g display="block" id="svg_19" transform="matrix(0.994522 -0.104524 0.104524 0.994522 231.638 160.438)">     <path d="m180.9,-76.15c0,0 0,-0.63 0,-0.63" fill-opacity="0" id="svg_20" stroke="rgb(255,0,51)" stroke-linecap="round" stroke-linejoin="round" stroke-width="0"/>     <g id="svg_21" transform="matrix(1 0 0 1.2 0 0)"/>    </g>   </g>   <g clip-path="url(#__lottie_element_439)" display="none" id="svg_22" transform="matrix(-0.148543 0.103018 -0.107923 -0.141791 105.402 58.3104)">    <g display="block" id="svg_23" transform="matrix(0.750315 0.66108 -0.66108 0.750315 286.276 187.478)">     <path d="m146.45,-4.73c0,0 0,-0.62 0,-0.62" fill-opacity="0" id="svg_24" stroke="rgb(255,39,145)" stroke-linecap="round" stroke-linejoin="round" stroke-width="0"/>     <g id="svg_25" transform="matrix(1 0 0 1.2 0 0)"/>    </g>    <g display="block" id="svg_26" transform="matrix(0.994522 -0.104524 0.104524 0.994522 231.638 160.438)">     <path d="m14.8,66.03c0,0 0,-0.63 0,-0.63" fill-opacity="0" id="svg_27" stroke="rgb(255,0,51)" stroke-linecap="round" stroke-linejoin="round" stroke-width="0"/>     <g id="svg_28" transform="matrix(1 0 0 1.2 0 0)"/>    </g>   </g>   <g clip-path="url(#__lottie_element_429)" display="none" id="svg_29" transform="matrix(0.0567383 0.166685 -0.174622 0.0541596 72.1421 -3.99831)">    <g display="block" id="svg_30" transform="matrix(0.750315 0.66108 -0.66108 0.750315 286.276 187.478)">     <path d="m-63.78,55.33c0,0 0,-0.62 0,-0.62" fill-opacity="0" id="svg_31" stroke="rgb(255,39,145)" stroke-linecap="round" stroke-linejoin="round" stroke-width="0"/>     <g id="svg_32" transform="matrix(1 0 0 1.2 0 0)"/>    </g>    <g display="block" id="svg_33" transform="matrix(0.994522 -0.104524 0.104524 0.994522 231.638 160.438)">     <path d="m-171.76,-48.01c0,0 0,-0.63 0,-0.63" fill-opacity="0" id="svg_34" stroke="rgb(255,0,51)" stroke-linecap="round" stroke-linejoin="round" stroke-width="0"/>     <g id="svg_35" transform="matrix(1 0 0 1.2 0 0)"/>    </g>   </g>   <g clip-path="url(#__lottie_element_419)" display="none" id="svg_36" transform="matrix(0.183609 0 0 0.175264 -0.216196 6.94126)">    <g display="block" id="svg_37" transform="matrix(0.750315 0.66108 -0.66108 0.750315 286.276 187.478)">     <path d="m-185.88,-126.05c0,0 0,-0.62 0,-0.62" fill-opacity="0" id="svg_38" stroke="rgb(255,39,145)" stroke-linecap="round" stroke-linejoin="round" stroke-width="0"/>     <g id="svg_39" transform="matrix(1 0 0 1.2 0 0)"/>    </g>    <g display="block" id="svg_40" transform="matrix(0.994522 -0.104524 0.104524 0.994522 231.638 160.438)">     <path d="m-120.94,-260.67c0,0 0,-0.63 0,-0.63" fill-opacity="0" id="svg_41" stroke="rgb(255,0,51)" stroke-linecap="round" stroke-linejoin="round" stroke-width="0"/>     <g id="svg_42" transform="matrix(1 0 0 1.2 0 0)"/>    </g>   </g>   <g display="none" id="svg_43" transform="matrix(0.183609 0 0 0.175264 43.85 49.0047)"/>   <g display="none" id="svg_44" transform="matrix(1.83609 0 0 1.75264 39.9942 42.345)">    <path d="m-13.5,-16.04c1.79,0 3.25,1.46 3.25,3.25c0,1.79 -1.46,3.25 -3.25,3.25c-1.79,0 -3.25,-1.46 -3.25,-3.25c0,-1.79 1.46,-3.25 3.25,-3.25zm0.8,-6.74c1.79,0.44 2.78,2.29 2.35,4.06c-0.19,0.76 -0.39,1.52 -0.71,2.47c-0.31,0.96 1.35,1.32 0.19,3.91c-0.88,1.98 -6.38,0.28 -5.36,-2.62c0.89,-2.51 1.71,-4.88 2.56,-7.3c0.15,-0.43 0.56,-0.63 0.97,-0.52z" fill="rgb(0,0,0)" id="svg_45"/>   </g>   <g display="none" id="svg_46" transform="matrix(1.83609 0 0 1.75264 43.85 41.9945)">    <path d="m-13.71,-15.25c0.48,0.44 0.87,0.45 1.54,0.45c0,0 5.29,0 5.29,0c0.85,0 1.62,0.48 2,1.24c0,0 0.18,0.36 0.18,0.36c0.4,0.8 0.14,1.78 -0.6,2.28c-0.13,0.08 -0.2,0.22 -0.2,0.37c0,0 0,0.07 0,0.07c0,0.12 0.04,0.25 0.12,0.35c0.77,1.02 0.58,2.47 -0.42,3.27c0,0 -0.49,0.4 -0.49,0.4c-0.13,0.1 -0.18,0.27 -0.13,0.42c0,0 0.07,0.2 0.07,0.2c0.22,0.66 0.1,1.38 -0.31,1.93c-0.53,0.7 -1.36,1.12 -2.24,1.12c0,0 -3.91,-0.01 -3.91,-0.01c-2.09,0 -4.14,-0.54 -5.95,-1.58c0,0 -0.28,-0.15 -0.28,-0.15c-0.3,-0.18 -0.64,-0.27 -0.99,-0.27c0,0 -2.47,0 -2.47,0c-0.55,0 -1,-0.45 -1,-1c0,0 0,-5.99 0,-5.99c0,-0.56 0.45,-1.01 1,-1c0,0 2.79,0 2.79,0c0.43,0 0.8,-0.27 0.95,-0.67c0,0 0.2,-0.16 0.36,-0.6c0.6,-1.68 4.04,-1.95 4.69,-1.19z" fill="rgb(0,0,0)" id="svg_47"/>   </g>   <g display="none" id="svg_48" transform="matrix(0.547972 0.0549741 -0.0575915 0.523066 49.7345 48.9309)">    <path d="m-59.33,-53.69c3,-0.13 1.79,1.3 1.18,1.73c3.79,0.17 5.52,0.57 5.5,1.53c-0.09,3.7 -0.43,6.83 -2.85,9.66c-6.53,1.38 -11.75,-2.2 -14.5,-2.02c-0.05,-1.73 -0.24,-4.32 0.13,-6.58c3.91,-0.29 6.93,-4.18 10.54,-4.32z" fill="rgb(0,0,0)" id="svg_49"/>   </g>   <g display="block" id="svg_50" transform="matrix(0.959954 0 0 0.909324 22.9493 21.8543)">    <path d="m-16.06,-22.78c0.16,-0.46 0.63,-0.74 1.11,-0.66c0,0 1.04,0.17 1.04,0.17c2.25,0.38 3.73,2.55 3.25,4.78c0,0 -0.62,2.91 -0.62,2.91c0,0 4.06,0 4.06,0c1.72,0 3.21,1.19 3.58,2.87c0.23,1.03 -0.01,2.13 -0.64,2.98c0,0 0.02,0.09 0.02,0.09c0.3,1.28 -0.09,2.63 -1.02,3.56c0,0 0,0.04 0,0.04c0,0 -0.01,0.23 -0.01,0.23c-0.02,0.22 -0.06,0.45 -0.13,0.66c0,0 -0.11,0.29 -0.11,0.29c-0.59,1.37 -1.94,2.28 -3.45,2.28c0,0 -3.61,0 -3.61,0c0,0 -0.39,-0.01 -0.39,-0.01c-1.83,-0.06 -3.61,-0.53 -5.23,-1.39c0,0 -0.34,-0.18 -0.34,-0.18c0,0 -0.27,-0.16 -0.27,-0.16c-0.26,-0.15 -0.56,-0.24 -0.86,-0.26c0,0 -0.13,0 -0.13,0c0,0 -1.97,0 -1.97,0c-0.83,0 -1.5,-0.67 -1.5,-1.5c0,0 0,-6 0,-6c0,-0.83 0.67,-1.5 1.5,-1.5c0,0 1.79,0 1.79,0c0,0 0.16,-0.01 0.16,-0.01c0.31,-0.05 0.57,-0.24 0.72,-0.52c0,0 0.06,-0.14 0.06,-0.14c0,0 2.99,-8.53 2.99,-8.53zm-1.1,9.19c-0.42,1.2 -1.55,2.01 -2.83,2.01c0,0 -1.29,0 -1.29,0c0,0 0,5 0,5c0,0 1.47,0 1.47,0c0.69,0 1.38,0.18 1.98,0.53c0,0 0.27,0.15 0.27,0.15c0,0 0.29,0.16 0.29,0.16c1.44,0.76 3.05,1.16 4.68,1.16c0,0 3.61,0 3.61,0c0.75,0 1.42,-0.48 1.66,-1.2c0,0 0.03,-0.13 0.03,-0.13c0.01,-0.04 0.01,-0.08 0.01,-0.13c0,0 0,-0.87 0,-0.87c0,0 0.59,-0.58 0.59,-0.58c0.38,-0.39 0.57,-0.93 0.52,-1.47c0,0 -0.04,-0.23 -0.04,-0.23c0,0 -0.02,-0.09 -0.02,-0.09c0,0 -0.21,-0.9 -0.21,-0.9c0,0 0.55,-0.74 0.55,-0.74c0.29,-0.39 0.4,-0.89 0.29,-1.36c-0.17,-0.76 -0.84,-1.3 -1.62,-1.3c0,0 -4.06,0 -4.06,0c-0.6,0 -1.18,-0.27 -1.56,-0.74c-0.38,-0.47 -0.52,-1.09 -0.4,-1.68c0,0 0.63,-2.9 0.63,-2.9c0.24,-1.12 -0.5,-2.21 -1.63,-2.4c0,0 -0.21,-0.03 -0.21,-0.03c0,0 -2.71,7.74 -2.71,7.74z" fill="rgb(0,0,0)" id="svg_51"/>   </g>  </g> </g></svg> 
              {{ likeCount }}
            </div><span class="dot"></span>
            <StreamPlayer :videoId="videoId" :streamType="'3'" />
            <button class="add-playlist-btn" @click.stop="openPlaylistModal" title="プレイリストに追加" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;">
              プレイリストに追加
            </button>
          </div>
        </div>
        <VideoDescription
          :descriptionRun0="descriptionRun0"
          :descriptionRun1="descriptionRun1"
          :formattedDescription="formattedDescription"
          :showFull="showFullDescription"
          @toggle="(v) => { showFullDescription = v }"
        />
      </div>
      <Comment :videoId="videoId" />
    </div>

    <RelatedList v-if="relatedVideos.length" :relatedVideos="relatedVideos" :playlistId="playlistId" :currentVideoId="videoId" :loadingMore="loadingMore" @load-more="loadMoreRelatedVideos" />
    <div v-else-if="error" class="error-msg">
      ⚠️ {{ error }}<br>
      <button class="reload-btn" @click="reloadVideo">再取得</button>
    </div>
    <p v-else class="loading-msg">読み込み中...<br>読み込む速度を早くする方法。↓<br>右上の設定マークからカスタムエンドポイントのを追加してください　＊方法は簡単で1~3分で作れます。</p>

    <!-- 自動再生フィルタ通知 -->
    <AutoplayNotification v-if="showAutoplayNotification" :message="autoplayNotificationMessage" @close="showAutoplayNotification = false" />
    <PlaylistModal v-if="showPlaylistModal" :video="video" @close="closePlaylistModal" @added="onPlaylistAdded" />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { ref } from 'vue';
import PlaylistComponent from "@/components/Playlist.vue";
import Comment from "@/components/Comment.vue";
import StreamPlayer from "@/components/StreamPlayer.vue";
window.scrollTo(0, 0);

const route = useRoute();
const videoId = computed(() => route.query.v);
const playlistId = computed(() => route.query.list);

const currentType = ref('1');

function switchStream() {
  currentType.value = '3';
}
</script>

<script>
import { apiRequest } from "@/services/requestManager";
import { addVideoToHistory } from "@/utils/historyManager";
import PlaylistComponent from "@/components/Playlist.vue";
import Comment from "@/components/Comment.vue";
import StreamPlayer from "@/components/StreamPlayer.vue";
import StreamTypeDropdown from "@/components/StreamTypeDropdown.vue";
import VideoDescription from "@/components/VideoDescription.vue";
import RelatedList from "@/components/RelatedList.vue";
import AutoplayNotification from "@/components/AutoplayNotification.vue";
import PlaylistModal from "@/components/PlaylistModal.vue";
import subscriptionManager from "@/utils/subscriptionManager";

export default {
  components: {
    PlaylistComponent,
    Comment,
    StreamPlayer,
    StreamTypeDropdown,
    VideoDescription,
    RelatedList,
    AutoplayNotification,
    PlaylistModal,
  },
  props: {
    videoId: { type: String, required: true },
    streamType: { type: String, default: "" },
  },
  data() {
    return {
      video: null,
      error: null,
      hoverId: null,
      showFullDescription: false,
      localStreamType: this.getDefaultPlaybackMode() || "1",
      isDropdownOpen: false,
      _autoplayTimer: null,
      _autoplayDecisionTimer: null,
      showAutoplayNotification: false,
      autoplayNotificationMessage: "",
      showPlaylistModal: false,
      nextContinuationToken: null,
      loadingMore: false,
      subscribedLocal: false,
    };
  },
  computed: {
    resolvedStreamType() {
      return this.streamType || this.localStreamType;
    },
    viewCount() {
      return this.video?.views || "情報なし";
    },
    title() {
      return this.video?.title || "情報なし";
    },
    relativeDate() {
      return this.video?.relativeDate || "";
    },
    likeCount() {
      return this.video?.likes || "情報なし";
    },
    subscriberCount() {
      return this.video?.author?.subscribers || "情報なし";
    },
    authorId() {
      return this.video?.author?.id || "情報なし";
    },
    authorName() {
      return this.video?.author?.name || "情報なし";
    },
    authorThumbnailUrl() {
      return this.video?.author?.thumbnail || "情報なし";
    },
    isSubscribedComputed() {
      return subscriptionManager.isSubscribed(this.authorId);
    },
    descriptionText() {
      return this.video?.description?.text || "情報なし";
    },
    formattedDescription() {
      const rawText =
        this.video?.description?.text ||
        "この動画には説明が追加されていません。";
      return rawText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
    },
    shouldShowToggle() {
      const text = this.descriptionRun3?.trim();
      return text !== "";
    },
    descriptionRun0() {
      return this.video?.description?.run0 || "情報なし";
    },
    descriptionRun1() {
      return this.video?.description?.run1 || "";
    },
    descriptionRun2() {
      return this.video?.description?.run2 || "";
    },
    descriptionRun3() {
      return this.video?.description?.run3 || "";
    },
    relatedVideos() {
      const feed = this.video?.["Related-videos"]?.relatedVideos || [];
      const mapped = feed.map((item) => {
        if (item.type === "playlist") {
          // Handle playlist items
          return {
            type: item.type,
            base64imge: item.thumbnail || "",
            badge: "",
            title: item.title || "",
            metadataRow1: "再生リスト",
            metadataRow2Part1: "",
            metadataRow2Part2: "",
            videoId: item.videoId || "",
            replaylistId: item.playlistId || "",
            duration: 0,
            verifiedIcon: null,
          };
        } else {
          // Handle video items
          return {
            type: item.type,
            base64imge: item.thumbnail || "",
            badge: item.badge || "",
            title: item.title || "",
            metadataRow1: item.channelName || "",
            metadataRow2Part1: item.viewCountText || "",
            metadataRow2Part2: item.publishedTimeText || "",
            videoId: item.videoId || "",
            replaylistId: "",
            duration: item.duration || 0,
            verifiedIcon: item.verifiedIcon || null,
          };
        }
      });
      
      // Debug: log the first item to see what data we have
      if (mapped.length > 0) {
        console.log("First related video item:", mapped[0]);
        console.log("Raw API response first item:", feed[0]);
      }
      
      return mapped;
    },
  },
  methods: {
    getDefaultPlaybackMode() {
      try {
        // localStorage を優先的に読む（沙箱環境での Cookie 制限に対応）
        const fromStorage = localStorage.getItem("defaultPlaybackMode");
        if (fromStorage) {
          return fromStorage;
        }
        // localStorage にない場合は Cookie から取得
        const match = document.cookie.match(
          new RegExp("(^| )StreamType=([^;]+)")
        );
        return match ? decodeURIComponent(match[2]) : null;
      } catch {
        return null;
      }
    },
    getCookieSafe(name) {
      try {
        const match = document.cookie.match(
          new RegExp("(^| )" + name + "=([^;]+)")
        );
        return match ? decodeURIComponent(match[2]) : null;
      } catch {
        return null;
      }
    },
    parseDurationFromBadge(badgeText) {
      // Try to parse duration from badge text like "1:23:45" or "4:30" or "4分"
      if (!badgeText || typeof badgeText !== 'string') return 0;
      
      badgeText = badgeText.trim();
      console.log(`Parsing badge: "${badgeText}"`);
      
      // Pattern 1: HH:MM:SS format
      const hhmmssMatch = badgeText.match(/^(\d+):(\d+):(\d+)$/);
      if (hhmmssMatch) {
        const seconds = parseInt(hhmmssMatch[1]) * 3600 + parseInt(hhmmssMatch[2]) * 60 + parseInt(hhmmssMatch[3]);
        console.log(`  HH:MM:SS matched: ${seconds}s`);
        return seconds;
      }
      
      // Pattern 2: MM:SS format
      const mmssMatch = badgeText.match(/^(\d+):(\d+)$/);
      if (mmssMatch) {
        const seconds = parseInt(mmssMatch[1]) * 60 + parseInt(mmssMatch[2]);
        console.log(`  MM:SS matched: ${seconds}s`);
        return seconds;
      }
      
      // Pattern 3: Japanese format like "4分" or "4分30秒"
      const japaneseMatch = badgeText.match(/^(\d+)分(?:(\d+)秒)?$/);
      if (japaneseMatch) {
        let seconds = parseInt(japaneseMatch[1]) * 60;
        if (japaneseMatch[2]) {
          seconds += parseInt(japaneseMatch[2]);
        }
        console.log(`  Japanese format matched: ${seconds}s`);
        return seconds;
      }
      
      console.log(`  No pattern matched`);
      return 0;
    },

    async toggleSubscribe() {
      try {
        const id = this.authorId;
        console.debug('toggleSubscribe clicked', { id, subscribedBefore: subscriptionManager.isSubscribed(id) });
        if (!id || id === '情報なし') return;
        if (subscriptionManager.isSubscribed(id)) {
          // Unsubscribe immediately
          subscriptionManager.removeSubscription(id);
          this.subscribedLocal = false;
          try { window.dispatchEvent(new CustomEvent('subscriptions-changed')); } catch(e){}
          console.debug('after remove, subscriptions', subscriptionManager.getSubscriptions());
          this.autoplayNotificationMessage = 'チャンネル登録を解除しました';
          this.showAutoplayNotification = true;
          setTimeout(() => (this.showAutoplayNotification = false), 2000);
        } else {
          // Optimistically add subscription immediately (show thumbnail URL first if available)
          const initialIcon = (this.authorThumbnailUrl && this.authorThumbnailUrl !== '情報なし') ? this.authorThumbnailUrl : null;
          subscriptionManager.addSubscription({ id, name: this.authorName, icon: initialIcon });
          this.subscribedLocal = true;
          try { window.dispatchEvent(new CustomEvent('subscriptions-changed')); } catch(e){}
          console.debug('after add, subscriptions', subscriptionManager.getSubscriptions());
          this.autoplayNotificationMessage = 'チャンネルを登録しました';
          this.showAutoplayNotification = true;
          setTimeout(() => (this.showAutoplayNotification = false), 2000);

          // Fetch icon asynchronously and update subscription when available
          (async () => {
            try {
              const fetchedIcon = await subscriptionManager.fetchImageAsBase64(this.authorThumbnailUrl);
              if (fetchedIcon) {
                subscriptionManager.updateSubscription(id, { icon: fetchedIcon });
              } else if (this.authorThumbnailUrl && this.authorThumbnailUrl !== '情報なし') {
                // If base64 fetch failed, fall back to original URL so image still shows
                subscriptionManager.updateSubscription(id, { icon: this.authorThumbnailUrl });
              }
            } catch (e) {
              console.warn('icon fetch failed', e);
            }
          })();
        }
        // ensure we re-sync shortly after in case of timing issues
        setTimeout(() => {
          try { this.subscribedLocal = subscriptionManager.isSubscribed(this.authorId); } catch (e) {}
        }, 50);
      } catch (e) {
        console.error('toggleSubscribe error', e);
      }
    },
    setCookieSafe(name, value, seconds) {
      try {
        const expires = new Date(Date.now() + seconds * 1000).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(
          value
        )}; expires=${expires}; path=/`;
      } catch {}
    },
    onStreamTypeChange() {
      // localStorage と Cookie の両方に保存
      try {
        localStorage.setItem("defaultPlaybackMode", this.localStreamType);
      } catch (e) {
        console.error("localStorage save error:", e);
      }
      this.setCookieSafe("StreamType", this.localStreamType, 99999);
    },
    onPlayerEnded() {
      try {
        // 既存のタイマーをクリア
        try { if (this._autoplayTimer) { clearTimeout(this._autoplayTimer); this._autoplayTimer = null; } } catch (e) {}
        try { if (this._autoplayDecisionTimer) { clearTimeout(this._autoplayDecisionTimer); this._autoplayDecisionTimer = null; } } catch (e) {}

        // 少し待って（他のイベントが到着するのを待つ）から遷移タイマーをセット
        this._autoplayDecisionTimer = setTimeout(() => {
          try {
            // 自動再生ロックがある場合はスケジュールを抑止
            const lockRaw = (() => { try { return sessionStorage.getItem('yt_autoplay_lock'); } catch (e) { return null; } })();
            if (lockRaw) {
              try {
                const lock = JSON.parse(lockRaw);
                if (lock && lock.expires && Date.now() < lock.expires) {
                  // ロック期間内はスケジュールを行わない
                  return;
                }
              } catch (e) {}
            }

            // フィルターが有効な場合はフォールバック処理をしない
            // （StreamType2 の自動再生イベントに任せる。条件に合う動画がなければ onAutoplayNoSuitableVideo が呼ばれる）
            const filterConfig = window.__autoplayDurationFilter || { enabled: false };
            if (filterConfig.enabled) {
              // フィルターが有効な場合、StreamType2 の候補選択イベントを待つ
              // 候補がない場合は onAutoplayNoSuitableVideo が呼ばれる
              return;
            }

            // フィルターが無効な場合のみフォールバック処理（最初の関連動画を再生）
            // 決定後、元の3秒遅延で遷移をセット
            this._autoplayTimer = setTimeout(() => {
              const next =
                this.relatedVideos && this.relatedVideos.length
                  ? this.relatedVideos[0]
                  : null;
              if (next && next.videoId) {
                const query = { v: next.videoId, autoplay: "1" };
                if (next.replaylistId && next.replaylistId.length > 20) {
                  query.list = next.replaylistId;
                } else if (playlistId.value) {
                  query.list = playlistId.value;
                }
                this.$router.push({ path: "/watch", query });
              }
            }, 3000);
          } catch (e) {
            console.error('autoplay decision error', e);
          }
        }, 300); // 300ms の短い待ち時間
      } catch (e) {
        console.error("onPlayerEnded error", e);
      }
    },

    onPlayAutoplayCandidate({ id }) {
      try {
        if (!id) return;
        // 自動遷移中の競合を防ぐためロックを設定（短時間）
        try {
          const lock = { target: id, expires: Date.now() + 5000 };
          sessionStorage.setItem('yt_autoplay_lock', JSON.stringify(lock));
        } catch (e) {}

        // 決定タイマーや既存の自動遷移タイマーをクリアしてから遷移
        try { if (this._autoplayDecisionTimer) { clearTimeout(this._autoplayDecisionTimer); this._autoplayDecisionTimer = null; } } catch (e) {}
        try { if (this._autoplayTimer) { clearTimeout(this._autoplayTimer); this._autoplayTimer = null; } } catch (e) {}

        const query = { v: id };
        this.$router.push({ path: "/watch", query });
      } catch (e) {
        console.error("onPlayAutoplayCandidate error", e);
      }
    },

    onAutoplayNoSuitableVideo() {
      try {
        const filterConfig = window.__autoplayDurationFilter || { enabled: false, minutes: 4 };
        this.autoplayNotificationMessage = `指定条件（${filterConfig.minutes}分以下）に合う関連動画がないため、自動再生をストップしました。`;
        this.showAutoplayNotification = true;

        // 5秒後に自動で通知を非表示
        setTimeout(() => {
          this.showAutoplayNotification = false;
        }, 5000);
      } catch (e) {
        console.error("onAutoplayNoSuitableVideo error:", e);
      }
    },

    openPlaylistModal() {
      this.showPlaylistModal = true;
    },
    closePlaylistModal() {
      this.showPlaylistModal = false;
    },
    onPlaylistAdded({ playlistId }) {
      // optional: show a brief notification
      try {
        this.autoplayNotificationMessage = 'プレイリストに追加しました';
        this.showAutoplayNotification = true;
        setTimeout(() => (this.showAutoplayNotification = false), 2000);
      } catch (e) {}
      this.closePlaylistModal();
    },

    // --- fetchのみ（JSONのみ対応）
    async fetchVideoData(id) {
      const maxRetries = 3;
      if (!id) {
        this.video = null;
        this.error = "動画IDが指定されていません。";
        return;
      }

      try {
        this.video = null;
        this.error = null;
        // requestManager の apiRequest を使って中央集約されたリクエストを実行
        const data = await apiRequest({
          // Use raw query formatting required: video=動画ID==p==depth==i==1
          params: { __rawQuery: `video=${id}==p==depth==i==1` },
          method: "GET",
          retries: maxRetries,
          timeout: 15000,
        });

        this.video = data;
        this.nextContinuationToken = data["Related-videos"]?.nextContinuationToken || null;
        // Sync subscribed state immediately after we have the author id
        try {
          this.subscribedLocal = subscriptionManager.isSubscribed(this.authorId);
        } catch (e) {
          console.warn('subscribed sync error', e);
        }
        
        // 履歴に保存（非同期で実行、エラーは無視）
        try {
          await addVideoToHistory({
            id: data.id,
            title: data.title,
            views: data.views,
            author: data.author,
            description: data.description,
            thumbnail: data.thumbnail,
          });
        } catch (historyError) {
          console.warn('Failed to save to history:', historyError);
        }
        
        if (!data["Related-videos"] || !Array.isArray(data["Related-videos"].relatedVideos) || data["Related-videos"].relatedVideos.length === 0) {
          this.error = "関連動画が見つかりませんでした。";
        }
        return;
      } catch (err) {
        console.error("fetchVideoData error:", err);
        this.video = null;
        // エラーメッセージは既存の UI 用文字列を使う
        this.error =
          err && err.message && err.message !== ""
            ? err.message
            : "動画情報を取得できませんでした。";
      }
    },
    reloadVideo() {
      this.fetchVideoData(this.videoId);
    },
    getPrimaryThumbnail(id) {
      return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    },
    onImageError(event, id) {
      if (!event.target.dataset.error) {
        event.target.src = `https://i.ytimg.com/vi/${id}/sddefault.jpg`;
        event.target.dataset.error = true;
      }
    },
    toggleDescription() {
      this.showFullDescription = !this.showFullDescription;
      this.$nextTick(() => {
        const el = this.$refs.videoTitle;
        if (el?.scrollIntoView) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    },
    toggleDropdown() {
      this.isDropdownOpen = !this.isDropdownOpen;
    },
    selectStreamType(value) {
      this.localStreamType = value;
      this.isDropdownOpen = false;
      this.onStreamTypeChange();
    },
    async loadMoreRelatedVideos() {
      if (!this.nextContinuationToken || this.loadingMore) return;
      this.loadingMore = true;
      try {
        const data = await apiRequest({
          // Use raw query formatting required:
          // video=動画ID==p==token==i==トークン==p==depth==i==2
          params: { __rawQuery: `video=${this.videoId}==p==token==i==${this.nextContinuationToken}==p==depth==i==2` },
          method: "GET",
          retries: 3,
          timeout: 15000,
        });
        if (data["Related-videos"] && Array.isArray(data["Related-videos"].relatedVideos)) {
          // Append new related videos
          this.video["Related-videos"].relatedVideos.push(...data["Related-videos"].relatedVideos);
          this.nextContinuationToken = data["Related-videos"].nextContinuationToken || null;
        }
      } catch (err) {
        console.error("loadMoreRelatedVideos error:", err);
      } finally {
        this.loadingMore = false;
      }
    },
    handleClickOutside(event) {
      if (this.isDropdownOpen && !this.$el.contains(event.target)) {
        this.isDropdownOpen = false;
      }
    },
    handleEscape(event) {
      if (event.key === "Escape") {
        this.isDropdownOpen = false;
      }
    },
    onSubscriptionsChanged() {
      try {
        // Update local subscribed flag from storage so UI keeps consistent
        const val = subscriptionManager.isSubscribed(this.authorId);
        console.debug('subscriptions-changed received on watch page', { id: this.authorId, subscribed: val });
        this.subscribedLocal = val;
      } catch (e) { console.warn('onSubscriptionsChanged error', e); }
    },
  },
  mounted() {
    document.addEventListener("click", this.handleClickOutside);
    document.addEventListener("keydown", this.handleEscape);
    window.addEventListener('subscriptions-changed', this.onSubscriptionsChanged);

    // initialize local subscribed state
    this.subscribedLocal = subscriptionManager.isSubscribed(this.authorId);

    // watch for storage changes from other tabs
    this._storageHandler = (e) => {
      if (e.key === 'subscriptions_v1') {
        const val = subscriptionManager.isSubscribed(this.authorId);
        console.debug('storage event on watch page', { key: e.key, subscribed: val });
        this.subscribedLocal = val;
      }
    };
    window.addEventListener('storage', this._storageHandler);
  },
  beforeUnmount() {
    document.removeEventListener("click", this.handleClickOutside);
    document.removeEventListener("keydown", this.handleEscape);
    window.removeEventListener('subscriptions-changed', this.onSubscriptionsChanged);
    window.removeEventListener('storage', this._storageHandler);
    if (this._autoplayTimer) {
      clearTimeout(this._autoplayTimer);
      this._autoplayTimer = null;
    }
  },
  watch: {
    videoId: {
      immediate: true,
      handler(newId) {
        this.fetchVideoData(newId);
      },
    },
    title(newTitle) {
      if (newTitle && newTitle !== "情報なし") {
        document.title = newTitle;
      }
    },
    authorId(newVal) {
      // keep local subscribed in-sync when author changes
      this.subscribedLocal = subscriptionManager.isSubscribed(newVal);
    },
  },
};
</script>


<style scoped>
#mainvideo-likeCount {
    font-size: 14px;
    padding: 4px 11px;
    background: var(--download-button);
    color: var(--text-primary);
    border: none;
    border-radius: 30px;
    cursor: pointer;
    display: flex;
}

.dropdown-ending {
  display: inline-block;
  font-size: 1rem;
  margin-block-start: 0px;
  margin-block-end: 0px;
  margin-inline-start: 0px;
  margin-inline-end: 0px;
  display: inline-block;
  margin-top: -1rem;
  margin-bottom: -0.5rem;
  margin-left: 1rem;
}

.custom-dropdown {
  position: relative;
  background: var(--bg-secondary);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  width: max-content;
  font-size: 0.9rem;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.custom-dropdown-label {
  white-space: nowrap;
}

.re-actername{
  margin-bottom: 3px;
  font-size: 0.8rem;
}

.custom-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  min-width: 100%;
  white-space: nowrap;
  max-width: max-content;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.custom-dropdown-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  color: var(--text-primary);
}

.custom-dropdown-item:hover {
  background-color: var(--hover-bg);
}

.one-line {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 180px;
}

p {
  margin-block-start: 1em;
  margin-block-end: 0.8em;
  margin-inline-start: 0px;
  margin-inline-end: 0px;
  unicode-bidi: isolate;
}
.channel-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
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

.page-link {
  text-decoration: none;
}
.channel-icon-link {
  flex-shrink: 0;
  display: block;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
}

.channel-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}

.channel-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.channel-name {
  font-weight: 500;
  font-size: 1.1rem;
  color: var(--text-primary);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.channel-name:hover,
.channel-name:focus {
  text-decoration: underline;
}

.subscriber-count {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 2px 0 0 0;
  white-space: nowrap;
}
.video-info p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 4px 0;
  line-height: 1.4;
  font-weight: 400;
}
.video-description {
  font-size: 0.9rem;
  color: var(--text-primary);
  line-height: 1.5;
  margin-top: 12px;
  margin-bottom: 15px;
  white-space: pre-wrap; 
  word-break: break-word;
}
.description-preview {
  max-height: 120px;
  overflow: hidden;
  margin: 0 0 0.4em 0;
}
.description-full {
  margin: 0;
}
.description-toggle {
  display: inline-block;
  color: var(--accent-color);
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  margin-top: 4px;
}

.page-container {
  display: flex;
  gap: 24px;
  padding: 16px;
  flex-wrap: wrap;
}

.main-content {
  flex: 1 1 0;
  min-width: 0;
}

.video-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 8px 0;
  line-height: 1.4;
  color: var(--text-primary);
}

.video-meta {
  font-size: 0.9rem;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.related-section {
  width: 360px;
  flex-shrink: 0;
}

.related-title {
  font-size: 1.4rem;
  font-weight: 500;
  margin-bottom: 12px;
}

.related-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.related-item {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  cursor: pointer;
}

.thumb-wrapper {
  position: relative;
  width: 168px;
  height: 94.5px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 4px;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  display: block;
}

/* バッジ（動画時間・ライブ） */
.duration-badge {
  line-height: 1.3;
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: var(--on-accent);
  padding: 2px 4px;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 2px;
  pointer-events: none;
  user-select: none;
  z-index: 10;
}
.badge-live {
  background: var(--danger);
}
.video-info {
  flex: 1;
}

.video-title-related {
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.3;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-metadata {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.dot {
  margin: 0 4px;
}

.error-msg {
  color: red;
  font-size: 1rem;
  margin-top: 1rem;
}

.loading-msg {
  font-size: 1rem;
  color: var(--text-primary);
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

/* 自動再生フィルタ通知 */
.autoplay-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 16px 20px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 1000;
  animation: slideIn 0.3s ease-out;
  max-width: 400px;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.notification-text {
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--text-primary);
}

.notification-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}

.notification-close:hover {
  color: var(--text-primary);
}

@media (max-width: 999px) {
  .page-container {
    flex-direction: column;
  }

  .related-section {
    width: 100%;
    margin-top: 32px;
  }

  .related-item {
    gap: 10px;
  }

  .thumb-wrapper {
    width: 140px;
    height: 78.75px; /* 16:9 */
  }

  .video-title {
    font-size: 1.25rem;
  }

  .video-title-related {
    font-size: 0.9rem;
  }

  .video-metadata {
    font-size: 0.8rem;
  }

  .duration-badge {
    font-size: 0.65rem;
    padding: 1px 2px;
  }
}
</style>
