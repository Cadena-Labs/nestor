import { createRequestHandler, RouterContextProvider } from "react-router";
import { resolveEnvWithConnect } from "../app/lib/connect-env";
import { buildSecurityHeaders } from "../app/lib/security";

export { ChatRateLimiter } from "./chat-rate-limiter";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    let resolvedEnv: Env;
    try {
      resolvedEnv = await resolveEnvWithConnect(env);
    } catch {
      return new Response("Service configuration error", { status: 503 });
    }

    const loadContext = Object.assign(new RouterContextProvider(), {
      cloudflare: { env: resolvedEnv, ctx },
    });

    const response = await requestHandler(request, loadContext);
    const securityHeaders = buildSecurityHeaders(import.meta.env.DEV);
    const headers = new Headers(response.headers);
    securityHeaders.forEach((value, key) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
