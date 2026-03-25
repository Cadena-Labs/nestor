import { describe, expect, test } from "bun:test";

import {
  applyProviderKeyUpdates,
  buildProviderKeyUpdates,
  createEmptyKeysConfigured,
  deriveNextModelId,
} from "./settings-state";

describe("createEmptyKeysConfigured", () => {
  test("marks only present providers as configured", () => {
    const configured = createEmptyKeysConfigured([
      { provider: "anthropic" },
      { provider: "openrouter" },
    ]);

    expect(configured).toEqual({
      anthropic: true,
      openai: false,
      openrouter: true,
    });
  });
});

describe("buildProviderKeyUpdates", () => {
  test("merges providerKeys with the legacy apiKey field", () => {
    expect(
      buildProviderKeyUpdates("openai", "sk-legacy", {
        anthropic: "sk-ant",
        openrouter: null,
      })
    ).toEqual({
      anthropic: "sk-ant",
      openai: "sk-legacy",
      openrouter: null,
    });
  });
});

describe("applyProviderKeyUpdates", () => {
  test("marks a provider as removed when the update is null", () => {
    expect(
      applyProviderKeyUpdates(
        {
          anthropic: true,
          openai: true,
          openrouter: false,
        },
        { openai: null }
      )
    ).toEqual({
      anthropic: true,
      openai: false,
      openrouter: false,
    });
  });

  test("marks a provider as configured when a new key is supplied", () => {
    expect(
      applyProviderKeyUpdates(
        {
          anthropic: false,
          openai: false,
          openrouter: false,
        },
        { openrouter: "sk-openrouter" }
      )
    ).toEqual({
      anthropic: false,
      openai: false,
      openrouter: true,
    });
  });
});

describe("deriveNextModelId", () => {
  test("clears the model when switching providers without selecting a new one", () => {
    expect(
      deriveNextModelId({
        currentProvider: "anthropic",
        nextProvider: "openai",
        currentModelId: "claude-sonnet-4-6",
        requestedModelId: undefined,
      })
    ).toBe("");
  });

  test("preserves the current model when the provider stays the same", () => {
    expect(
      deriveNextModelId({
        currentProvider: "openai",
        nextProvider: "openai",
        currentModelId: "gpt-5",
        requestedModelId: undefined,
      })
    ).toBe("gpt-5");
  });

  test("uses the explicitly requested model even if it is empty", () => {
    expect(
      deriveNextModelId({
        currentProvider: "openrouter",
        nextProvider: "openrouter",
        currentModelId: "anthropic/claude-sonnet-4-6",
        requestedModelId: "",
      })
    ).toBe("");
  });
});
