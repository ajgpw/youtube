<template>
  <div class="header-wrapper fixed-header">
    <button
      type="button"
      class="toggle-sidebar-button"
      @click="toggleSidebar"
      aria-label="サイドバーを切り替え"
    >
      <div
        style="width: 100%; height: 100%; display: block; fill: currentcolor"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="24"
          viewBox="0 0 24 24"
          width="24"
          focusable="false"
          aria-hidden="true"
          style="
            pointer-events: none;
            display: inherit;
            width: 100%;
            height: 100%;
          "
        >
          <path
            d="M20 5H4a1 1 0 000 2h16a1 1 0 100-2Zm0 6H4a1 1 0 000 2h16a1 1 0 000-2Zm0 6H4a1 1 0 000 2h16a1 1 0 000-2Z"
          ></path>
        </svg>
      </div>
    </button>

    <button
      type="button"
      class="home-button"
      @click="$router.push('/')"
      aria-label="トップページへ戻る"
      style="background: var(--bg-primary)"
    >
      <div
        style="
          all: unset;
          background: var(--bg-primary);
          height: 60%;
          display: block;
          fill: currentcolor;
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          id="yt-ringo2-svg_yt5"
          width="93"
          height="20"
          viewBox="0 0 93 20"
          focusable="false"
          aria-hidden="true"
          style="
            pointer-events: none;
            display: inherit;
            width: 100%;
            height: 100%;
          "
        >
          <g>
            <path
              d="M14.4848 20C14.4848 20 23.5695 20 25.8229 19.4C27.0917 19.06 28.0459 18.08 28.3808 16.87C29 14.65 29 9.98 29 9.98C29 9.98 29 5.34 28.3808 3.14C28.0459 1.9 27.0917 0.94 25.8229 0.61C23.5695 0 14.4848 0 14.4848 0C14.4848 0 5.42037 0 3.17711 0.61C1.9286 0.94 0.954148 1.9 0.59888 3.14C0 5.34 0 9.98 0 9.98C0 9.98 0 14.65 0.59888 16.87C0.954148 18.08 1.9286 19.06 3.17711 19.4C5.42037 20 14.4848 20 14.4848 20Z"
              fill="#FF0033"
            ></path>
            <path d="M19 10L11.5 5.75V14.25L19 10Z" fill="white"></path>
          </g>
          <g>
            <path
              d="M37.1384 18.8999V13.4399L40.6084 2.09994H38.0184L36.6984 7.24994C36.3984 8.42994 36.1284 9.65994 35.9284 10.7999H35.7684C35.6584 9.79994 35.3384 8.48994 35.0184 7.22994L33.7384 2.09994H31.1484L34.5684 13.4399V18.8999H37.1384Z"
            ></path>
            <path
              d="M44.1003 6.29994C41.0703 6.29994 40.0303 8.04994 40.0303 11.8199V13.6099C40.0303 16.9899 40.6803 19.1099 44.0403 19.1099C47.3503 19.1099 48.0603 17.0899 48.0603 13.6099V11.8199C48.0603 8.44994 47.3803 6.29994 44.1003 6.29994ZM45.3903 14.7199C45.3903 16.3599 45.1003 17.3899 44.0503 17.3899C43.0203 17.3899 42.7303 16.3499 42.7303 14.7199V10.6799C42.7303 9.27994 42.9303 8.02994 44.0503 8.02994C45.2303 8.02994 45.3903 9.34994 45.3903 10.6799V14.7199Z"
            ></path>
            <path
              d="M52.2713 19.0899C53.7313 19.0899 54.6413 18.4799 55.3913 17.3799H55.5013L55.6113 18.8999H57.6012V6.53994H54.9613V16.4699C54.6812 16.9599 54.0312 17.3199 53.4212 17.3199C52.6512 17.3199 52.4113 16.7099 52.4113 15.6899V6.53994H49.7812V15.8099C49.7812 17.8199 50.3613 19.0899 52.2713 19.0899Z"
            ></path>
            <path
              d="M62.8261 18.8999V4.14994H65.8661V2.09994H57.1761V4.14994H60.2161V18.8999H62.8261Z"
            ></path>
            <path
              d="M67.8728 19.0899C69.3328 19.0899 70.2428 18.4799 70.9928 17.3799H71.1028L71.2128 18.8999H73.2028V6.53994H70.5628V16.4699C70.2828 16.9599 69.6328 17.3199 69.0228 17.3199C68.2528 17.3199 68.0128 16.7099 68.0128 15.6899V6.53994H65.3828V15.8099C65.3828 17.8199 65.9628 19.0899 67.8728 19.0899Z"
            ></path>
            <path
              d="M80.6744 6.26994C79.3944 6.26994 78.4744 6.82994 77.8644 7.73994H77.7344C77.8144 6.53994 77.8744 5.51994 77.8744 4.70994V1.43994H75.3244L75.3144 12.1799L75.3244 18.8999H77.5444L77.7344 17.6999H77.8044C78.3944 18.5099 79.3044 19.0199 80.5144 19.0199C82.5244 19.0199 83.3844 17.2899 83.3844 13.6099V11.6999C83.3844 8.25994 82.9944 6.26994 80.6744 6.26994ZM80.7644 13.6099C80.7644 15.9099 80.4244 17.2799 79.3544 17.2799C78.8544 17.2799 78.1644 17.0399 77.8544 16.5899V9.23994C78.1244 8.53994 78.7244 8.02994 79.3944 8.02994C80.4744 8.02994 80.7644 9.33994 80.7644 11.7299V13.6099Z"
            ></path>
            <path
              d="M92.6517 11.4999C92.6517 8.51994 92.3517 6.30994 88.9217 6.30994C85.6917 6.30994 84.9717 8.45994 84.9717 11.6199V13.7899C84.9717 16.8699 85.6317 19.1099 88.8417 19.1099C91.3817 19.1099 92.6917 17.8399 92.5417 15.3799L90.2917 15.2599C90.2617 16.7799 89.9117 17.3999 88.9017 17.3999C87.6317 17.3999 87.5717 16.1899 87.5717 14.3899V13.5499H92.6517V11.4999ZM88.8617 7.96994C90.0817 7.96994 90.1717 9.11994 90.1717 11.0699V12.0799H87.5717V11.0699C87.5717 9.13994 87.6517 7.96994 88.8617 7.96994Z"
            ></path>
          </g>
        </svg>
      </div>
    </button>
    <form
      @submit.prevent="submitSearch"
      class="header-search"
      ref="searchFormRef"
    >
      <input
        type="text"
        v-model="query"
        @input="onInput"
        @keydown.down.prevent="moveSelection(1)"
        @keydown.up.prevent="moveSelection(-1)"
        @keydown.enter.prevent="onEnter"
        placeholder="キーワードを入力..."
        autocomplete="off"
        class="search-input"
        aria-label="Search"
      />
      <button
        v-if="query"
        type="button"
        class="clear-button"
        @click="clearQuery"
        aria-label="入力をクリア"
      >
        ×
      </button>

      <button type="submit" class="search-button" aria-label="検索">
        <img
          :src="isDarkMode ? searchIconBlack : searchiconIcon"
          alt="🔍"
          style="width: 20px; height: 20px"
        />
      </button>

      <ul v-if="suggestions.length" class="suggestions-list" role="listbox">
        <li
          v-for="(item, index) in suggestions"
          :key="index"
          :class="{ selected: index === selectedIndex }"
          @mousedown.prevent="onSuggestionClick(index)"
          role="option"
          :aria-selected="index === selectedIndex"
        >
          {{ item }}
        </li>
      </ul>
    </form>
  </div>
</template>

<script setup>
import searchiconIcon from "/Image/search-icon.txt?raw";
import searchIconBlack from "/Image/search-icon-black.txt?raw";

import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import {
  fetchSearchSuggestions,
  moveSelectionIndex,
} from "@/utils/searchManager";
import {
  loadDisplayMode,
  computeIsDarkFromMode,
} from "@/utils/settingsManager";

const emit = defineEmits([
  "search",
  "toggle-dark-mode",
  "toggle-sidebar",
]);

// Search state
const query = ref("");
const suggestions = ref([]);
const selectedIndex = ref(-1);
let fetchController = null;
const searchFormRef = ref(null);

const displayMode = ref("device");
const isDarkMode = ref(false);
let mq = null;
let mqHandler = null;
let classObserver = null;

const updateDarkFromDocClass = () => {
  try {
    isDarkMode.value =
      document && document.documentElement && document.documentElement.classList
        ? document.documentElement.classList.contains("dark-mode")
        : false;
  } catch (e) {
    isDarkMode.value = false;
  }
};

// Receive sidebar state from parent
const props = defineProps({ sidebarOpen: { type: Boolean, default: true } });

/**
 * 検索フォーム外クリックで候補を閉じる
 */
const onClickOutside = (event) => {
  if (searchFormRef.value && !searchFormRef.value.contains(event.target)) {
    suggestions.value = [];
    selectedIndex.value = -1;
  }
};
onMounted(() => {
  document.addEventListener("click", onClickOutside);

  // Load display mode (device/light/dark)
  try {
    displayMode.value = loadDisplayMode();
    isDarkMode.value = computeIsDarkFromMode(displayMode.value);
  } catch (e) {
    displayMode.value = "device";
    isDarkMode.value = computeIsDarkFromMode(displayMode.value);
  }

  // initialize from document class and observe changes so header icon updates when SettingsView toggles dark-mode
  try {
    updateDarkFromDocClass();
    if (window.MutationObserver) {
      classObserver = new MutationObserver(() => updateDarkFromDocClass());
      classObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  } catch (e) {}
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onClickOutside);
  // detach system color scheme listener if attached
  try {
    if (mq && mqHandler) {
      if (mq.removeEventListener) mq.removeEventListener("change", mqHandler);
      else if (mq.removeListener) mq.removeListener(mqHandler);
    }
  } catch (e) {}

  // disconnect mutation observer
  try {
    if (classObserver) classObserver.disconnect();
  } catch (e) {}
});

/**
 * 検索候補を取得
 */
const onInput = async () => {
  if (fetchController) fetchController.abort();
  fetchController = new AbortController();
  suggestions.value = await fetchSearchSuggestions(
    query.value.trim(),
    fetchController.signal
  );
  selectedIndex.value = -1;
};

/**
 * 選択を上下移動
 */
const moveSelection = (delta) => {
  selectedIndex.value = moveSelectionIndex(
    selectedIndex.value,
    delta,
    suggestions.value.length
  );
  if (selectedIndex.value >= 0) {
    query.value = suggestions.value[selectedIndex.value];
  }
};

/**
 * Enter キーで検索
 */
const onEnter = () => {
  submitSearch();
};

/**
 * 候補をクリック
 */
const onSuggestionClick = (index) => {
  query.value = suggestions.value[index];
  submitSearch();
};

/**
 * 検索を実行
 */
const submitSearch = () => {
  const trimmed = query.value.trim();
  if (!trimmed) return;
  suggestions.value = [];
  selectedIndex.value = -1;
  emit("search", trimmed);
};

/**
 * クリアボタン
 */
const clearQuery = () => {
  query.value = "";
  suggestions.value = [];
  selectedIndex.value = -1;
};

// ダークモード状態の監視
watch(
  isDarkMode,
  (newValue) => {
    // DOM更新トリガー用
  },
  { deep: true }
);

/**
 * サイドバー初期状態を設定
 */
/**
 * サイドバーをトグル（親に状態反映を依頼）
 */
const toggleSidebar = () => {
  emit("toggle-sidebar", !props.sidebarOpen);
};

// ビューポートは親が管理するようにしたためローカルでの監視は不要
</script>

<style scoped>
.toggle-sidebar-button {
  border: none;
  background: transparent;
  color: var(--text-primary);
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  margin-right: 8px;
  flex-shrink: 0;
}

.toggle-sidebar-button:hover {
  background-color: var(--hover-bg);
  border-radius: 4px;
}

.clear-button {
  position: absolute;
  right: 1.9em;
  bottom: -1px;
  background: transparent;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0 0.5em;
  height: calc(100% - 1px);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  user-select: none;
  transition: color 0.2s ease;
}

.clear-button:hover {
  color: var(--text-primary);
}

.header-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 100vw;
  padding: 0.5rem 1rem;
  box-sizing: border-box;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  height: 54px;
  position: fixed;
  top: 0;
  left: 0;
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.3s ease, color 0.3s ease,
    border-color 0.3s ease;
}

.home-button {
  border: none;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 16px;
  border-radius: 10%;
  width: auto;
  height: 36px;
  cursor: pointer;
  user-select: none;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.5s ease;
  flex-shrink: 0;
}

.home-button:hover {
  background: var(--hover-bg);
}

.header-search {
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 600px;
  margin: 0 auto;
  position: relative;
  height: 40px;
}

.search-input {
  flex: 1;
  height: 100%;
  padding: 5px 12px 7px 12px;
  line-height: 28px;
  border-radius: 20px 0 0 20px;
  border: 1px solid var(--search-border);
  outline: none;
  font-size: 0.9rem;
  box-sizing: border-box;
  text-align: left;
  vertical-align: middle;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease,
    border-color 0.3s ease;
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-button {
  border-radius: 0 20px 20px 0;
  border: 1px solid var(--search-border);
  border-left: none;
  background-color: var(--bg-secondary);
  cursor: pointer;
  padding: 0 0.75em;
  font-size: 1.1rem;
  user-select: none;
  height: 100%;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  transition: background-color 0.3s ease;
}

.search-button:hover {
  background-color: var(--hover-bg);
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-top: none;
  max-height: 250px;
  overflow-y: auto;
  z-index: 10;
  border-radius: 0 0 10px 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  transition: background-color 0.3s ease;
}

.suggestions-list li {
  padding: 0.5em 1em;
  cursor: pointer;
  color: var(--text-primary);
  transition: background-color 0.3s ease;
}

.suggestions-list li.selected,
.suggestions-list li:hover {
  background-color: var(--hover-bg);
}
</style>
