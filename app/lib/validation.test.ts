import { describe, expect, test } from "bun:test";

import { settingsSchema } from "./validation";

describe("settingsSchema", () => {
  test("accepts multiple provider key updates with an empty model selection", () => {
    const parsed = settingsSchema.parse({
      provider: "openrouter",
      modelId: "",
      providerKeys: {
        anthropic: "sk-ant",
        openrouter: "sk-or",
      },
    });

    expect(parsed).toEqual({
      provider: "openrouter",
      modelId: "",
      providerKeys: {
        anthropic: "sk-ant",
        openrouter: "sk-or",
      },
    });
  });

  test("accepts the legacy single apiKey path without a model id", () => {
    const parsed = settingsSchema.parse({
      provider: "openai",
      apiKey: "sk-openai",
    });

    expect(parsed).toEqual({
      provider: "openai",
      apiKey: "sk-openai",
    });
  });

  test("allows explicit provider-key removal with null", () => {
    const parsed = settingsSchema.parse({
      provider: "anthropic",
      providerKeys: {
        openai: null,
      },
    });

    expect(parsed.providerKeys?.openai).toBeNull();
  });
});
