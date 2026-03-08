const fs = require("fs");
const path = require("path");

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
  `Select up to 5 tags from that list that clearly describe something visible in this image — art style, characters, clothing, or setting.\n` +
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

function buildPrompt(userTags) {
  const base = llmConfig.prompt.trim() || DEFAULT_PROMPT;
  if (llmConfig.includeLibraryTags && userTags?.length > 0) {
    const tagList = userTags.slice(0, 200).join(", ");
    const libraryInstruction = llmConfig.libraryPrompt?.trim() || DEFAULT_LIBRARY_INSTRUCTION;
    return (
      `${base}\n\n` +
      `LIBRARY MATCHING:\n` +
      `Here are tags already in my collection: ${tagList}\n` +
      `${libraryInstruction}\n\n` +
      `Output ONLY this JSON (no explanations, no markdown):\n` +
      `{"tags": ["newly generated tags"], "library": ["matched library tags"]}`
    );
  }
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
      content: "You are a concise image tagging assistant. Output ONLY valid JSON. No thinking, no reasoning steps, no explanations.",
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
      max_tokens: isLocal ? 8192 : 1024,
      // Hint for LM Studio / llama.cpp to disable thinking mode
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!response.ok)
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const msg = (await response.json()).choices[0].message;
  // Strip <think>...</think> blocks emitted by reasoning models
  return (msg.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function callAnthropic(base64Image, mimeType, prompt, model, apiKey, signal) {
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

function parseTags(rawText, hasLibrary) {
  try {
    const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (hasLibrary) {
      return {
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        library: Array.isArray(parsed.library) ? parsed.library : [],
      };
    }
    if (Array.isArray(parsed)) return { tags: parsed, library: [] };
    const first = Object.values(parsed)[0];
    return { tags: Array.isArray(first) ? first : [], library: [] };
  } catch {
    const match = rawText.match(/\[[\s\S]*?\]|\{[\s\S]*?\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return { tags: parsed, library: [] };
        return {
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          library: Array.isArray(parsed.library) ? parsed.library : [],
        };
      } catch {}
    }
    return { tags: [], library: [] };
  }
}

async function llmGenerateTags(imagePath, userTags = [], thumbnailPath = null, signal) {
  const isLocal = llmConfig.provider === "local";
  if (!llmConfig.enabled || (!isLocal && !llmConfig.apiKey) || !imagePath)
    return { tags: [], library: [] };

  try {
    // Local vision models have limited KV cache; thumbnails use far fewer tokens
    const resolvedPath = (isLocal && thumbnailPath) ? thumbnailPath : imagePath;
    const base64Image = imageToBase64(resolvedPath);
    const mimeType = getMimeType(resolvedPath);
    const hasLibrary = llmConfig.includeLibraryTags && userTags.length > 0;
    const prompt = buildPrompt(hasLibrary ? userTags : null);
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

    const { tags, library } = parseTags(rawText, hasLibrary);
    return {
      tags: tags.filter((t) => typeof t === "string" && t.trim()),
      library: library.slice(0, 5).filter((t) => typeof t === "string" && t.trim()),
    };
  } catch (err) {
    console.error("LLM error:", err.message);
    throw err;
  }
}

module.exports = { llmGenerateTags, configure, DEFAULT_PROMPT, DEFAULT_LIBRARY_INSTRUCTION };
