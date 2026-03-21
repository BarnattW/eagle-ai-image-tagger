// LLM inference service — two-pass tagging pipeline:
//   Pass 1 (vision): send the image to the LLM; it generates free-form Danbooru-style tags
//            with no library context, keeping the vision prompt short and focused.
//   Pass 2 (text-only): send the generated tags + a pre-filtered subset of the user's tag
//            library to a text LLM; it selects up to 5 library tags that match the image.
//            Pre-filtering is done locally (embeddingService) so the prompt stays small even
//            for large libraries.
const fs = require("fs");
const path = require("path");
const embeddingService = require("./embeddingService");

const DEFAULT_PROMPT =
  `IMPORTANT: Output ONLY valid JSON. NO explanations, NO markdown, NO extra text.` +
  `Analyze this image and generate 10-15 accurate Danbooru-style tags.\n` +
  `Cover all of the following categories that apply:\n` +
  `- Subject: 1girl, 1boy, multiple girls, no humans, animal, etc.\n` +
  `- Art style: anime, manga, realistic, painterly, sketch, chibi, pixel art, etc.\n` +
  `- Character: hair color/length/style, eye color, skin tone, facial expression\n` +
  `- Clothing & accessories: specific garment names, colors, patterns\n` +
  `- Pose & body: standing, sitting, lying, arms up, from behind, close-up, full body, etc.\n` +
  `- Action: looking at viewer, holding, eating, fighting, etc.\n` +
  `- Lighting: soft lighting, backlight, rim light, dramatic shadow, dark, bright, etc.\n` +
  `- Colors: dominant colors, monochrome, colorful, pastel, warm tones, etc.\n` +
  `- Background: simple background, outdoors, indoors, specific location\n` +
  `- Composition: portrait, dutch angle, wide shot, from above, from below\n` +
  `- Mood: happy, sad, serious, romantic, action, peaceful\n` +
  `Be specific and accurate. Only tag what is clearly visible. Do not guess.`;

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
};

const DEFAULT_LIBRARY_INSTRUCTION =
  `Select up to 5 tags from "My tag library" that clearly match what is described by the image tags — art style, characters, clothing, or setting.\n` +
  `Do NOT select organizational or collection tags (e.g. "Favorite", "Photos", "References", "To Sort") — only visual descriptions.\n` +
  `Be selective. Only include a tag if you are confident it applies.`;

let llmConfig = {
  enabled: false,
  provider: "openai",
  apiKey: "",
  model: "",
  endpoint: "http://localhost:1234/v1",
  prompt: "",
  includeLibraryTags: true,
  libraryPrompt: "",
  maxTokens: 800,
};

function configure(patch) {
  llmConfig = { ...llmConfig, ...patch };
}

function imageToBase64(imagePath) {
  return fs.readFileSync(imagePath).toString("base64");
}

function getMimeType(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
    }[ext] || "image/jpeg"
  );
}

function buildPrompt() {
  const base = llmConfig.prompt.trim() || DEFAULT_PROMPT;
  return `${base}\n\nOutput ONLY a JSON array (no explanations, no markdown): ["tag1", "tag2", ...]`;
}

async function callOpenAI(
  base64Image,
  mimeType,
  prompt,
  model,
  apiKey,
  baseUrl = "https://api.openai.com/v1",
  isLocal = false,
  signal,
) {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  // Local models (e.g. Qwen3 reasoning) need a system message to suppress chain-of-thought
  // and a much higher token budget so reasoning + JSON both fit.
  const messages = [];
  if (isLocal) {
    messages.push({
      role: "system",
      content:
        "You are a concise image tagging assistant. Output ONLY valid JSON. No thinking, no reasoning steps, no explanations.",
    });
  }
  messages.push({
    role: "user",
    content: [
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`,
          detail: "low",
        },
      },
      { type: "text", text: prompt },
    ],
  });

  const response = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: model || DEFAULT_MODELS.openai,
      messages,
      max_tokens: isLocal ? llmConfig.maxTokens || 800 : 1024,
      // Hint for LM Studio / llama.cpp to disable thinking mode (not supported by OpenAI)
      ...(isLocal && { chat_template_kwargs: { enable_thinking: false } }),
    }),
  });
  if (!response.ok)
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const msg = (await response.json()).choices[0].message;
  // Strip <think>...</think> blocks emitted by reasoning models
  return (msg.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function callAnthropic(
  base64Image,
  mimeType,
  prompt,
  model,
  apiKey,
  signal,
) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal,
    body: JSON.stringify({
      model: model || DEFAULT_MODELS.anthropic,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Image,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });
  if (!response.ok)
    throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  return (await response.json()).content[0].text;
}

function parseTagArray(rawText) {
  const cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\n?|\n?```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed))
      return parsed.filter((t) => typeof t === "string" && t.trim());
    const first = Object.values(parsed)[0];
    return Array.isArray(first)
      ? first.filter((t) => typeof t === "string")
      : [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*?\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return Array.isArray(parsed)
          ? parsed.filter((t) => typeof t === "string")
          : [];
      } catch {}
    }
    return [];
  }
}

async function callOpenAIText(prompt, model, apiKey, baseUrl, isLocal, signal) {
  const url = `${(baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const messages = [];
  if (isLocal) {
    messages.push({
      role: "system",
      content: "Output ONLY valid JSON. No thinking, no explanations.",
    });
  }
  messages.push({ role: "user", content: prompt });
  const response = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 200,
      // Hint for LM Studio / llama.cpp to disable thinking mode (not supported by OpenAI)
      ...(isLocal && { chat_template_kwargs: { enable_thinking: false } }),
    }),
  });
  if (!response.ok)
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  return ((await response.json()).choices[0].message.content ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

async function callAnthropicText(prompt, model, apiKey, signal) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal,
    body: JSON.stringify({
      model,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok)
    throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  return (await response.json()).content[0].text;
}

function buildLibraryMatchPrompt(generatedTags, candidates) {
  const instruction =
    llmConfig.libraryPrompt?.trim() || DEFAULT_LIBRARY_INSTRUCTION;
  return (
    `An image was tagged with: ${generatedTags.join(", ")}\n\n` +
    `My tag library contains: ${candidates.join(", ")}\n\n` +
    `${instruction}\n\n` +
    `IMPORTANT: You MUST only select tags from "My tag library" list above. Do NOT use the image tags.\n` +
    `Output ONLY a JSON array of library tags: ["tag1", "tag2", ...]`
  );
}

async function matchLibraryTags(generatedTags, signal) {
  const generatedSet = new Set(generatedTags.map((t) => t.toLowerCase()));
  const allCandidates = embeddingService.getLibraryCandidates(generatedTags);
  // Remove tags the LLM already generated — we only want additive library matches
  const candidates = allCandidates.filter((t) => !generatedSet.has(t.toLowerCase()));
  if (!candidates.length) return [];
  const model =
    llmConfig.model ||
    DEFAULT_MODELS[llmConfig.provider] ||
    DEFAULT_MODELS.openai;
  const isLocal = llmConfig.provider === "local";
  const prompt = buildLibraryMatchPrompt(generatedTags, candidates);
  const candidateSet = new Map(candidates.map((t) => [t.toLowerCase(), t]));
  try {
    const rawText =
      llmConfig.provider === "anthropic"
        ? await callAnthropicText(prompt, model, llmConfig.apiKey, signal)
        : await callOpenAIText(
            prompt,
            model,
            llmConfig.apiKey,
            isLocal ? llmConfig.endpoint : undefined,
            isLocal,
            signal,
          );
    // Only keep tags that actually exist in the candidate list — discard hallucinations
    return parseTagArray(rawText)
      .filter((t) => candidateSet.has(t.toLowerCase()))
      .map((t) => candidateSet.get(t.toLowerCase())) // normalize to original casing
      .slice(0, 5);
  } catch (e) {
    console.error("Library match error:", e.message);
    return [];
  }
}

async function llmGenerateTags(imagePath, thumbnailPath = null, signal) {
  const isLocal = llmConfig.provider === "local";
  if (!llmConfig.enabled || (!isLocal && !llmConfig.apiKey) || !imagePath)
    return { tags: [], library: [] };

  try {
    // Local vision models have limited KV cache; thumbnails use far fewer tokens
    const resolvedPath = isLocal && thumbnailPath ? thumbnailPath : imagePath;
    const base64Image = imageToBase64(resolvedPath);
    const mimeType = getMimeType(resolvedPath);
    const prompt = buildPrompt();
    const model =
      llmConfig.model ||
      DEFAULT_MODELS[llmConfig.provider] ||
      DEFAULT_MODELS.openai;
    const rawText =
      llmConfig.provider === "anthropic"
        ? await callAnthropic(
            base64Image,
            mimeType,
            prompt,
            model,
            llmConfig.apiKey,
            signal,
          )
        : await callOpenAI(
            base64Image,
            mimeType,
            prompt,
            model,
            llmConfig.apiKey,
            isLocal ? llmConfig.endpoint : undefined,
            isLocal,
            signal,
          );

    const cleanTags = parseTagArray(rawText);

    let library = [];
    if (llmConfig.includeLibraryTags && cleanTags.length > 0 && !signal?.aborted) {
      library = await matchLibraryTags(cleanTags, signal);
    }

    return { tags: cleanTags, library };
  } catch (err) {
    console.error("LLM error:", err.message);
    throw err;
  }
}

module.exports = {
  llmGenerateTags,
  configure,
  DEFAULT_PROMPT,
  DEFAULT_LIBRARY_INSTRUCTION,
};
