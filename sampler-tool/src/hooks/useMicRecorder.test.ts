import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMicRecorder } from './useMicRecorder';

class FakeRecorder extends EventTarget {
  static instances: FakeRecorder[] = [];
  static isTypeSupported() { return true; }
  state = 'inactive';
  mimeType = 'audio/webm';
  constructor(public stream: MediaStream) { super(); FakeRecorder.instances.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; }
  emitStop() { this.dispatchEvent(new Event('stop')); }
  emitData() { this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['audio']) })); }
}
const makeStream = () => {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
};
const deferred = () => {
  let resolve!: (stream: MediaStream) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<MediaStream>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let getUserMedia: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  FakeRecorder.instances = [];
  getUserMedia = vi.fn();
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('microphone capture ownership', () => {
  it('reserves a pending request synchronously and releases capture immediately on stop', async () => {
    const permission = deferred();
    const capture = makeStream();
    getUserMedia.mockReturnValue(permission.promise);
    const { result, unmount } = renderHook(() => useMicRecorder({ onRecorded: vi.fn() }));
    let first!: Promise<void>;
    act(() => { first = result.current.startRecording('a'); void result.current.startRecording('b'); });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    await act(async () => { permission.resolve(capture.stream); await first; });
    act(() => result.current.stopRecording());
    expect(capture.stop).toHaveBeenCalled();
    act(() => FakeRecorder.instances[0].emitStop());
    expect(result.current.recordingPadId).toBeNull();
    unmount();
  });

  it.each(['stop', 'unmount'])('discards permission granted after %s', async (action) => {
    const permission = deferred();
    const capture = makeStream();
    getUserMedia.mockReturnValue(permission.promise);
    const onRecorded = vi.fn();
    const { result, unmount } = renderHook(() => useMicRecorder({ onRecorded }));
    let request!: Promise<void>;
    act(() => { request = result.current.startRecording('a'); });
    if (action === 'unmount') unmount();
    else act(() => result.current.stopRecording());
    await act(async () => { permission.resolve(capture.stream); await request; });
    expect(capture.stop).toHaveBeenCalled();
    expect(FakeRecorder.instances).toHaveLength(0);
    expect(onRecorded).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps a newer capture alive when an older permission grant arrives', async () => {
    const old = deferred();
    const a = makeStream(), b = makeStream();
    getUserMedia.mockReturnValueOnce(old.promise).mockResolvedValueOnce(b.stream);
    const onRecorded = vi.fn();
    const { result, unmount } = renderHook(() => useMicRecorder({ onRecorded }));
    let request!: Promise<void>;
    act(() => { request = result.current.startRecording('a'); });
    act(() => result.current.stopRecording());
    await act(async () => { await result.current.startRecording('b'); });
    await act(async () => { old.resolve(a.stream); await request; });
    expect(a.stop).toHaveBeenCalled();
    expect(b.stop).not.toHaveBeenCalled();
    expect(result.current.recordingPadId).toBe('b');
    expect(FakeRecorder.instances).toHaveLength(1);
    unmount();
    FakeRecorder.instances[0].emitData();
    FakeRecorder.instances[0].emitStop();
    expect(b.stop).toHaveBeenCalled();
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('ignores a cancelled permission failure while a newer recording is active', async () => {
    const old = deferred();
    const capture = makeStream();
    getUserMedia.mockReturnValueOnce(old.promise).mockResolvedValueOnce(capture.stream);
    const { result, unmount } = renderHook(() => useMicRecorder({ onRecorded: vi.fn() }));
    let request!: Promise<void>;
    act(() => { request = result.current.startRecording('a'); });
    act(() => result.current.stopRecording());
    await act(async () => { await result.current.startRecording('b'); });
    await act(async () => { old.reject(new DOMException('denied', 'NotAllowedError')); await request; });
    expect(result.current.error).toBeNull();
    expect(result.current.recordingPadId).toBe('b');
    unmount();
    expect(capture.stop).toHaveBeenCalled();
  });

  it('caps capture at ten seconds, delivers its file, and ignores old callbacks', async () => {
    const a = makeStream(), b = makeStream();
    getUserMedia.mockResolvedValueOnce(a.stream).mockResolvedValueOnce(b.stream);
    const onRecorded = vi.fn();
    const { result, unmount } = renderHook(() => useMicRecorder({ onRecorded }));
    await act(async () => { await result.current.startRecording('a'); });
    const old = FakeRecorder.instances[0];
    act(() => { old.emitData(); vi.advanceTimersByTime(10_000); });
    expect(a.stop).toHaveBeenCalled();
    act(() => old.emitStop());
    expect(onRecorded).toHaveBeenCalledWith('a', expect.any(File));
    await act(async () => { await result.current.startRecording('b'); });
    act(() => { old.emitData(); old.emitStop(); old.dispatchEvent(new Event('error')); });
    expect(result.current.recordingPadId).toBe('b');
    expect(result.current.error).toBeNull();
    expect(b.stop).not.toHaveBeenCalled();
    expect(onRecorded).toHaveBeenCalledTimes(1);
    unmount();
    expect(b.stop).toHaveBeenCalled();
  });
});
