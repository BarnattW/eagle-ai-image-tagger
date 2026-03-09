// Bridge between Node.js (inference) and the browser-side React app.
// Eagle plugins run in Electron: the renderer cannot `require()` native modules directly,
// so this file runs in the main/preload context and attaches the API to window.__autoTaggerInference.
const { llmGenerateTags, configure: configureLlm } = require("../inference/llmService.js");
const { indexLibraryTags } = require("../inference/embeddingService.js");

// Map settings store keys to llmService config shape.
function configure(opts) {
  configureLlm({
    enabled: true,
    provider: opts.llmProvider,
    apiKey: opts.llmApiKey,
    model: opts.llmModel,
    endpoint: opts.llmEndpoint,
    prompt: opts.llmPrompt,
    includeLibraryTags: opts.llmIncludeLibraryTags,
    libraryPrompt: opts.llmLibraryPrompt,
    maxTokens: opts.llmMaxTokens,
  });
}

window.__autoTaggerInference = {
  llmGenerateTags,
  indexLibraryTags,
  configure,
};
