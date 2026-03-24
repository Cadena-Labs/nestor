import {
  conversationCreateSchema,
  conversationMessageSchema,
} from "../validation";

export async function listConversations(
  userId: string,
  env: Env,
  deviceId: string | null
): Promise<Response> {
  const db = env.DB;

  let query =
    "SELECT id, device_id, title, created_at, updated_at FROM conversations WHERE user_id = ?";
  const binds: string[] = [userId];

  if (deviceId) {
    query += " AND device_id = ?";
    binds.push(deviceId);
  }

  query += " ORDER BY updated_at DESC";

  const stmt = db.prepare(query);
  const { results } = await stmt.bind(...binds).all<{
    id: string;
    device_id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }>();

  return Response.json(results);
}

export async function createConversation(
  userId: string,
  env: Env,
  request: Request
): Promise<Response> {
  const db = env.DB;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = conversationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid conversation" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const device = await db
    .prepare("SELECT id FROM devices WHERE id = ? AND user_id = ?")
    .bind(data.deviceId, userId)
    .first();

  if (!device) {
    return Response.json({ error: "Device not found" }, { status: 404 });
  }

  const id = crypto.randomUUID();

  await db
    .prepare(
      "INSERT INTO conversations (id, user_id, device_id, title) VALUES (?, ?, ?, ?)"
    )
    .bind(id, userId, data.deviceId, data.title ?? "New conversation")
    .run();

  return Response.json(
    { id, deviceId: data.deviceId, title: data.title ?? "New conversation" },
    { status: 201 }
  );
}

export async function deleteConversation(
  userId: string,
  env: Env,
  conversationId: string
): Promise<Response> {
  const db = env.DB;

  await db
    .prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?")
    .bind(conversationId, userId)
    .run();

  return Response.json({ ok: true });
}

export async function listMessages(
  userId: string,
  env: Env,
  conversationId: string
): Promise<Response> {
  const db = env.DB;

  const conversation = await db
    .prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?")
    .bind(conversationId, userId)
    .first();

  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { results } = await db
    .prepare(
      "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    )
    .bind(conversationId)
    .all<{ id: string; role: string; content: string; created_at: string }>();

  return Response.json(results);
}

export async function appendUserMessage(
  userId: string,
  env: Env,
  conversationId: string,
  request: Request
): Promise<Response> {
  const db = env.DB;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = conversationMessageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message" },
      { status: 400 }
    );
  }

  const conversation = await db
    .prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?")
    .bind(conversationId, userId)
    .first();

  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const messageId = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)"
    )
    .bind(messageId, conversationId, parsed.data.content)
    .run();

  await db
    .prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?")
    .bind(conversationId)
    .run();

  return Response.json({ id: messageId, ok: true }, { status: 201 });
}
