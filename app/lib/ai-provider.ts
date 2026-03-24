import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

export type Provider = "anthropic" | "openrouter" | "openai";

export const PROVIDERS: Record<
  Provider,
  { label: string; models: { id: string; label: string }[] }
> = {
  anthropic: {
    label: "Anthropic",
    models: [
      { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    models: [
      { id: "anthropic/claude-opus-4-6", label: "Claude Opus 4.6" },
      { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "openai/gpt-4o", label: "GPT-4o" },
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
  },
  openai: {
    label: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    ],
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
