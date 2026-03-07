const fs = require("fs");

const CONTEXT_LEN = 77;

class BPETokenizer {
  constructor(data) {
    const { vocab, merges } = data.model;
    this.vocab = vocab;
    this.mergeRanks = new Map(merges.map((m, i) => [m, i]));
    this.sot = vocab["<|startoftext|>"] ?? 49406;
    this.eot = vocab["<|endoftext|>"] ?? 49407;
  }

  _bpe(chars) {
    let symbols = [...chars];
    while (symbols.length > 1) {
      let bestRank = Infinity, bestIdx = -1;
      for (let i = 0; i < symbols.length - 1; i++) {
        const rank = this.mergeRanks.get(symbols[i] + " " + symbols[i + 1]);
        if (rank !== undefined && rank < bestRank) {
          bestRank = rank;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;
      symbols.splice(bestIdx, 2, symbols[bestIdx] + symbols[bestIdx + 1]);
    }
    return symbols;
  }

  tokenize(text) {
    const ids = [this.sot];
    for (const word of text.toLowerCase().trim().split(/\s+/)) {
      if (!word) continue;
      const chars = [...word];
      const init = chars.map((c, i) => i === chars.length - 1 ? c + "</w>" : c);
      for (const t of this._bpe(init)) {
        const id = this.vocab[t];
        if (id !== undefined) ids.push(id);
      }
    }
    ids.push(this.eot);

    const out = new BigInt64Array(CONTEXT_LEN).fill(0n);
    const len = Math.min(ids.length, CONTEXT_LEN);
    for (let i = 0; i < len; i++) out[i] = BigInt(ids[i]);
    return out;
  }
}

function loadTokenizer(tokenizerPath) {
  return new BPETokenizer(JSON.parse(fs.readFileSync(tokenizerPath, "utf8")));
}

module.exports = { loadTokenizer };
