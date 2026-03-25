import { describe, expect, test } from "bun:test";

import {
  ensureSelectedModelVisible,
  normalizeAnthropicModels,
  normalizeOpenAIModels,
  normalizeOpenRouterModels,
} from "./list-provider-models";

describe("normalizeOpenAIModels", () => {
  test("keeps chat-capable ids and drops obvious non-chat families", () => {
    const models = normalizeOpenAIModels([
      { id: "gpt-5" },
      { id: "o4-mini" },
      { id: "text-embedding-3-large" },
      { id: "whisper-1" },
      { id: "gpt-image-1" },
    ]);

    expect(models).toEqual([
      { id: "gpt-5", label: "gpt-5" },
      { id: "o4-mini", label: "o4-mini" },
    ]);
  });
});

describe("normalizeAnthropicModels", () => {
  test("maps display names and filters non-model entries", () => {
    const models = normalizeAnthropicModels([
      {
        id: "claude-sonnet-4-6",
        display_name: "Claude Sonnet 4.6",
        type: "model",
      },
      {
        id: "ignored",
        display_name: "Ignored",
        type: "not-model",
      },
    ]);

    expect(models).toEqual([
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    ]);
  });
});

describe("normalizeOpenRouterModels", () => {
  test("keeps only allowlisted vendor text models with tool support", () => {
    const models = normalizeOpenRouterModels([
      {
        id: "anthropic/claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        context_length: 200000,
        architecture: { output_modalities: ["text"] },
        supported_parameters: ["tools", "temperature"],
      },
      {
        id: "deepseek/deepseek-chat-v3-0324",
        name: "DeepSeek Chat",
        context_length: 256000,
        architecture: { output_modalities: ["text"] },
        supported_parameters: ["tools"],
      },
      {
        id: "moonshotai/kimi-k2",
        name: "Kimi K2",
        context_length: 128000,
        architecture: { output_modalities: ["text"] },
        supported_parameters: ["temperature"],
      },
      {
        id: "qwen/qwen-3",
        name: "Qwen 3",
        context_length: 128000,
        architecture: { output_modalities: ["text"] },
        supported_parameters: ["tools"],
      },
      {
        id: "x-ai/grok-4-vision",
        name: "Grok Vision",
        context_length: 128000,
        architecture: { output_modalities: ["image"] },
        supported_parameters: ["tools"],
      },
    ]);

    expect(models).toEqual([
      { id: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek Chat" },
      { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    ]);
  });
});

describe("ensureSelectedModelVisible", () => {
  test("injects the current model when filtering removed it", () => {
    expect(
      ensureSelectedModelVisible(
        [{ id: "gpt-5", label: "gpt-5" }],
        "legacy-model"
      )
    ).toEqual([
      { id: "legacy-model", label: "legacy-model (current, may be unavailable)" },
      { id: "gpt-5", label: "gpt-5" },
    ]);
  });
});
