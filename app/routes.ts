import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sign-in/*", "routes/auth/sign-in.tsx"),
  route("sign-up/*", "routes/auth/sign-up.tsx"),
  route("account", "routes/account.tsx"),
  route("settings", "routes/settings.tsx"),
  route("api/conversations/:conversationId/messages", "routes/api.conversations.$conversationId.messages.tsx"),
  route("api/conversations/:conversationId", "routes/api.conversations.$conversationId.tsx"),
  route("api/conversations", "routes/api.conversations.tsx"),
  route("api/devices/:deviceId", "routes/api.devices.$deviceId.tsx"),
  route("api/devices", "routes/api.devices.tsx"),
  route("api/settings", "routes/api.settings.tsx"),
  route("api/chat", "routes/api.chat.tsx"),
] satisfies RouteConfig;
