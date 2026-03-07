import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useSettingsStore = create(
  persist(
    (set) => ({
      // --- LLM mode ---
      llmProvider: "openai", // "openai" | "anthropic" | "local"
      llmApiKey: "",
      llmModel: "", // empty = use provider default
      llmEndpoint: "http://localhost:1234/v1", // used when provider = "local"
      llmPrompt: "", // empty = use built-in default
      llmIncludeLibraryTags: true,
      promptPresets: [], // [{ name: string, prompt: string }]

      // --- General ---
      autoSave: false,
      tagBlacklist: [], // string[]

      update: (patch) => set(patch),
    }),
    { name: "auto-tagger-settings" }
  )
);
