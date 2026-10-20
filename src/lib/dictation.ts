// Pure helpers for voice dictation in the note editor. No imports, so tests
// can load this file directly in Node.

export type Sel = { start: number; end: number };

/** Longest recording; at m4a voice bitrates this stays far under the
 *  server's 25 MB upload limit. */
export const MAX_RECORDING_MS = 10 * 60 * 1000;

// A space is added after the transcript only when the next character would
// otherwise run into its last word.
const NO_SPACE_BEFORE = /[\s.,;:!?)\]}"'’”]/;

/**
 * Inserts a transcript at the caret (or over the selection), adding a single
 * space on either side only where words would otherwise touch. Returns the
 * new text and a collapsed caret after the inserted words.
 */
export function insertTranscript(content: string, sel: Sel, transcript: string): { text: string; sel: Sel } {
  const words = transcript.replace(/[ \t]+/g, ' ').trim();
  const len = content.length;
  const clamp = (n: number) => Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), len);
  const start = clamp(Math.min(sel.start, sel.end));
  const end = clamp(Math.max(sel.start, sel.end));

  if (!words) return { text: content, sel: { start: start, end: start } };

  const before = content.slice(0, start);
  const after = content.slice(end);
  const lead = before.length > 0 && !/\s$/.test(before) ? ' ' : '';
  const trail = after.length > 0 && !NO_SPACE_BEFORE.test(after[0]) ? ' ' : '';

  const inserted = lead + words + trail;
  const caret = before.length + lead.length + words.length;
  return { text: before + inserted + after, sel: { start: caret, end: caret } };
}

/** "m:ss" for the recording timer. */
export function formatElapsed(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Speech sits roughly between -60 dBFS (quiet room) and 0 dBFS (clipping).
const METER_FLOOR_DB = -60;

/** Maps a metering reading in dBFS to a 0..1 level for the live meter. */
export function meterLevel(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return 0;
  if (db >= 0) return 1;
  if (db <= METER_FLOOR_DB) return 0;
  return (db - METER_FLOOR_DB) / -METER_FLOOR_DB;
}

const MIME_BY_EXT: Record<string, string> = {
  m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm',
  ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav',
};

const EXT_BY_MIME: Record<string, string> = {
  'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
};

/**
 * Describes a finished recording for a multipart upload. Native recorders
 * write files whose extension names the container; the browser recorder
 * hands back a blob URL plus a mime type such as "audio/webm;codecs=opus".
 */
export function uploadFile(
  uri: string,
  platform: string,
  mimeType?: string,
): { uri: string; name: string; type: string } {
  if (platform === 'web') {
    const base = (mimeType ?? '').split(';')[0].trim().toLowerCase();
    const type = EXT_BY_MIME[base] ? base : 'audio/webm';
    return { uri, name: `recording.${EXT_BY_MIME[type]}`, type };
  }
  const match = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(uri);
  const ext = match && MIME_BY_EXT[match[1].toLowerCase()] ? match[1].toLowerCase() : 'm4a';
  return { uri, name: `recording.${ext}`, type: MIME_BY_EXT[ext] };
}

/**
 * Where a transcript goes: the caret if the user has placed one in the body,
 * otherwise the end of the note (tapping the mic on a note you just opened
 * should add to it, not prepend).
 */
export function dictationTarget(sel: Sel, selKnown: boolean, length: number): Sel {
  return selKnown ? sel : { start: length, end: length };
}
