import { type Provider } from "./ai-provider";

export type ProviderModelOption = {
  id: string;
  label: string;
};

export const OPENROUTER_VENDOR_PREFIXES = [
  "anthropic/",
  "openai/",
  "google/",
  "x-ai/",
  "moonshotai/",
  "deepseek/",
  "minimax/",
] as const;

const OPENAI_EXCLUDED_PREFIXES = [
  "text-embedding-",
  "whisper-",
  "tts-",
  "omni-moderation-",
  "text-moderation-",
  "gpt-image-",
  "dall-e-",
] as const;

function byLabel(a: ProviderModelOption, b: ProviderModelOption) {
  return a.label.localeCompare(b.label);
}

function byContextThenLabel<T extends ProviderModelOption & { contextWindow?: number | null }>(
  a: T,
  b: T
) {
  return (b.contextWindow ?? 0) - (a.contextWindow ?? 0) || byLabel(a, b);
}

export function normalizeOpenAIModels(
  data: Array<{ id: string }>
): ProviderModelOption[] {
  return data
    .filter(({ id }) => !OPENAI_EXCLUDED_PREFIXES.some((prefix) => id.startsWith(prefix)))
    .map(({ id }) => ({ id, label: id }))
    .sort(byLabel);
}

export function normalizeAnthropicModels(
  data: Array<{
    id: string;
    display_name?: string;
    max_input_tokens?: number;
    type?: string;
  }>
): ProviderModelOption[] {
  return data
    .filter((model) => model.type === undefined || model.type === "model")
    .map((model) => ({
      id: model.id,
      label: model.display_name ?? model.id,
      contextWindow: model.max_input_tokens,
    }))
    .sort(byContextThenLabel)
    .map(({ id, label }) => ({ id, label }));
}

export function normalizeOpenRouterModels(
  data: Array<{
    id: string;
    name?: string;
    context_length?: number;
    architecture?: { output_modalities?: string[] };
    supported_parameters?: string[];
  }>
): ProviderModelOption[] {
  return data
    .filter((model) => OPENROUTER_VENDOR_PREFIXES.some((prefix) => model.id.startsWith(prefix)))
    .filter((model) => model.architecture?.output_modalities?.includes("text"))
    .filter((model) => model.supported_parameters?.includes("tools"))
    .map((model) => ({
      id: model.id,
      label: model.name ?? model.id,
      contextWindow: model.context_length,
    }))
    .sort(byContextThenLabel)
    .map(({ id, label }) => ({ id, label }));
}

export function ensureSelectedModelVisible(
  models: ProviderModelOption[],
  selectedModelId?: string | null
): ProviderModelOption[] {
  if (!selectedModelId) {
    return models;
  }

  if (models.some((model) => model.id === selectedModelId)) {
    return models;
  }

  return [
    {
      id: selectedModelId,
      label: `${selectedModelId} (current, may be unavailable)`,
    },
    ...models,
  ];
}

async function fetchJson(
  url: string,
  init: RequestInit,
  provider: Provider
): Promise<unknown> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Failed to load ${provider} models`);
  }

  return response.json();
}

export async function listProviderModels(
  provider: Provider,
  apiKey: string,
  currentModelId?: string | null
): Promise<ProviderModelOption[]> {
  let models: ProviderModelOption[];

  switch (provider) {
    case "openai": {
      const response = await fetchJson(
        "https://api.openai.com/v1/models",
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        provider
      );
      const data = response as { data?: Array<{ id: string }> };
      models = normalizeOpenAIModels(data.data ?? []);
      break;
    }
    case "anthropic": {
      const response = await fetchJson(
        "https://api.anthropic.com/v1/models?limit=1000",
        {
          headers: {
            "anthropic-version": "2023-06-01",
            "x-api-key": apiKey,
          },
        },
        provider
      );
      const data = response as {
        data?: Array<{
          id: string;
          display_name?: string;
          max_input_tokens?: number;
          type?: string;
        }>;
      };
      models = normalizeAnthropicModels(data.data ?? []);
      break;
    }
    case "openrouter": {
      const url = new URL("https://openrouter.ai/api/v1/models");
      url.searchParams.set("output_modalities", "text");
      url.searchParams.set("supported_parameters", "tools");

      const response = await fetchJson(
        url.toString(),
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        provider
      );
      const data = response as {
        data?: Array<{
          id: string;
          name?: string;
          context_length?: number;
          architecture?: { output_modalities?: string[] };
          supported_parameters?: string[];
        }>;
      };
      models = normalizeOpenRouterModels(data.data ?? []).slice(0, 200);
      break;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  return ensureSelectedModelVisible(models, currentModelId);
}
