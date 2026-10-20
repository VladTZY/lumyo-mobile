// Finds the passage a chat answer cited inside a note's current content.
// Pure module: no imports. Offsets are UTF-16 indices into `content`.

export type ChunkMatch = { start: number; end: number; exact: boolean };

const ANCHOR = 40;
// Rails `String#truncate(200)` produced legacy chunk_text values.
const LEGACY_LIMIT = 200;

type Normalized = { text: string; map: number[]; endMap: number[] };

// Legacy chunk_text carried the indexing prefix and was truncated to 200
// codepoints with a trailing "...". Current chunk_text is the full body.
function cleanChunkText(raw: string): string {
  let text = raw;
  if (Array.from(text).length === LEGACY_LIMIT && text.endsWith('...')) {
    text = text.slice(0, -3);
  }
  return text.replace(/^title: [\s\S]*?\ntags: [^\n]*\n\n/, '');
}

// Lowercases, drops markdown markers (runs of `*`, `<u>`, `</u>`) and
// collapses whitespace, keeping a map back to offsets in the original.
function normalize(s: string): Normalized {
  const text: string[] = [];
  const map: number[] = [];
  const endMap: number[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '*') {
      while (i < s.length && s[i] === '*') i++;
      continue;
    }
    if (s.startsWith('<u>', i)) {
      i += 3;
      continue;
    }
    if (s.startsWith('</u>', i)) {
      i += 4;
      continue;
    }
    const cp = s.codePointAt(i) as number;
    const ch = String.fromCodePoint(cp);
    const charStart = i;
    i += ch.length;
    if (/\s/.test(ch)) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (text.length > 0 && text[text.length - 1] !== ' ') {
        text.push(' ');
        map.push(charStart);
        endMap.push(i);
      }
      continue;
    }
    for (const unit of ch.toLowerCase()) {
      for (let k = 0; k < unit.length; k++) {
        text.push(unit[k]);
        map.push(charStart);
        endMap.push(i);
      }
    }
  }
  if (text[text.length - 1] === ' ') {
    text.pop();
    map.pop();
    endMap.pop();
  }
  return { text: text.join(''), map, endMap };
}

export function locateChunk(content: string, chunkText: string): ChunkMatch | null {
  if (typeof content !== 'string' || typeof chunkText !== 'string') return null;
  const needle = normalize(cleanChunkText(chunkText)).text;
  const hay = normalize(content);
  if (!needle || !hay.text) return null;

  const toRange = (ns: number, ne: number, exact: boolean): ChunkMatch | null => {
    let a = ns;
    let b = ne;
    while (a < b && hay.text[a] === ' ') a++;
    while (b > a && hay.text[b - 1] === ' ') b--;
    if (a >= b) return null;
    return { start: hay.map[a], end: hay.endMap[b - 1], exact };
  };

  const i = hay.text.indexOf(needle);
  if (i >= 0) return toRange(i, i + needle.length, true);

  if (needle.length >= 2 * ANCHOR) {
    const head = needle.slice(0, ANCHOR);
    const tail = needle.slice(-ANCHOR);
    const h = hay.text.indexOf(head);
    const t = h >= 0 ? hay.text.indexOf(tail, h) : hay.text.indexOf(tail);
    if (h >= 0 && t >= 0 && t + ANCHOR - h <= 2 * needle.length) {
      return toRange(h, t + ANCHOR, false);
    }
    if (h >= 0) return toRange(h, h + ANCHOR, false);
    if (t >= 0) return toRange(t, t + ANCHOR, false);
  }
  return null;
}
