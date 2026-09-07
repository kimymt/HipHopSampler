import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DURATION_MS = 10_000;

// Pick the first MIME the platform supports. iOS Safari prefers audio/mp4.
function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
      return m;
    }
  }
  return '';
}

function extensionFor(mime: string): string {
  if (mime.startsWith('audio/mp4')) return 'm4a';
  if (mime.startsWith('audio/webm')) return 'webm';
  return 'bin';
}

export type MicRecorderError =
  | 'unsupported'
  | 'permission-denied'
  | 'no-device'
  | 'recorder-failed';

export interface UseMicRecorderOptions {
  onRecorded: (padId: string, file: File) => void;
}

export interface UseMicRecorderReturn {
  supported: boolean;
  recordingPadId: string | null;
  elapsedMs: number;
  error: MicRecorderError | null;
  startRecording: (padId: string) => Promise<void>;
  stopRecording: () => void;
  clearError: () => void;
}

interface RecordingSession {
  padId: string;
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  tick: number | null;
  autoStop: number | null;
}

function releaseCapture(session: RecordingSession) {
  if (session.tick !== null) window.clearInterval(session.tick);
  if (session.autoStop !== null) window.clearTimeout(session.autoStop);
  session.tick = session.autoStop = null;
  session.stream?.getTracks().forEach((track) => track.stop());
  session.stream = null;
}

export function useMicRecorder({ onRecorded }: UseMicRecorderOptions): UseMicRecorderReturn {
  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';
  const [recordingPadId, setRecordingPadId] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<MicRecorderError | null>(null);
  const sessionRef = useRef<RecordingSession | null>(null);
  const mountedRef = useRef(true);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => { onRecordedRef.current = onRecorded; }, [onRecorded]);

  const cleanup = useCallback((session: RecordingSession) => {
    releaseCapture(session);
    if (sessionRef.current !== session) return;
    sessionRef.current = null;
    if (mountedRef.current) {
      setRecordingPadId(null);
      setElapsedMs(0);
    }
  }, []);

  const stopRecording = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    if (!session.recorder) {
      // Invalidate a pending permission request; its eventual stream is discarded.
      cleanup(session);
      return;
    }
    try {
      if (session.recorder.state === 'recording') session.recorder.stop();
    } catch {
      cleanup(session);
      setError('recorder-failed');
    } finally {
      // Do not wait for the asynchronous stop event to release the microphone.
      // Retain session ownership until that event delivers the final audio chunk.
      releaseCapture(session);
    }
  }, [cleanup]);

  const startRecording = useCallback(async (padId: string) => {
    if (!mountedRef.current) return;
    if (!supported) { setError('unsupported'); return; }
    if (sessionRef.current) return;
    const session: RecordingSession = {
      padId, stream: null, recorder: null, chunks: [], tick: null, autoStop: null,
    };
    // Reserve synchronously, before permission can yield to another start call.
    sessionRef.current = session;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      if (sessionRef.current !== session) return;
      cleanup(session);
      const name = (err as DOMException)?.name;
      setError(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'permission-denied'
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'no-device' : 'recorder-failed');
      return;
    }
    if (sessionRef.current !== session || !mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    session.stream = stream;
    try {
      const mime = pickMimeType();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      session.recorder = recorder;
      recorder.addEventListener('dataavailable', (event) => {
        if (sessionRef.current === session && event.data.size > 0) session.chunks.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        if (sessionRef.current !== session) return;
        const blob = new Blob(session.chunks, { type: recorder.mimeType || mime || 'audio/webm' });
        cleanup(session);
        if (blob.size > 0) {
          onRecordedRef.current(session.padId, new File([blob], `mic-${Date.now()}.${extensionFor(blob.type)}`, { type: blob.type }));
        }
      });
      recorder.addEventListener('error', () => {
        if (sessionRef.current !== session) return;
        cleanup(session);
        setError('recorder-failed');
      });
      recorder.start();
      setRecordingPadId(padId);
      setElapsedMs(0);
      const startedAt = performance.now();
      session.tick = window.setInterval(() => {
        if (sessionRef.current === session) setElapsedMs(performance.now() - startedAt);
      }, 100);
      session.autoStop = window.setTimeout(() => {
        if (sessionRef.current === session) stopRecording();
      }, MAX_DURATION_MS);
    } catch {
      cleanup(session);
      setError('recorder-failed');
    }
  }, [supported, cleanup, stopRecording]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const session = sessionRef.current;
      if (!session) return;
      // Invalidate ownership before stopping, so queued events cannot deliver files.
      sessionRef.current = null;
      try {
        if (session.recorder?.state === 'recording') session.recorder.stop();
      } catch {
        // Track release must still run if the recorder has already failed.
      } finally {
        releaseCapture(session);
      }
    };
  }, []);
  const clearError = useCallback(() => setError(null), []);
  return { supported, recordingPadId, elapsedMs, error, startRecording, stopRecording, clearError };
}
