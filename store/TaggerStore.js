import { create } from "zustand";
import { dedupeTags, llmGenerateTags } from "../js/taggerService";
import { fetchUserTags, saveTagsToItem } from "../js/eagleService";
import { useSettingsStore } from "./settingsStore";

function humanizeError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("ERR_CONNECTION_REFUSED") || msg.includes("Failed to fetch"))
    return "Could not connect to the LLM server. Is it running?";
  if (msg.includes("401") || msg.includes("Unauthorized"))
    return "Invalid API key. Check your key in Settings.";
  if (msg.includes("429"))
    return "Rate limit exceeded. Try again in a moment.";
  if (msg.includes("404"))
    return "Model not found on the server. Check the model name in Settings.";
  if (msg.includes("Inference bridge not ready"))
    return "Plugin not fully loaded. Try reloading Eagle.";
  return msg;
}

// Module-level state for in-flight request management
let activeAbortController = null;
let debounceTimer = null;

async function runGeneration(item, signal, get, set) {
  const { tagBlacklist, autoSave } = useSettingsStore.getState();
  const blacklist = new Set((tagBlacklist || []).map((t) => t.toLowerCase()));
  const existing = item.tags || [];
  const cleanTags = (tags) =>
    dedupeTags(
      Array.isArray(tags) ? tags.filter((t) => !blacklist.has(t.toLowerCase())) : [],
      existing
    );

  set({ isGenerating: true });
  try {
    const userTags = get().userTags.map((t) => (typeof t === "string" ? t : t.name));
    const { tags, library } = await llmGenerateTags(item.filePath, userTags, item.thumbnailPath, signal);
    if (signal.aborted || get().selectedItem?.id !== item.id) return;
    set({ autoTags: cleanTags(tags), clipTags: cleanTags(library) });
    if (autoSave && get().autoTags.length > 0) await get().saveTags();
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error(err);
    if (get().selectedItem?.id === item.id)
      set({ autoTags: [], clipTags: [], inferenceError: humanizeError(err) });
  } finally {
    if (!signal.aborted && get().selectedItem?.id === item.id) set({ isGenerating: false });
  }
}

// Shared helper: persist an Eagle item's mutated tags back into Zustand state.
// Keeps the same object reference (spreading loses non-enumerable/prototype props).
function commitItem(set, item, extra = {}) {
  set((state) => ({
    tagVersion: state.tagVersion + 1,
    allItems: state.allItems.map((x) => x.id === item.id ? item : x),
    ...extra,
  }));
}

export const useTaggerStore = create((set, get) => ({
  items: [],
  selectedItem: null,
  autoTags: [],
  clipTags: [],
  isGenerating: false,
  inferenceError: null,
  userTags: [],
  allItems: [],
  batchProgress: null, // { current, total } | null
  batchCancelled: false,
  tagVersion: 0, // incremented on save/clear to force re-renders without replacing the Eagle item object

  setItems: (newItems) => {
    const arr = newItems || [];
    set({ items: arr });
    const { selectedItem } = get();
    if (!selectedItem || !arr.some((x) => x.id === selectedItem.id)) {
      if (arr[0]) get().selectItem(arr[0]);
    }
  },

  selectItem: (item) => {
    // Abort any in-flight request and clear pending debounce
    if (activeAbortController) activeAbortController.abort();
    clearTimeout(debounceTimer);

    // Immediately update UI — image preview switches instantly
    set({ selectedItem: item, autoTags: [], clipTags: [], isGenerating: false, inferenceError: null });

    const { generateOnSelect } = useSettingsStore.getState();
    if (!generateOnSelect) return;

    // Debounce: only start the LLM request after the user has settled on this image.
    // This prevents flooding the server when navigating quickly.
    debounceTimer = setTimeout(() => {
      if (get().selectedItem?.id !== item.id) return;
      activeAbortController = new AbortController();
      runGeneration(item, activeAbortController.signal, get, set);
    }, 400);
  },

  // Explicitly trigger generation for the current item, ignoring generateOnSelect.
  // Used by the Generate / Regenerate button so it always works regardless of that setting.
  generateItem: () => {
    const { selectedItem } = get();
    if (!selectedItem) return;
    if (activeAbortController) activeAbortController.abort();
    clearTimeout(debounceTimer);
    set({ autoTags: [], clipTags: [], isGenerating: false, inferenceError: null });
    activeAbortController = new AbortController();
    runGeneration(selectedItem, activeAbortController.signal, get, set);
  },

  loadUserTags: async () => {
    try {
      const tags = await fetchUserTags();
      set({ userTags: tags });
    } catch (e) {
      console.error("loadUserTags failed:", e);
      set({ userTags: [] });
    }
  },

  clearTags: () => set({ autoTags: [], clipTags: [] }),

  addAutoTag: (tag) =>
    set((state) => ({
      autoTags: [...new Set([...state.autoTags, tag])],
    })),

  removeAutoTag: (tag) =>
    set((state) => ({
      autoTags: state.autoTags.filter((t) => t !== tag),
    })),

  setUserTags: (tags) => set({ userTags: tags }),

  loadAllItems: async () => {
    try {
      const items = await eagle.item.getAll();
      set({ allItems: items || [] });
    } catch {
      set({ allItems: [] });
    }
  },

  cancelTagItems: () => set({ batchCancelled: true }),

  tagItems: async (items) => {
    if (!items.length) return;
    set({ batchProgress: { current: 0, total: items.length }, batchCancelled: false });
    const { tagBlacklist } = useSettingsStore.getState();
    const blacklist = new Set((tagBlacklist || []).map((t) => t.toLowerCase()));
    for (let i = 0; i < items.length; i++) {
      if (get().batchCancelled) break;
      const item = items[i];
      try {
        // Pass empty userTags in batch mode — no library matching, just generate fresh tags
        const { tags } = await llmGenerateTags(item.filePath, [], item.thumbnailPath);
        const allTags = tags || [];
        const filtered = allTags.filter((t) => !blacklist.has(t.toLowerCase()));
        if (filtered.length) {
          const newTags = dedupeTags(filtered, item.tags);
          if (newTags.length) {
            await saveTagsToItem(item, newTags);
            set((state) => ({
              allItems: state.allItems.map((x) =>
                x.id === item.id ? { ...x, tags: [...x.tags, ...newTags] } : x
              ),
            }));
          }
        }
      } catch (e) {
        console.error(`Failed to tag ${item.name}:`, e);
      }
      set({ batchProgress: { current: i + 1, total: items.length } });
    }

    set({ batchProgress: null, batchCancelled: false });
  },

  removeItemTag: async (tag) => {
    const { selectedItem } = get();
    if (!selectedItem) return;
    selectedItem.tags = selectedItem.tags.filter((t) => t !== tag);
    await selectedItem.save();
    commitItem(set, selectedItem);
  },

  clearItemTags: async () => {
    const { selectedItem } = get();
    if (!selectedItem) return;
    selectedItem.tags = [];
    await selectedItem.save();
    commitItem(set, selectedItem, { autoTags: [], clipTags: [] });
  },

  saveTags: async () => {
    const { selectedItem, autoTags } = get();
    if (!selectedItem || autoTags.length === 0) return;
    const newTags = dedupeTags(autoTags, selectedItem.tags);
    await saveTagsToItem(selectedItem, newTags); // mutates selectedItem.tags in place
    commitItem(set, selectedItem, { autoTags: [], clipTags: [] });
  },
}));
