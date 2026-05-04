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

export function useMicRecorder({ onRecorded }: UseMicRecorderOptions): UseMicRecorderReturn {
  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const [recordingPadId, setRecordingPadId] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<MicRecorderError | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const padIdRef = useRef<string | null>(null);
  const onRecordedRef = useRef(onRecorded);

  // Keep callback ref fresh without re-subscribing handlers.
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const cleanup = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    padIdRef.current = null;
    setRecordingPadId(null);
    setElapsedMs(0);
  }, []);

  const startRecording = useCallback(
    async (padId: string) => {
      if (!supported) {
        setError('unsupported');
        return;
      }
      if (recorderRef.current) {
        // Already recording — ignore.
        return;
      }

      setError(null);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        const name = (err as DOMException)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError('permission-denied');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setError('no-device');
        } else {
          setError('recorder-failed');
        }
        return;
      }

      const mime = pickMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        setError('recorder-failed');
        return;
      }

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      padIdRef.current = padId;
      startedAtRef.current = performance.now();

      recorder.addEventListener('dataavailable', (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      });

      recorder.addEventListener('stop', () => {
        const pad = padIdRef.current;
        const chunks = chunksRef.current;
        const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
        cleanup();
        if (pad && blob.size > 0) {
          const ext = extensionFor(blob.type);
          const file = new File([blob], `mic-${Date.now()}.${ext}`, { type: blob.type });
          onRecordedRef.current(pad, file);
        }
      });

      recorder.addEventListener('error', () => {
        setError('recorder-failed');
        cleanup();
      });

      try {
        recorder.start();
      } catch {
        cleanup();
        setError('recorder-failed');
        return;
      }

      setRecordingPadId(padId);
      setElapsedMs(0);

      tickRef.current = window.setInterval(() => {
        setElapsedMs(performance.now() - startedAtRef.current);
      }, 100);

      autoStopRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === 'recording') {
          recorderRef.current.stop();
        }
      }, MAX_DURATION_MS);
    },
    [supported, cleanup],
  );

  const stopRecording = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state === 'recording') {
      r.stop(); // 'stop' event handler calls cleanup + onRecorded
    } else {
      cleanup();
    }
  }, [cleanup]);

  const clearError = useCallback(() => setError(null), []);

  // Stop any active recording on unmount.
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') {
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      cleanup();
    };
  }, [cleanup]);

  return {
    supported,
    recordingPadId,
    elapsedMs,
    error,
    startRecording,
    stopRecording,
    clearError,
  };
}
