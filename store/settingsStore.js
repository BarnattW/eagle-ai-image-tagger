import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useSettingsStore = create(
  persist(
    (set) => ({
      // --- Inference mode ---
      inferenceMode: "local", // "local" | "llm"

      // --- Local mode: WD14 ---
      modelPath: "",
      tagsPath: "",
      thresholdGeneral: 0.6,
      thresholdCharacter: 0.9,
      topN: 15,

      // --- Local mode: CLIP library suggestions ---
      clipEnabled: false,
      clipModelDir: "",
      clipThreshold: 0.2,
      clipTopN: 10,

      // --- LLM mode ---
      llmProvider: "openai", // "openai" | "anthropic" | "local"
      llmApiKey: "",
      llmModel: "", // empty = use provider default
      llmEndpoint: "http://localhost:1234/v1", // used when provider = "local"
      llmPrompt: "", // empty = use built-in default
      llmIncludeLibraryTags: true,

      update: (patch) => set(patch),
    }),
    { name: "auto-tagger-settings" }
  )
);
