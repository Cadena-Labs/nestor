import { type Provider } from "./ai-provider";

export type ProviderKeyUpdate = string | null;

export type ProviderKeyUpdates = Partial<Record<Provider, ProviderKeyUpdate>>;

export type KeysConfigured = Record<Provider, boolean>;

export function createEmptyKeysConfigured(
  rows: Array<{ provider: string }>
): KeysConfigured {
  const configured: KeysConfigured = {
    anthropic: false,
    openai: false,
    openrouter: false,
  };

  for (const row of rows) {
    if (row.provider in configured) {
      configured[row.provider as Provider] = true;
    }
  }

  return configured;
}

export function buildProviderKeyUpdates(
  provider: Provider,
  apiKey?: string,
  providerKeys?: ProviderKeyUpdates
): ProviderKeyUpdates {
  return {
    ...providerKeys,
    ...(apiKey ? { [provider]: apiKey } : {}),
  };
}

export function applyProviderKeyUpdates(
  configured: KeysConfigured,
  updates: ProviderKeyUpdates
): KeysConfigured {
  const next = { ...configured };

  for (const [provider, value] of Object.entries(updates)) {
    next[provider as Provider] = value !== null;
  }

  return next;
}

export function deriveNextModelId({
  currentProvider,
  nextProvider,
  currentModelId,
  requestedModelId,
}: {
  currentProvider?: Provider | null;
  nextProvider: Provider;
  currentModelId?: string | null;
  requestedModelId?: string;
}): string {
  if (requestedModelId !== undefined) {
    return requestedModelId;
  }

  if (!currentProvider || currentProvider !== nextProvider) {
    return "";
  }

  return currentModelId ?? "";
}
