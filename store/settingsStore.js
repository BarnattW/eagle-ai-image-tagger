import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useSettingsStore = create(
  persist(
    (set) => ({
      // --- LLM mode ---
      llmProvider: "openai", // "openai" | "anthropic" | "local"
      llmApiKey: "",
      llmModelOpenAI: "",     // empty = use provider default (gpt-4o-mini)
      llmModelAnthropic: "",  // empty = use provider default (claude-haiku-4-5)
      llmModelLocal: "",      // empty = use whatever the local server has loaded
      llmEndpoint: "http://localhost:1234/v1", // used when provider = "local"
      llmPrompt: "",          // empty = use built-in default
      llmIncludeLibraryTags: true,
      llmLibraryPrompt: "",   // empty = use built-in default
      llmMaxTokens: 800,      // output token limit for local models (cloud uses fixed defaults)
      promptPresets: [],      // [{ name: string, prompt: string }]

      // --- General ---
      autoSave: false,
      generateOnSelect: true, // run LLM automatically when an image is selected
      tagBlacklist: [],       // string[]
      pinnedControls: [],     // string[] — filter control names pinned to the gallery top bar

      update: (patch) => set(patch),
    }),
    { name: "auto-tagger-settings" }
  )
);
