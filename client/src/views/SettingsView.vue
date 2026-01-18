<template>
  <div class="settings-wrapper" v-if="modalIsOpen">
    <div class="settings-modal-overlay" @click.self="closeSettings"></div>
    <div class="settings-modal" @click.stop>
      <!-- ヘッダー -->
      <div class="settings-modal-header">
        <h2>設定</h2>
        <button type="button" class="close-button" @click="closeSettings" aria-label="設定を閉じる">
          ✕
        </button>
      </div>

      <!-- コンテンツ -->
      <div class="settings-modal-content">

        <!-- デフォルト再生方式 -->
        <section class="settings-section">
          <h3>デフォルト再生方式</h3>
          <label><input type="radio" :checked="defaultPlaybackMode === '1'" @change="handlePlaybackModeChange('1')" /> 通常</label>
          <label><input type="radio" :checked="defaultPlaybackMode === '2'" @change="handlePlaybackModeChange('2')" /> タイプ２</label>
        </section>

        <!-- 短動画フィルタ設定 -->
        <section class="settings-section">
          <h3>自動再生フィルタ</h3>
          <label>
            <input
              type="checkbox"
              :checked="shortVideoFilterEnabled"
              @change="handleFilterEnabledChange($event.target.checked)"
            />
            指定時間以下の動画のみ自動再生
          </label>
          <div v-if="shortVideoFilterEnabled" class="filter-time">
            <label>
              制限時間（分）:
              <input
                type="number"
                :value="shortVideoFilterMinutes"
                @change="handleFilterMinutesChange(+$event.target.value)"
                min="1"
                max="120"
                step="1"
              />
            </label><br>
            <small>{{ shortVideoFilterMinutes }}分以下の動画のみが自動再生対象になります</small>
          </div>
        </section>

        <!-- 表示設定（デバイスに合わせる / ライト / ダーク） -->
        <section class="settings-section">
          <h3>表示設定</h3>
          <label><input type="radio" :checked="displayMode === 'device'" @change="handleDisplayModeChange('device')" /> デバイスに合わせる</label>
          <label><input type="radio" :checked="displayMode === 'light'" @change="handleDisplayModeChange('light')" /> ライトモード</label>
          <label><input type="radio" :checked="displayMode === 'dark'" @change="handleDisplayModeChange('dark')" /> ダークモード</label>
        </section>

        <!-- その他 -->
        <section class="settings-section">
          <h3>その他</h3>
          <label>
            <input
              type="checkbox"
              :checked="jsonpOnlyForCustom"
              @change="handleJsonpOnlyChange($event.target.checked)"
            />
            カスタムエンドポイントはJSONPのみを使用（fetchへフォールバックしない）
          </label>
          <label>
            <input
              type="checkbox"
              :checked="disableTimeouts"
              @change="handleDisableTimeoutsChange($event.target.checked)"
            />
            タイムアウトを無効化
          </label>
        </section>
      </div>

      <!-- フッター -->
      <div class="settings-modal-footer">
        <!--
        <button type="button" class="cancel-button" @click="closeSettings">キャンセル</button>
        -->
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject, watch, computed } from 'vue';
import CustomEndpointsHelp from "@/components/CustomEndpointsHelp.vue";
import {
  loadCustomEndpoints as rmLoadCustomEndpoints,
  saveCustomEndpoints as rmSaveCustomEndpoints,
  loadMode as rmLoadMode,
  saveMode as rmSaveMode,
} from "@/services/requestManager";
import {
  loadDefaultPlayback,
  saveDefaultPlayback,
  loadShortVideoFilter,
  saveShortVideoFilter,
  loadDisplayMode,
  saveDisplayMode,
  computeIsDarkFromMode,
  loadCustomEndpointsJsonpOnly,
  saveCustomEndpointsJsonpOnly,
  isValidUrl,
} from "@/utils/settingsManager";

// Inject settings modal state
const settingsModal = inject('settingsModal', {});
console.log('[SettingsView.vue] Injected settingsModal:', settingsModal);
console.log('[SettingsView.vue] settingsModal.isOpen:', settingsModal?.isOpen);

// Settings state
const customEndpoints = ref([]);
const newEndpoint = ref("");
const mode = ref("existing");
const defaultPlaybackMode = ref("1");
const shortVideoFilterEnabled = ref(false);
const shortVideoFilterMinutes = ref(4);
const displayMode = ref('device');
const jsonpOnlyForCustom = ref(false);
const disableTimeouts = ref(true);

// Backup state (for cancel functionality)
const backupState = ref({});

// localStorage キー
const STORAGE_KEY = 'youtube_settings';

onMounted(() => {
  console.log('[SettingsView.vue] onMounted called');
  console.log('[SettingsView.vue] Current settingsModal.isOpen value:', settingsModal?.isOpen?.value);
  loadSettings();
  // apply current display mode to document
  try {
    applyDisplayMode(displayMode.value);
  } catch (e) {}
  saveBackup();
  
  // 設定をlocalStorageに保存するwatcher
  watch([customEndpoints, mode, defaultPlaybackMode, shortVideoFilterEnabled, shortVideoFilterMinutes, displayMode, jsonpOnlyForCustom], 
    () => {
      saveToLocalStorage();
    },
    { deep: true }
  );
});

// computed boolean for template v-if — explicitly unwrap the ref value
const modalIsOpen = computed(() => {
  try {
    if (settingsModal && settingsModal.isOpen && typeof settingsModal.isOpen.value !== 'undefined') {
      return !!settingsModal.isOpen.value;
    }
    // Fallback to localStorage if injected ref is missing
    const stored = localStorage.getItem('settingsModalOpen');
    return stored === 'true';
  } catch (e) {
    return false;
  }
});

// watch underlying ref for debugging
if (settingsModal && settingsModal.isOpen) {
  watch(settingsModal.isOpen, (v) => {
    console.log('[SettingsView.vue] watch: settingsModal.isOpen changed ->', v);
  });
}

// When modal opens, save backup of current settings so Cancel can restore
watch(modalIsOpen, (open) => {
  console.log('[SettingsView.vue] watch: modalIsOpen ->', open);
  if (open) saveBackup();
});

// Watch displayMode so changes from elsewhere also apply immediately
watch(displayMode, (v) => {
  try {
    applyDisplayMode(v);
  } catch (e) {}
});

const loadSettings = () => {
  // First try to load from localStorage
  try {
    const savedSettings = loadFromLocalStorage();
    if (savedSettings) {
      console.log('[SettingsView.vue] Loading settings from localStorage:', savedSettings);
      customEndpoints.value = savedSettings.customEndpoints || [];
      mode.value = savedSettings.mode || 'existing';
      defaultPlaybackMode.value = savedSettings.defaultPlaybackMode || '1';
      shortVideoFilterEnabled.value = savedSettings.shortVideoFilterEnabled || false;
      shortVideoFilterMinutes.value = savedSettings.shortVideoFilterMinutes || 4;
      displayMode.value = savedSettings.displayMode || 'device';
      return;
    }
  } catch (e) {
    console.warn('[SettingsView.vue] Failed to load from localStorage:', e);
  }

  // Load custom endpoints
  try {
    customEndpoints.value = rmLoadCustomEndpoints() || [];
  } catch (e) {
    customEndpoints.value = [];
  }

  // Load mode
  try {
    const m = rmLoadMode();
    if (m) mode.value = m;
  } catch (e) {}

  // Load default playback mode
  defaultPlaybackMode.value = loadDefaultPlayback();

  // Load short video filter
  const filter = loadShortVideoFilter();
  shortVideoFilterEnabled.value = filter.enabled;
  shortVideoFilterMinutes.value = filter.minutes;

  // Load display mode (device/light/dark)
  try {
    displayMode.value = loadDisplayMode();
  } catch (e) {
    displayMode.value = 'device';
  }

  // JSONPのみ設定の読み込み（カスタムエンドポイント用）
  try {
    jsonpOnlyForCustom.value = loadCustomEndpointsJsonpOnly();
  } catch (e) {
    jsonpOnlyForCustom.value = false;
  }
  // タイムアウト無効化設定を読み込み
  try {
    disableTimeouts.value = loadDisableTimeouts();
  } catch (e) {
    disableTimeouts.value = true;
  }
};

const saveBackup = () => {
  backupState.value = {
    customEndpoints: JSON.parse(JSON.stringify(customEndpoints.value)),
    newEndpoint: newEndpoint.value,
    mode: mode.value,
    defaultPlaybackMode: defaultPlaybackMode.value,
    shortVideoFilterEnabled: shortVideoFilterEnabled.value,
    shortVideoFilterMinutes: shortVideoFilterMinutes.value,
    displayMode: displayMode.value,
    jsonpOnlyForCustom: jsonpOnlyForCustom.value,
  };
};

const closeSettings = () => {
  console.log('[SettingsView.vue] closeSettings called - closing modal without resetting changes');
  
  // Close modal via injected function (changes are already saved via watchers)
  if (settingsModal?.closeSettingsModal) {
    console.log('[SettingsView.vue] Calling closeSettingsModal()');
    settingsModal.closeSettingsModal();
  } else {
    console.warn('[SettingsView.vue] WARNING: closeSettingsModal is not available');
  }
};

// Event handlers
const handleModeChange = (newMode) => {
  mode.value = newMode;
  try {
    rmSaveMode(newMode);
  } catch (e) {}
};

const handlePlaybackModeChange = (newMode) => {
  defaultPlaybackMode.value = newMode;
  saveDefaultPlayback(newMode);
};

const handleFilterEnabledChange = (enabled) => {
  shortVideoFilterEnabled.value = enabled;
  saveShortVideoFilter(enabled, shortVideoFilterMinutes.value);
};

const handleFilterMinutesChange = (minutes) => {
  shortVideoFilterMinutes.value = minutes;
  saveShortVideoFilter(shortVideoFilterEnabled.value, minutes);
};

const applyDisplayMode = (mode) => {
  try {
    const isDark = computeIsDarkFromMode(mode);
    console.log(`[SettingsView] applyDisplayMode: mode=${mode} -> isDark=${isDark}`);
    if (isDark) document.documentElement.classList.add('dark-mode');
    else document.documentElement.classList.remove('dark-mode');
    // do NOT set darkMode here to avoid legacy key conflicts
    // displayMode is the source of truth, darkMode is only for legacy compatibility
  } catch (e) {
    console.error('[SettingsView] applyDisplayMode error', e);
  }
};

const handleDisplayModeChange = (newMode) => {
  displayMode.value = newMode;
  try {
    saveDisplayMode(newMode);
  } catch (e) {}
  // immediately apply
  applyDisplayMode(newMode);
};

const handleJsonpOnlyChange = (enabled) => {
  jsonpOnlyForCustom.value = !!enabled;
  try {
    saveCustomEndpointsJsonpOnly(!!enabled);
  } catch (e) {
    console.warn('[SettingsView.vue] Failed to persist jsonpOnlyForCustom', e);
  }
};

const handleDisableTimeoutsChange = (enabled) => {
  disableTimeouts.value = !!enabled;
  try {
    saveDisableTimeouts(!!enabled);
  } catch (e) {
    console.warn('[SettingsView.vue] Failed to persist disableTimeouts', e);
  }
};

const handleNewEndpointChange = (value) => {
  newEndpoint.value = value;
};

const addEndpoint = () => {
  const v = newEndpoint.value.trim();
  if (!v) return;
  if (!isValidUrl(v)) {
    alert("有効なURLを入力してください。");
    return;
  }
  if (customEndpoints.value.includes(v)) {
    alert("既に追加されています。");
    newEndpoint.value = "";
    return;
  }
  customEndpoints.value.push(v);
  newEndpoint.value = "";
  rmSaveCustomEndpoints(customEndpoints.value);

  // Automatically switch API mode to "custom" when a custom endpoint is added
  try {
    mode.value = 'custom';
    rmSaveMode('custom');
  } catch (e) {
    console.warn('[SettingsView.vue] Failed to persist api mode change to custom', e);
  }
};

const removeEndpoint = (index) => {
  customEndpoints.value.splice(index, 1);
  rmSaveCustomEndpoints(customEndpoints.value);
};

// localStorage関連の関数
const saveToLocalStorage = () => {
  try {
    const settingsData = {
      customEndpoints: customEndpoints.value,
      mode: mode.value,
      defaultPlaybackMode: defaultPlaybackMode.value,
      shortVideoFilterEnabled: shortVideoFilterEnabled.value,
      shortVideoFilterMinutes: shortVideoFilterMinutes.value,
      jsonpOnlyForCustom: jsonpOnlyForCustom.value,
      disableTimeouts: disableTimeouts.value,
      displayMode: displayMode.value,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsData));
    console.log('[SettingsView.vue] Settings saved to localStorage:', settingsData);
  } catch (e) {
    console.error('[SettingsView.vue] Failed to save to localStorage:', e);
  }
};

const loadFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      console.log('[SettingsView.vue] Loaded from localStorage:', data);
      if (typeof data.jsonpOnlyForCustom !== 'undefined') jsonpOnlyForCustom.value = !!data.jsonpOnlyForCustom;
      if (typeof data.disableTimeouts !== 'undefined') disableTimeouts.value = !!data.disableTimeouts;
      return data;
    }
  } catch (e) {
    console.error('[SettingsView.vue] Failed to load from localStorage:', e);
  }
  return null;
};

const clearLocalStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[SettingsView.vue] localStorage cleared');
  } catch (e) {
    console.error('[SettingsView.vue] Failed to clear localStorage:', e);
  }
};
</script>

<style scoped>
.settings-wrapper {
  /* 廃止 */
}

.settings-modal-overlay {
  position: fixed;
  top: 52px;
  left: var(--sidebar-offset, 250px);
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  animation: fadeIn 0.3s ease;
  pointer-events: auto;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.settings-modal {
  position: fixed;
  top: 52px;
  left: var(--sidebar-offset, 250px); /* CSS variable を使ってサイドバー幅に追従 */
  bottom: 0;
  width: 380px;
  max-width: none;
  background-color: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  animation: slideInLeft 0.3s ease;
  transition: background-color 0.3s ease, border-color 0.3s ease;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
}

@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

.settings-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.settings-modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: var(--text-primary);
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-primary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  border-radius: 4px;
}

.close-button:hover {
  background-color: var(--hover-bg);
}

.settings-modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-section {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 16px;
  border-radius: 8px;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.settings-section h3 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.mode-group label,
.settings-section label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
}

.mode-group label input,
.settings-section label input {
  margin-right: 8px;
  accent-color: var(--accent-color);
  cursor: pointer;
}

.filter-time {
  margin-top: 12px;
  padding: 12px;
  background-color: var(--bg-primary);
  border-radius: 4px;
  border-left: 3px solid var(--accent-color);
}

.filter-time label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.filter-time input[type="number"] {
  width: 80px;
  padding: 6px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.filter-time small {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.custom-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 0;
  margin: 0 0 12px 0;
  list-style: none;
}

.custom-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  margin-bottom: 4px;
  background-color: var(--bg-primary);
  border-radius: 4px;
  border: 1px solid var(--border-color);
  font-size: 0.85rem;
}

.endpoint-text {
  word-break: break-all;
  margin-right: 8px;
  flex: 1;
  color: var(--text-primary);
}

.remove-btn {
  background: var(--danger-weak);
  border: none;
  color: var(--danger-text);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.remove-btn:hover {
  opacity: 0.8;
}

.add-row {
  display: flex;
  gap: 8px;
}

.add-row input[type="text"] {
  flex: 1;
  padding: 8px;
  font-size: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

.add-row input[type="text"]:focus {
  outline: none;
  border-color: var(--accent-color);
}

.add-row button {
  padding: 8px 12px;
  cursor: pointer;
  background-color: var(--accent-color);
  color: var(--on-accent);
  border: none;
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.85rem;
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.add-row button:hover {
  opacity: 0.8;
}

.settings-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}

.cancel-button {
  padding: 8px 16px;
  cursor: pointer;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.cancel-button:hover {
  background-color: var(--hover-bg);
}

@media (max-width: 768px) {
  .settings-modal {
    left: 0;
    width: 100%;
  }
}

@media (max-width: 1314px) and (min-width: 790px) {
  .settings-modal {
    left: var(--sidebar-offset, 250px);
  }
}

:deep(body.sidebar-compact) .settings-modal {
  left: 70px !important;
  width: 380px !important;
}

:deep(body.sidebar-hidden) .settings-modal {
  left: 0 !important;
  width: 367px !important;
}

/* Ensure fallback CSS variable exists on body for non-JS environments */
:deep(html) {
  --sidebar-offset: 250px;
}
</style>
