// Local tag matching using normalized string similarity.
// No external dependencies — works in any Electron environment.
// Handles: case, spaces↔underscores, exact and substring matches.

let tagIndex = []; // normalized tag names for matching
let rawTags = [];  // original casing preserved for output
let indexedKey = null;

function normalize(tag) {
  return tag.toLowerCase().replace(/_/g, " ").trim();
}

// Build lookup index from library tags. Instant — no model needed.
function indexLibraryTags(tags) {
  const key = tags.join("\0");
  if (indexedKey === key) return;
  rawTags = tags;
  tagIndex = tags.map(normalize);
  indexedKey = key;
}

// Score a single library tag against all generated tags.
// Returns a score in [0, 1]: exact match = 1, substring = 0.6, token overlap = proportional.
function scoreTag(libNorm, genNorms) {
  let best = 0;
  for (const gen of genNorms) {
    if (libNorm === gen) { best = 1; break; }
    if (libNorm.includes(gen) || gen.includes(libNorm)) {
      best = Math.max(best, 0.6);
      continue;
    }
    // Token overlap: "blue hair" vs "light blue hair" → 2/3
    const libTokens = libNorm.split(" ");
    const genTokens = gen.split(" ");
    const genSet = new Set(genTokens);
    const overlap = libTokens.filter((t) => genSet.has(t)).length;
    if (overlap > 0) {
      best = Math.max(best, overlap / Math.max(libTokens.length, genTokens.length));
    }
  }
  return best;
}

// Returns up to maxCount candidate library tags for the LLM to pick from.
// If the library is small enough, returns all tags. Otherwise pre-filters
// using local scoring so the LLM gets a focused, relevant set.
function getLibraryCandidates(generatedTags, maxCount = 150) {
  if (!rawTags.length) return [];
  if (rawTags.length <= maxCount) return rawTags;
  const genNorms = generatedTags.map(normalize);
  return rawTags
    .map((tag, i) => ({ tag, score: scoreTag(tagIndex[i], genNorms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map(({ tag }) => tag);
}

module.exports = { indexLibraryTags, getLibraryCandidates };
