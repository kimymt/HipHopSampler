import 'fake-indexeddb/auto';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { usePersistedSamples } from './usePersistedSamples';
import * as store from '../utils/sampleStore';

vi.mock('../utils/audioSafety', () => ({
  retainAudio: vi.fn(), releaseAudio: vi.fn(), validateAudioFileSize: vi.fn(),
  withDecodedAudio: async (file: File, ctx: AudioContext, consume: Function, current = () => true) => {
    if (!current()) return;
    const bytes = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(bytes);
    if (current()) return consume(buffer, bytes);
  },
}));

const buffer = { duration: 1, length: 8000, numberOfChannels: 1, sampleRate: 8000 } as AudioBuffer;
function context(decode: (bytes: ArrayBuffer) => Promise<AudioBuffer> = async () => buffer) {
  return { sampleRate: 8000, decodeAudioData: vi.fn((_bytes: ArrayBuffer, ok?: Function, bad?: Function) => {
    const pending = decode(_bytes);
    if (ok || bad) return pending.then((b) => { ok?.(b); return b; }, (error) => { bad?.(error); });
    return pending;
  }) } as unknown as AudioContext;
}
async function start(ctx = context()) {
  const init = () => ctx;
  const hook = renderHook(() => usePersistedSamples(init));
  await waitFor(() => expect(hook.result.current.restoreState.status).toBe('ready'));
  return hook;
}
const file = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: 'audio/wav' });
async function load(hook: Awaited<ReturnType<typeof start>>, name: string) {
  await act(async () => { await hook.result.current.loadSample('0-0', file(name)); });
  await waitFor(() => expect(hook.result.current.samples['0-0']?.name).toBe(name));
  await waitFor(async () => expect((await store.loadAllPads())[0]?.name).toBe(name));
}
async function audioCount() {
  const db = await new Promise<IDBDatabase>((resolve) => { const r = indexedDB.open('hip-hop-sampler'); r.onsuccess = () => resolve(r.result); });
  const count = await new Promise<number>((resolve) => { const r = db.transaction('audio').objectStore('audio').count(); r.onsuccess = () => resolve(r.result); });
  db.close(); return count;
}
beforeEach(async () => { await store.clearAll(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('sample import and deletion lifecycle', () => {
  it('does not leave audio after replace then delete', async () => {
    const hook = await start();
    await load(hook, 'A.wav'); await load(hook, 'B.wav');
    await act(async () => { await hook.result.current.removeSample('0-0'); });
    await waitFor(async () => expect(await store.loadAllPads()).toEqual([]));
    await waitFor(async () => expect(await audioCount()).toBe(0));
  });
  it('never persists bytes when decoding fails', async () => {
    const hook = await start(context(async () => { throw new Error('bad codec'); }));
    await act(async () => { await hook.result.current.loadSample('0-0', file('broken.wav')); });
    await waitFor(() => expect(hook.result.current.loading['0-0']).toBe(false));
    expect(await audioCount()).toBe(0);
  });
  it('does not resurrect a pad deleted while decode was pending', async () => {
    let resolve!: (buffer: AudioBuffer) => void;
    const ctx = context(() => new Promise((r) => { resolve = r; }));
    const hook = await start(ctx);
    act(() => { void hook.result.current.loadSample('0-0', file('slow.wav')); });
    await waitFor(() => expect(ctx.decodeAudioData).toHaveBeenCalled());
    let removal: unknown;
    act(() => { removal = hook.result.current.removeSample('0-0'); });
    await act(async () => { resolve(buffer); await removal; });
    expect(hook.result.current.samples['0-0']).toBeUndefined();
    expect(await store.loadAllPads()).toEqual([]); expect(await audioCount()).toBe(0);
  });
  it('keeps the sample visible and retryable if persistence deletion fails', async () => {
    const hook = await start(); await load(hook, 'A.wav');
    vi.spyOn(store, 'removePad').mockRejectedValueOnce(new Error('storage unavailable'));
    await act(async () => { await hook.result.current.removeSample('0-0'); });
    expect(hook.result.current.samples['0-0']?.name).toBe('A.wav');
    expect(hook.result.current.error).toContain('音声は残っています');
    await act(async () => { await hook.result.current.removeSample('0-0'); });
    expect(hook.result.current.samples['0-0']).toBeUndefined(); expect(await audioCount()).toBe(0);
  });
  it('clears pending import state when a chop replaces its target', async () => {
    let release!: (buffer: AudioBuffer) => void;
    const ctx = context();
    const hook = await start(ctx);
    await load(hook, 'source.wav');
    const source = hook.result.current.samples['0-0']!;
    vi.mocked(ctx.decodeAudioData).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    let importing!: Promise<boolean>;
    act(() => { importing = hook.result.current.loadSample('0-1', file('slow.wav')); });
    await waitFor(() => expect(release).toBeDefined());
    expect(hook.result.current.loading['0-1']).toBe(true);
    let chopping!: Promise<boolean>;
    act(() => { chopping = hook.result.current.updateMany({ '0-1': { ...source, name: 'slice' } }); });
    await act(async () => { release(buffer); await importing; await chopping; });
    expect(hook.result.current.loading['0-1']).toBe(false);
    expect(hook.result.current.samples['0-1']?.name).toBe('slice');
    expect((await store.loadAllPads()).find((pad) => pad.padId === '0-1')?.sourceId).toBe(source.sourceId);
    expect(await audioCount()).toBe(1);
  });
  it('keeps the last committed sample if a later import fails during an earlier commit', async () => {
    const ctx = context(async (bytes) => {
      if (new Uint8Array(bytes)[0] === 9) throw new Error('bad codec');
      return buffer;
    });
    const hook = await start(ctx); await load(hook, 'old.wav');
    const save = store.saveSample;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let committed = false;
    vi.spyOn(store, 'saveSample').mockImplementationOnce(async (...args) => {
      await save(...args); committed = true; await gate;
    });
    let first: Promise<boolean>;
    act(() => { first = hook.result.current.loadSample('0-0', file('A.wav')); });
    await waitFor(() => expect(committed).toBe(true));
    let second: Promise<boolean>;
    act(() => { second = hook.result.current.loadSample('0-0', new File([new Uint8Array([9])], 'B.wav')); });
    await act(async () => { release(); await first; await second; });
    expect(hook.result.current.samples['0-0']?.name).toBe('A.wav');
    expect((await store.loadAllPads())[0].name).toBe('A.wav');
  });
  it('restores valid pads and offers removal for a rejected legacy source', async () => {
    const metadata = (sourceId: string) => ({ sourceId, name: sourceId, startTime: 0, endTime: 1, loop: false, loopStart: 0, loopEnd: 1, volume: 1, pan: 0 });
    await store.saveSample('0-0', metadata('good'), new Uint8Array([1]).buffer, 'audio/wav');
    await store.saveSample('0-1', metadata('legacy'), new Uint8Array([9]).buffer, 'audio/wav');
    const hook = await start(context(async (bytes) => {
      if (new Uint8Array(bytes)[0] === 9) throw new Error('over limit');
      return buffer;
    }));
    expect(hook.result.current.samples['0-0']?.name).toBe('good');
    expect(hook.result.current.restoreFailures).toEqual(['0-1']);
    expect(await store.loadAudio('legacy')).toBeDefined();
    await act(async () => { await hook.result.current.removeFailedSamples(); });
    expect(await store.loadAudio('legacy')).toBeUndefined();
    expect(await store.loadAudio('good')).toBeDefined();
  });

});
