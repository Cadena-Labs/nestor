import { convertToCoreMessages, streamText, type Message } from "ai";
import { getModel, type Provider } from "../ai-provider";
import { recordAuditEvent } from "../audit";
import {
  decryptDeviceApiKey,
  decryptUserSettingsApiKey,
} from "../user-secret-upgrade";
import { PanosClient, createPanosTools } from "../panos";
import { chatRequestSchema } from "../validation";
import {
  checkChatRateLimitRemote,
  parseEnvDisabled,
  resolveChatMaxLogsPerQuery,
  resolveChatMaxSteps,
  resolveMaxToolOutputChars,
} from "../security";

const SYSTEM_PROMPT = `You are Nestor, an AI networking assistant specialized in Palo Alto Networks firewalls and Panorama.

You have access to tools that query a PAN-OS device's XML API. Use these tools to answer questions about the device's configuration, status, and health.

Guidelines:
- Always explain what you're checking before using tools
- Summarize findings clearly and concisely
- Format firewall rules, routes, and config in readable tables
- When asked about security posture, check relevant rules, profiles, and logs
- You are in READ-ONLY monitoring mode — no configuration changes are possible
- If a tool call fails, explain the error and suggest alternatives
- Retrieve only what you need: prefer targeted checks over bulk dumps; avoid chaining large pulls without a clear user goal
- If output was truncated, help the user narrow the question instead of repeating a huge pull

You are talking to a network engineer who understands PAN-OS concepts.`;

export async function postChat(
  userId: string,
  env: Env,
  request: Request
): Promise<Response> {
  const db = env.DB;
  const encryptionKey = env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    return Response.json({ error: "Encryption not configured" }, { status: 500 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid chat request" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const clientIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    "unknown";
  const rateLimit = await checkChatRateLimitRemote(
    env,
    `${userId}:${clientIp}`
  );

  if (!rateLimit.allowed) {
    const headers = new Headers();
    if (rateLimit.retryAfterSeconds) {
      headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    }
    return Response.json({ error: "Too many chat requests" }, {
      status: 429,
      headers,
    });
  }

  const settings = await db
    .prepare(
      "SELECT provider, model_id, api_key_encrypted, key_version FROM user_settings WHERE user_id = ?"
    )
    .bind(userId)
    .first<{
      provider: string;
      model_id: string;
      api_key_encrypted: string;
      key_version: number;
    }>();

  if (!settings) {
    return Response.json(
      { error: "Please configure your AI provider in settings" },
      { status: 400 }
    );
  }

  const device = await db
    .prepare(
      "SELECT host, api_key_encrypted, key_version FROM devices WHERE id = ? AND user_id = ?"
    )
    .bind(data.deviceId, userId)
    .first<{
      host: string;
      api_key_encrypted: string;
      key_version: number;
    }>();

  if (!device) {
    return Response.json({ error: "Device not found" }, { status: 404 });
  }

  let conversationId: string | undefined;
  if (data.conversationId) {
    const conversation = await db
      .prepare(
        "SELECT id, device_id FROM conversations WHERE id = ? AND user_id = ?"
      )
      .bind(data.conversationId, userId)
      .first<{ id: string; device_id: string }>();

    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.device_id !== data.deviceId) {
      return Response.json(
        { error: "Conversation does not belong to the selected device" },
        { status: 400 }
      );
    }

    conversationId = conversation.id;
  }

  const aiApiKey = await decryptUserSettingsApiKey(
    db,
    encryptionKey,
    userId,
    settings.api_key_encrypted,
    settings.key_version
  );
  const panosApiKey = await decryptDeviceApiKey(
    db,
    encryptionKey,
    userId,
    data.deviceId,
    device.api_key_encrypted,
    device.key_version
  );

  await recordAuditEvent(db, userId, "chat_request", {
    type: "device",
    id: data.deviceId,
  });

  const panosClient = new PanosClient(device.host, panosApiKey);
  const tools = createPanosTools(panosClient, {
    includeLogTools: !parseEnvDisabled(env.DISABLE_LOG_TOOLS),
    maxToolOutputChars: resolveMaxToolOutputChars(env),
    maxLogsPerQuery: resolveChatMaxLogsPerQuery(env),
  });

  const model = getModel(
    settings.provider as Provider,
    aiApiKey,
    settings.model_id
  );

  const requestMessages = data.messages.map(({ id: _id, ...message }) => message) as Array<
    Omit<Message, "id">
  >;
  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: convertToCoreMessages(requestMessages),
    tools,
    maxSteps: resolveChatMaxSteps(env),
    onFinish: async ({ text }) => {
      if (conversationId && text) {
        const msgId = crypto.randomUUID();
        await db
          .prepare(
            "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)"
          )
          .bind(msgId, conversationId, text)
          .run();

        await db
          .prepare(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?"
          )
          .bind(conversationId)
          .run();
      }
    },
  });

  return result.toDataStreamResponse();
}
