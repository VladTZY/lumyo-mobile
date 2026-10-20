import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync,
  useAudioRecorder, useAudioRecorderState, type RecordingOptions,
} from 'expo-audio';
import { MAX_RECORDING_MS, meterLevel } from '../lib/dictation';
import { transcribeRecording } from '../services/transcription';

export type DictationPhase = 'idle' | 'recording' | 'transcribing' | 'error';

// Speech needs neither stereo nor music bitrates: mono 48 kbps AAC keeps a
// minute of audio around 360 KB, so uploads and transcription stay quick.
const VOICE_PRESET: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  sampleRate: 22050,
  bitRate: 48000,
  isMeteringEnabled: true,
};

export interface Dictation {
  phase: DictationPhase;
  elapsedMs: number;
  /** 0..1 input level; stays 0 where metering is unavailable (web). */
  level: number;
  error: string | null;
  /** The recording can be sent again after a failed transcription. */
  canRetry: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
}

/**
 * Records a voice note and turns it into text on the server. `onTranscript`
 * receives the text once; the recording is kept until then so a failed
 * upload can be retried without speaking again.
 */
export function useDictation(onTranscript: (text: string) => void): Dictation {
  const recorder = useAudioRecorder(VOICE_PRESET);
  const status = useAudioRecorderState(recorder, 100);
  const [phase, setPhase] = useState<DictationPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const lastUri = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const phaseRef = useRef<DictationPhase>('idle');
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const go = useCallback((next: DictationPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const releaseAudio = useCallback(() => {
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  }, []);

  const transcribe = useCallback(async (uri: string) => {
    go('transcribing');
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { text } = await transcribeRecording(uri, { signal: controller.signal });
      if (controller.signal.aborted) return;
      lastUri.current = null;
      go('idle');
      onTranscriptRef.current(text);
      AccessibilityInfo.announceForAccessibility('Transcript added to the note');
    } catch (e: any) {
      if (controller.signal.aborted) return;
      setError(e?.message || "Couldn't transcribe the recording.");
      go('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [go]);

  const start = useCallback(async () => {
    if (phaseRef.current === 'recording' || phaseRef.current === 'transcribing') return;
    setError(null);
    lastUri.current = null;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Lumyo needs microphone access to dictate. Turn it on in Settings.');
        go('error');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      go('recording');
      AccessibilityInfo.announceForAccessibility('Recording');
    } catch (e: any) {
      releaseAudio();
      setError(e?.message ? `Couldn't start recording: ${e.message}` : "Couldn't start recording.");
      go('error');
    }
  }, [recorder, go, releaseAudio]);

  const stop = useCallback(async () => {
    if (phaseRef.current !== 'recording') return;
    try {
      await recorder.stop();
    } finally {
      releaseAudio();
    }
    const uri = recorder.uri;
    if (!uri) {
      setError("The recording couldn't be saved. Try again.");
      go('error');
      return;
    }
    lastUri.current = uri;
    await transcribe(uri);
  }, [recorder, transcribe, go, releaseAudio]);

  const cancel = useCallback(async () => {
    const current = phaseRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    lastUri.current = null;
    setError(null);
    go('idle');
    if (current === 'recording') {
      try { await recorder.stop(); } catch { /* already stopped */ }
      releaseAudio();
    }
  }, [recorder, go, releaseAudio]);

  const retry = useCallback(async () => {
    if (lastUri.current) await transcribe(lastUri.current);
    else await start();
  }, [transcribe, start]);

  // Stop on its own at the length limit, so uploads stay under the server cap.
  useEffect(() => {
    if (phase === 'recording' && status.durationMillis >= MAX_RECORDING_MS) stop();
  }, [phase, status.durationMillis, stop]);

  // Leaving the editor mid-recording discards it rather than leaving the
  // microphone on.
  useEffect(() => () => {
    abortRef.current?.abort();
    if (phaseRef.current === 'recording') {
      recorder.stop().catch(() => {});
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  }, [recorder]);

  return {
    phase,
    elapsedMs: phase === 'recording' ? status.durationMillis : 0,
    level: phase === 'recording' ? meterLevel(status.metering) : 0,
    error,
    canRetry: lastUri.current !== null,
    start,
    stop,
    cancel,
    retry,
  };
}
