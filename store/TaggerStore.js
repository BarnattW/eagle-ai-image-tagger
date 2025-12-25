import { create } from "zustand";
import { dedupeTags, runTaggerLatest } from "../js/taggerService";
import { fetchUserTags, saveTagsToItem } from "../js/eagleService";

export const useTaggerStore = create((set, get) => ({
  items: [],
  selectedItem: null,
  autoTags: [],
  isGenerating: false,
  userTags: [],

  // Set initial items from Eagle bridge
  setItems: (newItems) => {
    const arr = newItems || [];
    set({ items: arr });

    const { selectedItem } = get();
    if (!selectedItem || !arr.some((x) => x.id === selectedItem.id)) {
      if (arr[0]) get().selectItem(arr[0]);
    }
  },

  // Main logic for selecting and running inference
  selectItem: async (item) => {
    set({ selectedItem: item, isGenerating: true, autoTags: [] });
    try {
      let genTags = await runTaggerLatest(item.filePath);
      const tags = dedupeTags(genTags, item.tags);
      console.log(tags)
      set({ autoTags: Array.isArray(tags) ? tags : [] });
    } catch (err) {
      console.error(err)
      set({ autoTags: [] });
    } finally {
      set({ isGenerating: false });
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

  // Tag manipulation
  addAutoTag: (tag) =>
    set((state) => ({
      autoTags: [...new Set([...state.autoTags, tag])],
    })),

  removeAutoTag: (tag) =>
    set((state) => ({
      autoTags: state.autoTags.filter((t) => t !== tag),
    })),

  setUserTags: (tags) => set({ userTags: tags }),

  saveTags: async () => {
    const { selectedItem, autoTags } = get();
    if (!selectedItem || autoTags.length === 0) return;

    try {
      const tags = dedupeTags(autoTags, selectedItem.tags);
      await saveTagsToItem(selectedItem, tags);
    } catch (e) {
      console.error("Failed to save tags:", e);
    }
  },
}));
