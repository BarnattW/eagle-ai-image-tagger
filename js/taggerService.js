export async function llmGenerateTags(imagePath, userTags, thumbnailPath) {
  const bridge = window.__autoTaggerInference;
  if (!bridge?.llmGenerateTags) throw new Error("Inference bridge not ready");
  return await bridge.llmGenerateTags(imagePath, userTags, thumbnailPath);
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
