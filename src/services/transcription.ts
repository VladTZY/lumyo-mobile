import { Platform } from 'react-native';
import { BASE_URL, getToken } from './api';
import { uploadFile } from '../lib/dictation';

export interface Transcript {
  text: string;
  model: string;
}

// Uploads plus transcription of a long note can outlast the 15s JSON timeout.
const TIMEOUT_MS = 90_000;

/**
 * Sends a finished recording to POST /transcriptions and returns the text.
 * The model is chosen on the server (TRANSCRIPTION_MODELS), so the app never
 * needs a release to switch it. Pass `signal` to cancel.
 */
export async function transcribeRecording(
  uri: string,
  { mimeType, language, signal }: { mimeType?: string; language?: string; signal?: AbortSignal } = {},
): Promise<Transcript> {
  if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_URL is not set');

  const form = new FormData();
  if (Platform.OS === 'web') {
    // The browser recorder returns a blob: URL; FormData needs the Blob. Its
    // own type is the truth (Safari records mp4 where Chrome records webm).
    const blob = await (await fetch(uri)).blob();
    const file = uploadFile(uri, 'web', blob.type || mimeType);
    form.append('audio', new Blob([blob], { type: file.type }), file.name);
  } else {
    const file = uploadFile(uri, Platform.OS, mimeType);
    // React Native's FormData reads the file from disk given uri/name/type.
    form.append('audio', file as unknown as Blob);
  }
  if (language) form.append('language', language);

  const token = await getToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    // No Content-Type: fetch sets the multipart boundary itself.
    const response = await fetch(`${BASE_URL}/transcriptions`, {
      method: 'POST', headers, body: form, signal: controller.signal,
    });
    const body = await response.text();
    let data: { text?: string; model?: string; error?: string } = {};
    try { data = body ? JSON.parse(body) : {}; } catch { /* non-JSON error page */ }
    if (!response.ok) {
      throw new Error(data.error || `Transcription failed (${response.status})`);
    }
    return { text: data.text ?? '', model: data.model ?? '' };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}
