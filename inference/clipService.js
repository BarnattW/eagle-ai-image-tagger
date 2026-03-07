const ort = require("onnxruntime-node");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { loadTokenizer } = require("./clipTokenizer.js");

const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073];
const CLIP_STD = [0.26862954, 0.26130258, 0.27577711];
const CLIP_SIZE = 224;
const CONTEXT_LEN = 77;

let clipConfig = {
  enabled: false,
  modelDir: "",
  threshold: 0.2,
  topN: 10,
};

let sessions = null; // { vision, text }
let tokenizer = null;
let tagEmbeddingCache = new Map();
let initError = null;

function configure(patch) {
  const dirChanged = patch.modelDir !== undefined && patch.modelDir !== clipConfig.modelDir;
  clipConfig = { ...clipConfig, ...patch };
  if (!clipConfig.enabled || dirChanged) {
    sessions = null;
    tokenizer = null;
    tagEmbeddingCache.clear();
    initError = null;
  }
}

async function loadSessions() {
  if (sessions) return sessions;
  if (initError) throw initError;
  if (!clipConfig.modelDir) throw new Error("CLIP model directory not configured");

  try {
    const dir = clipConfig.modelDir;

    const visionPath = [
      path.join(dir, "vision_model.onnx"),
      path.join(dir, "vision_model_quantized.onnx"),
    ].find((p) => fs.existsSync(p));

    const textPath = [
      path.join(dir, "text_model.onnx"),
      path.join(dir, "text_model_quantized.onnx"),
    ].find((p) => fs.existsSync(p));

    if (!visionPath) throw new Error(`vision_model.onnx not found in: ${dir}`);
    if (!textPath) throw new Error(`text_model.onnx not found in: ${dir}`);

    const tokenizerPath = path.join(dir, "tokenizer.json");
    if (!fs.existsSync(tokenizerPath)) throw new Error(`tokenizer.json not found in: ${dir}`);

    const [vision, text] = await Promise.all([
      ort.InferenceSession.create(visionPath),
      ort.InferenceSession.create(textPath),
    ]);

    tokenizer = loadTokenizer(tokenizerPath);
    sessions = { vision, text };
    console.log("CLIP models loaded.");
    return sessions;
  } catch (err) {
    initError = err;
    throw err;
  }
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

// Batch-compute text embeddings for all uncached tags in one ONNX call.
// Chunked to avoid oversized tensors (32 tags per chunk).
const TEXT_BATCH_SIZE = 32;

async function warmTextEmbeddings(tags, textSession) {
  const uncached = tags.filter((t) => !tagEmbeddingCache.has(t));
  if (!uncached.length) return;

  for (let offset = 0; offset < uncached.length; offset += TEXT_BATCH_SIZE) {
    const chunk = uncached.slice(offset, offset + TEXT_BATCH_SIZE);
    const n = chunk.length;

    const inputIds = new BigInt64Array(n * CONTEXT_LEN);
    const attnMask = new BigInt64Array(n * CONTEXT_LEN);
    for (let i = 0; i < n; i++) {
      const ids = tokenizer.tokenize(chunk[i]);
      for (let j = 0; j < CONTEXT_LEN; j++) {
        inputIds[i * CONTEXT_LEN + j] = ids[j];
        attnMask[i * CONTEXT_LEN + j] = ids[j] !== 0n ? 1n : 0n;
      }
    }

    const result = await textSession.run({
      input_ids: new ort.Tensor("int64", inputIds, [n, CONTEXT_LEN]),
      attention_mask: new ort.Tensor("int64", attnMask, [n, CONTEXT_LEN]),
    });

    const allEmbeds = result[textSession.outputNames[0]].data;
    const embedSize = allEmbeds.length / n;
    for (let i = 0; i < n; i++) {
      tagEmbeddingCache.set(
        chunk[i],
        Float32Array.from(allEmbeds.subarray(i * embedSize, (i + 1) * embedSize))
      );
    }
  }
}

async function preprocessImage(imagePath) {
  const { data } = await sharp(imagePath)
    .resize(CLIP_SIZE, CLIP_SIZE, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const nchw = new Float32Array(3 * CLIP_SIZE * CLIP_SIZE);
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < CLIP_SIZE * CLIP_SIZE; i++) {
      nchw[c * CLIP_SIZE * CLIP_SIZE + i] =
        (data[i * 3 + c] / 255 - CLIP_MEAN[c]) / CLIP_STD[c];
    }
  }
  return new ort.Tensor("float32", nchw, [1, 3, CLIP_SIZE, CLIP_SIZE]);
}

// --- String similarity fallback (when no CLIP model dir is configured) ---

function normalize(tag) {
  return tag.toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
}

function stringSuggest(candidateTags, wd14Tags) {
  if (!wd14Tags.length) return [];
  const results = [];
  for (const eagleTag of candidateTags) {
    let best = 0;
    const b = normalize(eagleTag);
    for (const wd14 of wd14Tags) {
      const a = normalize(wd14);
      let s = 0;
      if (a === b) s = 1;
      else if (a.includes(b) || b.includes(a)) s = 0.9;
      else {
        const wa = new Set(a.split(" ").filter(Boolean));
        const wb = new Set(b.split(" ").filter(Boolean));
        let intersect = 0;
        for (const w of wa) if (wb.has(w)) intersect++;
        const union = wa.size + wb.size - intersect;
        s = union > 0 && intersect > 0 ? intersect / union : 0;
      }
      if (s > best) best = s;
      if (best === 1) break;
    }
    if (best >= clipConfig.threshold) results.push({ tag: eagleTag, score: best });
  }
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, clipConfig.topN)
    .map((r) => r.tag);
}

async function clipSuggestTags(imagePath, candidateTags, wd14Tags = []) {
  if (!clipConfig.enabled || !candidateTags?.length) return [];

  // Let model-loading errors propagate — caller surfaces them as a warning.
  const { vision, text } = await loadSessions();
  console.log("Running clip inference");

  try {
    const [pixelValues] = await Promise.all([
      preprocessImage(imagePath),
      warmTextEmbeddings(candidateTags, text),
    ]);
    const visionOut = await vision.run({ pixel_values: pixelValues });
    const imageEmbed = Float32Array.from(visionOut[vision.outputNames[0]].data);

    const scores = [];
    for (const tag of candidateTags) {
      const score = cosineSim(imageEmbed, tagEmbeddingCache.get(tag));
      if (score >= clipConfig.threshold) scores.push({ tag, score });
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, clipConfig.topN)
      .map((r) => r.tag);
  } catch (err) {
    console.error("CLIP inference error:", err.message, "— falling back to string similarity");
    return stringSuggest(candidateTags, wd14Tags);
  }
}

module.exports = { clipSuggestTags, configure };
