// Thin wrappers that call through the inference bridge (window.__autoTaggerInference)
// exposed by inferenceBridge.js. All callers live on the React/browser side.

export async function llmGenerateTags(imagePath, thumbnailPath, signal) {
  const bridge = window.__autoTaggerInference;
  if (!bridge?.llmGenerateTags) throw new Error("Inference bridge not ready");
  return await bridge.llmGenerateTags(imagePath, thumbnailPath, signal);
}

// Build the local string-matching index so the library-tag pass can pre-filter candidates.
export async function indexLibraryTags(tags) {
  const bridge = window.__autoTaggerInference;
  if (!bridge?.indexLibraryTags) return;
  return await bridge.indexLibraryTags(tags);
}

function normalizeTag(tag) {
  return (tag ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Remove duplicates and tags already present on the item (case-insensitive).
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
