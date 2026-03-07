import { create } from "zustand";
import { dedupeTags, runTaggerLatest, clipSuggestTags, llmGenerateTags } from "../js/taggerService";
import { fetchUserTags, saveTagsToItem } from "../js/eagleService";
import { useSettingsStore } from "./settingsStore";

function humanizeError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("ENOENT") || msg.includes("no such file"))
    return "Model file not found. Check the paths in Settings.";
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

export const useTaggerStore = create((set, get) => ({
  items: [],
  selectedItem: null,
  autoTags: [],
  clipTags: [],
  isGenerating: false,
  inferenceError: null,
  clipWarning: null,
  userTags: [],
  allItems: [],
  batchProgress: null, // { current, total } | null

  setItems: (newItems) => {
    const arr = newItems || [];
    set({ items: arr });
    const { selectedItem } = get();
    if (!selectedItem || !arr.some((x) => x.id === selectedItem.id)) {
      if (arr[0]) get().selectItem(arr[0]);
    }
  },

  selectItem: async (item) => {
    set({ selectedItem: item, isGenerating: true, autoTags: [], clipTags: [], inferenceError: null, clipWarning: null });
    const { inferenceMode, clipEnabled } = useSettingsStore.getState();

    try {
      if (inferenceMode === "llm") {
        const userTags = get().userTags.map((t) => (typeof t === "string" ? t : t.name));
        const { tags, library } = await llmGenerateTags(item.filePath, userTags);
        if (get().selectedItem?.id !== item.id) return;
        set({ autoTags: tags, clipTags: library });
      } else {
        // Local: WD14 first, show immediately, then CLIP in background
        const genTags = await runTaggerLatest(item.filePath);
        if (get().selectedItem?.id !== item.id) return;
        set({ autoTags: Array.isArray(genTags) ? genTags : [], isGenerating: false });

        if (clipEnabled) {
          try {
            const userTags = get().userTags.map((t) => (typeof t === "string" ? t : t.name));
            const suggested = await clipSuggestTags(
              item.filePath,
              userTags,
              Array.isArray(genTags) ? genTags : []
            );
            if (get().selectedItem?.id !== item.id) return;
            set({ clipTags: Array.isArray(suggested) ? suggested : [] });
          } catch (clipErr) {
            if (get().selectedItem?.id === item.id)
              set({ clipWarning: humanizeError(clipErr) });
          }
        }
      }
    } catch (err) {
      console.error(err);
      if (get().selectedItem?.id === item.id)
        set({ autoTags: [], clipTags: [], inferenceError: humanizeError(err) });
    } finally {
      if (get().selectedItem?.id === item.id) set({ isGenerating: false });
    }
  },

  loadUserTags: async () => {
    try {
      const tags = await fetchUserTags();
      set({ userTags: tags });
    } catch {
      set({ userTags: [] });
    }
  },

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

  tagItems: async (items) => {
    if (!items.length) return;
    set({ batchProgress: { current: 0, total: items.length } });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const genTags = await runTaggerLatest(item.filePath);
        if (genTags && genTags.length) {
          const tags = dedupeTags(genTags, item.tags);
          if (tags.length) {
            await saveTagsToItem(item, tags);
            set((state) => ({
              allItems: state.allItems.map((x) =>
                x.id === item.id ? { ...x, tags: [...x.tags, ...tags] } : x
              ),
            }));
          }
        }
      } catch (e) {
        console.error(`Failed to tag ${item.name}:`, e);
      }
      set({ batchProgress: { current: i + 1, total: items.length } });
    }

    set({ batchProgress: null });
  },

  saveTags: async () => {
    const { selectedItem, autoTags } = get();
    if (!selectedItem || autoTags.length === 0) return;
    const newTags = dedupeTags(autoTags, selectedItem.tags);
    await saveTagsToItem(selectedItem, newTags);
    set({
      autoTags: [],
      clipTags: [],
      selectedItem: { ...selectedItem, tags: [...selectedItem.tags, ...newTags] },
    });
  },
}));
