import { z } from "zod";
import { PROVIDERS, type Provider } from "./ai-provider";
import {
  MAX_API_KEY_LENGTH,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_CHAT_MESSAGES,
  MAX_CONVERSATION_TITLE_LENGTH,
  MAX_DEVICE_NAME_LENGTH,
  MAX_MODEL_ID_LENGTH,
  deviceHostSchema,
} from "./security";

const providerSchema = z.custom<Provider>((value): value is Provider => {
  return typeof value === "string" && value in PROVIDERS;
}, "Invalid provider");

export const settingsSchema = z
  .object({
    provider: providerSchema,
    modelId: z.string().trim().min(1).max(MAX_MODEL_ID_LENGTH),
    apiKey: z.string().trim().min(1).max(MAX_API_KEY_LENGTH).optional(),
  })
  .superRefine(({ provider, modelId }, ctx) => {
    const validModel = PROVIDERS[provider].models.some((model) => model.id === modelId);

    if (!validModel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid model for provider",
        path: ["modelId"],
      });
    }
  });

export const deviceCreateSchema = z.object({
  name: z.string().trim().min(1).max(MAX_DEVICE_NAME_LENGTH),
  host: deviceHostSchema,
  apiKey: z.string().trim().min(1).max(MAX_API_KEY_LENGTH),
});

export const deviceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(MAX_DEVICE_NAME_LENGTH),
  host: deviceHostSchema,
  apiKey: z.string().trim().min(1).max(MAX_API_KEY_LENGTH).optional(),
});

export const conversationCreateSchema = z.object({
  deviceId: z.string().uuid(),
  title: z.string().trim().min(1).max(MAX_CONVERSATION_TITLE_LENGTH).optional(),
});

export const conversationMessageSchema = z.object({
  role: z.literal("user"),
  content: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
});

const uiMessagePartSchema = z.union([
  z.object({
    type: z.literal("text"),
    text: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
  }).passthrough(),
  z.object({
    type: z.string().regex(/^(tool-|data-).+/),
  }).passthrough(),
  z.object({
    type: z.enum([
      "reasoning",
      "source",
      "source-url",
      "source-document",
      "file",
      "step-start",
      "tool-invocation",
      "dynamic-tool",
    ]),
  }).passthrough(),
]);

export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().optional(),
        role: z.enum(["user", "assistant"]),
        content: z.string().max(MAX_CHAT_MESSAGE_LENGTH),
        parts: z.array(uiMessagePartSchema).min(1),
      }).passthrough()
    )
    .min(1)
    .max(MAX_CHAT_MESSAGES),
  deviceId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
});
