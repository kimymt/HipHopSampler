import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveSample, savePads, removePad, loadAudio, loadAllPads, clearAll, collectOrphanAudio } from './sampleStore';
import type { PadMetadata } from '../types';

const metadata = (sourceId: string): Omit<PadMetadata, 'padId'> => ({
  sourceId, name: sourceId, startTime: 0, endTime: 1, loop: false,
  loopStart: 0, loopEnd: 1, volume: 1, pan: 0,
});
const bytes = new ArrayBuffer(8);
const open = () => new Promise<IDBDatabase>((resolve) => { const r = indexedDB.open('hip-hop-sampler'); r.onsuccess = () => resolve(r.result); });
beforeEach(async () => { await clearAll(); });

describe('atomic audio persistence', () => {
  it('reclaims replaced audio and leaves no bytes after final pad deletion', async () => {
    await saveSample('0-0', metadata('A'), bytes, 'audio/wav');
    await saveSample('0-0', metadata('B'), bytes, 'audio/wav');
    expect(await loadAudio('A')).toBeUndefined();
    await removePad('0-0');
    expect(await loadAllPads()).toEqual([]);
    expect(await loadAudio('B')).toBeUndefined();
  });
  it('retains a shared chop source until the last reference is removed', async () => {
    await saveSample('0-0', metadata('A'), bytes, 'audio/wav');
    await savePads([{ padId: '0-1', data: metadata('A') }]);
    await saveSample('0-0', metadata('B'), bytes, 'audio/wav');
    expect(await loadAudio('A')).toBeDefined();
    await removePad('0-1');
    expect(await loadAudio('A')).toBeUndefined(); expect(await loadAudio('B')).toBeDefined();
  });
  it('rolls both stores back if a delete transaction aborts', async () => {
    await saveSample('0-0', metadata('A'), bytes, 'audio/wav');
    const db = await open();
    const prototype = Object.getPrototypeOf(db);
    const transaction = prototype.transaction;
    const spy = vi.spyOn(prototype, 'transaction').mockImplementation(function(this: IDBDatabase, ...args: any[]) {
      const tx = transaction.apply(this, args);
      if (args[1] === 'readwrite') queueMicrotask(() => tx.abort());
      return tx;
    });
    await expect(removePad('0-0')).rejects.toThrow();
    spy.mockRestore(); db.close();
    expect((await loadAllPads())[0].sourceId).toBe('A'); expect(await loadAudio('A')).toBeDefined();
  });
  it('does not commit partially when a chop refers to missing audio', async () => {
    await saveSample('0-0', metadata('A'), bytes, 'audio/wav');
    await expect(savePads([{ padId: '0-0', data: metadata('missing') }])).rejects.toThrow();
    expect((await loadAllPads())[0].sourceId).toBe('A'); expect(await loadAudio('A')).toBeDefined();
  });
  it('collects legacy orphan audio even when no pads remain', async () => {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('audio', 'readwrite');
      tx.objectStore('audio').put({ sourceId: 'legacy', arrayBuffer: bytes, mimeType: 'audio/wav' });
      tx.oncomplete = () => resolve();
    });
    db.close(); await collectOrphanAudio(); expect(await loadAudio('legacy')).toBeUndefined();
  });
});
