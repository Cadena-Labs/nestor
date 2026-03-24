/**
 * Per-key sliding chat rate limit state (one Durable Object instance per idFromName key).
 */
export class ChatRateLimiter {
  constructor(
    private readonly ctx: DurableObjectState,
    _env: unknown
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let body: { maxRequests?: number; windowMs?: number };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const maxRequests = body.maxRequests ?? 20;
    const windowMs = body.windowMs ?? 60_000;
    const now = Date.now();

    let state = await this.ctx.storage.get<{
      count: number;
      resetAt: number;
    }>("window");

    if (!state || state.resetAt <= now) {
      state = { count: 1, resetAt: now + windowMs };
      await this.ctx.storage.put("window", state);
      return Response.json({ allowed: true });
    }

    if (state.count >= maxRequests) {
      return Response.json({
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((state.resetAt - now) / 1000)
        ),
      });
    }

    state = { count: state.count + 1, resetAt: state.resetAt };
    await this.ctx.storage.put("window", state);
    return Response.json({ allowed: true });
  }
}
