const { llmGenerateTags, configure: configureLlm } = require("../inference/llmService.js");

function configure(opts) {
  configureLlm({
    enabled: true,
    provider: opts.llmProvider,
    apiKey: opts.llmApiKey,
    model: opts.llmModel,
    endpoint: opts.llmEndpoint,
    prompt: opts.llmPrompt,
    includeLibraryTags: opts.llmIncludeLibraryTags,
  });
}

window.__autoTaggerInference = {
  llmGenerateTags,
  configure,
};
