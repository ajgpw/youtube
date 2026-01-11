<template>
  <div>
    <!-- 通常読み込み中 -->
    <div v-if="loading || retrying" class="loading">{{ retrying ? "再読み込み中…" : "読み込み中…" }}</div>

    <!-- エラー表示 -->
    <div v-if="error" class="error">
      {{ error }}
      <button 
        @click="retry" 
        class="retry-btn" 
        :disabled="retrying"
      >
        {{ retrying ? "再読み込み中…" : "再試行" }}
      </button><br>右上の設定マークからカスタムエンドポイントのを追加してください　＊方法は簡単で1~3分で作れます
    </div>

    <!-- 成功時の動画リスト -->
    <VideoList
      v-if="!loading && !error && videos.length"
      :videos="videos"
      :title="`検索結果: ${query}`"
    />

    <!-- 検索結果なし -->
    <div v-if="!loading && !error && videos.length === 0" class="no-results">
      検索結果が見つかりませんでした。
    </div>
  </div>
</template>

<script>
import VideoList from "@/components/VideoList.vue";
import { apiRequest } from "@/services/requestManager";

export default {
  components: { VideoList },
  props: {
    query: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      videos: [],
      loading: false,
      error: null,
      lastQuery: "",
      retrying: false,
    };
  },
  watch: {
    query: {
      immediate: true,
      handler(newQuery) {
        document.title = newQuery ? `${newQuery} - 検索` : "検索結果";
        if (newQuery) {
          this.lastQuery = newQuery;
          this.fetchSearchResults(newQuery);
        } else {
          this.videos = [];
        }
      },
    },
  },
  methods: {
    async fetchSearchResults(q) {
      // 通常の検索呼び出しか再試行かでフラグ設定
      if (!this.retrying) this.loading = true;
      this.error = null;
      this.videos = [];  // 検索開始時にクリア

      try {
        const data = await apiRequest({
          params: { q },
          retries: 2,
          timeout: 15000,
          jsonpFallback: false,
        });

        // レスポンスがエラーオブジェクトの場合
        if (data && typeof data === 'object' && data.error) {
          this.error = "メインサーバーから無効な応答が帰ってきました";
          this.videos = [];
          return;
        }

        this.videos = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn("fetchSearchResults error:", e);
        this.error = "検索APIの取得に失敗しました";
        this.videos = [];
      } finally {
        this.loading = false;
        this.retrying = false;
      }
    },
    retry() {
      if (!this.lastQuery) return;
      this.retrying = true;
      this.fetchSearchResults(this.lastQuery);
    },
  },
};
</script>

<style scoped>
.loading { 
  padding: 1rem; 
  text-align: center; 
  font-weight: bold;
  color: var(--text-primary);
  background-color: var(--bg-primary);
}

.error { 
  color: var(--accent-weak); 
  padding: 1rem; 
  text-align: center; 
}

.retry-btn {
  margin-left: 1rem;
  padding: 0.3rem 0.8rem;
  background-color: var(--accent-color);
  color: var(--on-accent);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.retry-btn:disabled {
  background-color: var(--border-color);
  cursor: not-allowed;
  color: var(--text-secondary);
}

.retry-btn:hover:not(:disabled) { 
  background-color: var(--accent-dark);
  color: var(--on-accent);
}

.no-results { 
  padding: 1rem; 
  text-align: center; 
  color: var(--text-secondary); 
}
</style>
