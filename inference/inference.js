const ort = require("onnxruntime-node");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

let config = {
  modelPath: path.join(__dirname, "model.onnx"),
  tagsPath: path.join(__dirname, "selected_tags.csv"),
  thresholdGeneral: 0.6,
  thresholdCharacter: 0.9,
  topN: 15,
};

function configure(newConfig) {
  const pathChanged =
    (newConfig.modelPath && newConfig.modelPath !== config.modelPath) ||
    (newConfig.tagsPath && newConfig.tagsPath !== config.tagsPath);

  config = {
    modelPath: newConfig.modelPath || config.modelPath,
    tagsPath: newConfig.tagsPath || config.tagsPath,
    thresholdGeneral: newConfig.thresholdGeneral ?? config.thresholdGeneral,
    thresholdCharacter: newConfig.thresholdCharacter ?? config.thresholdCharacter,
    topN: newConfig.topN ?? config.topN,
  };

  if (pathChanged) {
    session = null;
    MODEL_LABELS = [];
    console.log("Model config updated, session will reinitialize on next run.");
  }
}

let session = null;
let MODEL_LABELS = [];

/* Initializes the auto-tag model singleton */
async function initTagger() {
  if (!session) {
    session = await ort.InferenceSession.create(config.modelPath);
    console.log("Auto-tagger model loaded.");
  }
  return session;
}

/* Loads a file with predefined tags for inference */
function loadLabels() {
  if (MODEL_LABELS.length) return MODEL_LABELS;

  const text = fs.readFileSync(config.tagsPath, "utf8");
  const lines = text.trim().split("\n").slice(1);
  MODEL_LABELS = lines.map((line) => {
    const [id, name, cat] = line.split(",");
    return { name, category: parseInt(cat, 10) };
  });
  console.log(`Loaded ${MODEL_LABELS.length} labels`);
  return MODEL_LABELS;
}

// prepare image exactly like HuggingFace demo (BGR, no normalization)
/* Preprocesses an image to expect input tensors for the inference model */
async function preprocessImage(imagePath) {
  const size = 448;
  const img = await sharp(imagePath)
    .resize(size, size, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = img;
  const bgr = new Float32Array(size * size * 3);

  // RGB → BGR swap
  for (let i = 0; i < size * size; i++) {
    bgr[i * 3] = data[i * 3 + 2]; // B
    bgr[i * 3 + 1] = data[i * 3 + 1]; // G
    bgr[i * 3 + 2] = data[i * 3]; // R
  }

  // model expects NHWC [1,448,448,3]
  return new ort.Tensor("float32", bgr, [1, size, size, 3]);
}

/* Run the inference */
async function runTagger(imagePath) {
  const { thresholdGeneral, thresholdCharacter, topN } = config;
  if (session === null) session = await initTagger();
  const labels = loadLabels();
  const inputTensor = await preprocessImage(imagePath);

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const results = await session.run({ [inputName]: inputTensor });
  const probs = Array.from(results[outputName].data);

  // combine labels + probabilities
  const tagged = labels.map((l, i) => ({ ...l, score: probs[i] }));

  // separate categories
  const ratingTags = tagged.filter((x) => x.category === 9);
  const generalTags = tagged
    .filter((x) => x.category === 0 && x.score >= thresholdGeneral)
    .sort((a, b) => b.score - a.score);
  const characterTags = tagged
    .filter((x) => x.category === 4 && x.score >= thresholdCharacter)
    .sort((a, b) => b.score - a.score);

  const topGeneral = generalTags.slice(0, topN);
  const allTags = [
    ...ratingTags.sort((a, b) => b.score - a.score).slice(0, 1),
    ...topGeneral,
    ...characterTags,
  ];

  const tagNames = allTags.map((x) => x.name.replace(/_/g, " "));
  console.log(`Found ${tagNames.length} tags`);
  console.log("Auto-tags:", tagNames);
  return tagNames;
}

let currentTaskId = 0;

async function runTaggerLatest(imagePath) {
  const id = ++currentTaskId;
  const myId = id;

  try {
    const tags = await runTagger(imagePath);

    // if this task is outdated, ignore
    if (myId !== currentTaskId) {
      console.log(`Skipping outdated result for ${imagePath}`);
      return null;
    }

    return tags;
  } catch (err) {
    if (myId !== currentTaskId) return null; // stale — discard silently
    console.error("runTagger failed:", err);
    throw err;
  }
}

module.exports = { runTaggerLatest, configure };
