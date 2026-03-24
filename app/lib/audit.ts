export type AuditResource = {
  type: string;
  id: string;
};

export async function recordAuditEvent(
  db: D1Database,
  userId: string,
  action: string,
  resource?: AuditResource
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_events (id, user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      userId,
      action,
      resource?.type ?? null,
      resource?.id ?? null
    )
    .run();
}
