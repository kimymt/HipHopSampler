import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBLLM_APP_CONFIG, WEBLLM_MODEL_ID } from './modelConfig';
import { __setEngineForTest, isWebLLMCached, loadWebLLM } from './webllmClient';

const sdk = vi.hoisted(() => ({ CreateMLCEngine: vi.fn(), hasModelInCache: vi.fn() }));
vi.mock('@mlc-ai/web-llm', () => sdk);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  __setEngineForTest(null);
  vi.stubGlobal('navigator', { gpu: { requestAdapter: vi.fn().mockResolvedValue({}) } });
});
afterEach(() => {
  __setEngineForTest(null);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pinned WebLLM artifacts', () => {
  it('loads the explicit immutable manifest and uses it for cache lookup', async () => {
    const engine = { chatCompletion: vi.fn() };
    sdk.CreateMLCEngine.mockResolvedValue(engine);
    sdk.hasModelInCache.mockResolvedValue(true);
    await expect(loadWebLLM()).resolves.toBe(engine);
    expect(sdk.CreateMLCEngine).toHaveBeenCalledWith(WEBLLM_MODEL_ID, expect.objectContaining({
      appConfig: WEBLLM_APP_CONFIG,
    }));
    await expect(isWebLLMCached()).resolves.toBe(true);
    expect(sdk.hasModelInCache).toHaveBeenCalledWith(WEBLLM_MODEL_ID, WEBLLM_APP_CONFIG);
    const record = WEBLLM_APP_CONFIG.model_list[0];
    expect(record.model).toMatch(/\/resolve\/[a-f0-9]{40}\/$/);
    expect(record.model_lib).toMatch(/binary-mlc-llm-libs\/[a-f0-9]{40}\//);
    expect(record.integrity?.onFailure).toBe('error');
  });

  it('surfaces integrity failures without loading a fallback model and permits retry', async () => {
    sdk.CreateMLCEngine.mockRejectedValueOnce(new Error('Integrity mismatch'));
    await expect(loadWebLLM()).rejects.toThrow('Integrity mismatch');
    expect(sdk.CreateMLCEngine).toHaveBeenCalledTimes(1);
    const engine = { chatCompletion: vi.fn() };
    sdk.CreateMLCEngine.mockResolvedValueOnce(engine);
    await expect(loadWebLLM()).resolves.toBe(engine);
    expect(sdk.CreateMLCEngine).toHaveBeenCalledTimes(2);
  });

  it('actual SDK rejects modified bytes for each configured artifact hash', async () => {
    const actual = await vi.importActual<typeof import('@mlc-ai/web-llm')>('@mlc-ai/web-llm');
    const integrity = WEBLLM_APP_CONFIG.model_list[0].integrity!;
    const modified = new TextEncoder().encode('modified artifact').buffer;
    for (const hash of [integrity.config!, integrity.model_lib!, integrity.tokenizer!['tokenizer.json']]) {
      expect(actual.isValidSRI(hash)).toBe(true);
      await expect(actual.verifyIntegrity(modified, hash, 'https://example.test/artifact', integrity.onFailure))
        .rejects.toBeInstanceOf(actual.IntegrityError);
    }
  });
});
