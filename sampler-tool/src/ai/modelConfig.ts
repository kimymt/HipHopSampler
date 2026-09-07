import type { AppConfig } from '@mlc-ai/web-llm';

export const WEBLLM_MODEL_ID = 'Qwen2-0.5B-Instruct-q4f16_1-MLC';

/**
 * Reviewed artifact bytes, verified on 2026-09-07. Update revisions and hashes
 * together when upgrading the model/runtime. Never fall back to mutable main.
 * WebLLM verifies config, WASM and tokenizer even when read from its cache.
 * Weight shards share the immutable model revision; the SDK does not expose
 * per-shard SRI verification.
 */
export const WEBLLM_APP_CONFIG: AppConfig = {
  model_list: [{
    model_id: WEBLLM_MODEL_ID,
    model: 'https://huggingface.co/mlc-ai/Qwen2-0.5B-Instruct-q4f16_1-MLC/resolve/a8a2fb7bc87fc8e76a4a489a15640b61c3d45ec7/',
    model_lib: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/025bcaf3780fa8254f5e5efd3bfea0a5397248f4/web-llm-models/v0_2_83/base/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm',
    low_resource_required: true,
    vram_required_MB: 944.62,
    overrides: { context_window_size: 4096 },
    integrity: {
      config: 'sha256-F4735pWPSrRtKyQrDHAUx4WJLx69Qu4TNhM3pc0KASQ=',
      model_lib: 'sha256-9NHcMeeOGl8oKIVO2/deVZt1CBI/VX//2OmzV6mYL3A=',
      tokenizer: {
        'tokenizer.json': 'sha256-98my26SilrGqdsFqNLgiXAwRiXhADUu2a/8JAtcC9bg=',
      },
      onFailure: 'error',
    },
  }],
};
