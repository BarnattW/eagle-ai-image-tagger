export async function runTaggerLatest(filePath) {
  const bridge = window.__autoTaggerInference;
  if (!bridge?.runTaggerLatest) throw new Error("Inference bridge not ready");
  return await bridge.runTaggerLatest(filePath);
}

export async function clipSuggestTags(imagePath, candidateTags, wd14Tags) {
  const bridge = window.__autoTaggerInference;
  if (!bridge?.clipSuggestTags) throw new Error("Inference bridge not ready");
  return await bridge.clipSuggestTags(imagePath, candidateTags, wd14Tags);
}

export async function llmGenerateTags(imagePath, userTags) {
  const bridge = window.__autoTaggerInference;
  if (!bridge?.llmGenerateTags) throw new Error("Inference bridge not ready");
  return await bridge.llmGenerateTags(imagePath, userTags);
}

function normalizeTag(tag) {
  return (tag ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function dedupeTags(candidateTags, existingTags) {
  const existing = new Set(existingTags.map(normalizeTag));
  const seen = new Set();
  const out = [];

  for (const t of candidateTags) {
    const normalizedTag = normalizeTag(t);
    if (!normalizedTag) continue;
    if (existing.has(normalizedTag)) continue;
    if (seen.has(normalizedTag)) continue;
    seen.add(normalizedTag);
    out.push(t);
  }

  return out;
}
