const { runTaggerLatest, configure: configureWd14 } = require("../inference/inference.js");
const { clipSuggestTags, configure: configureClip } = require("../inference/clipService.js");
const { llmGenerateTags, configure: configureLlm } = require("../inference/llmService.js");

function configure(opts) {
  configureWd14({
    modelPath: opts.modelPath || null,
    tagsPath: opts.tagsPath || null,
    thresholdGeneral: opts.thresholdGeneral,
    thresholdCharacter: opts.thresholdCharacter,
    topN: opts.topN,
  });
  configureClip({
    enabled: opts.clipEnabled,
    modelDir: opts.clipModelDir,
    threshold: opts.clipThreshold,
    topN: opts.clipTopN,
  });
  configureLlm({
    enabled: opts.inferenceMode === "llm",
    provider: opts.llmProvider,
    apiKey: opts.llmApiKey,
    model: opts.llmModel,
    endpoint: opts.llmEndpoint,
    prompt: opts.llmPrompt,
    includeLibraryTags: opts.llmIncludeLibraryTags,
  });
}

window.__autoTaggerInference = {
  runTaggerLatest,
  clipSuggestTags,
  llmGenerateTags,
  configure,
};
