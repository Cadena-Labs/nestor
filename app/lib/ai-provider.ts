import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

export type Provider = "anthropic" | "openrouter" | "openai";

export const PROVIDERS: Record<Provider, { label: string }> = {
  anthropic: {
    label: "Anthropic",
  },
  openrouter: {
    label: "OpenRouter",
  },
  openai: {
    label: "OpenAI",
  },
};

export function getModel(
  provider: Provider,
  apiKey: string,
  modelId: string
): LanguageModelV1 {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "openrouter":
      return createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
      })(modelId);
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
