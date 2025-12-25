export async function runTaggerLatest(filePath) {
  const bridge = window.__autoTaggerInference;
  try {
    return await bridge.runTaggerLatest(filePath);
  } catch {
    throw new Error("Inference bridge not ready");
  }
}

function normalizeTag(tag) {
  return (tag ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function dedupeTags(candidateTags, existingTags) {
console.log(existingTags)
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
