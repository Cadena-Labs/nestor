import { useChat } from "ai/react";
import { UserButton } from "@clerk/react-router";
import { useState, useEffect, useRef } from "react";

interface Device {
  id: string;
  name: string;
  host: string;
}

interface Conversation {
  id: string;
  device_id: string;
  title: string;
  updated_at: string;
}

export function ChatView() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [hasSettings, setHasSettings] = useState<boolean | null>(null);
  const [showAiDataNotice, setShowAiDataNotice] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } =
    useChat({
      api: "/api/chat",
    });

  // Load devices and settings on mount
  useEffect(() => {
    try {
      if (sessionStorage.getItem("nestor-ai-data-notice-dismissed") === "1") {
        setShowAiDataNotice(false);
      }
    } catch {
      /* private mode / SSR */
    }
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const parsed = data as {
          provider: string | null;
          modelId?: string | null;
          keysConfigured?: Record<string, boolean>;
        };
        setHasSettings(
          !!(
            parsed.provider &&
            parsed.modelId &&
            parsed.keysConfigured?.[parsed.provider]
          )
        );
      });
    fetch("/api/devices")
      .then((r) => r.json())
      .then((data: any) => {
        setDevices(data);
        if (data.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(data[0].id);
        }
      });
  }, []);

  // Load conversations when device changes
  useEffect(() => {
    if (!selectedDeviceId) return;
    fetch(`/api/conversations?deviceId=${selectedDeviceId}`)
      .then((r) => r.json())
      .then((data: any) => setConversations(data));
  }, [selectedDeviceId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startNewConversation = async () => {
    if (!selectedDeviceId) return;
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: selectedDeviceId }),
    });
    const conv = (await res.json()) as any;
    setConversations([{ ...conv, device_id: selectedDeviceId, updated_at: new Date().toISOString() }, ...conversations]);
    setActiveConversationId(conv.id);
    setMessages([]);
  };

  const selectConversation = async (convId: string) => {
    setActiveConversationId(convId);
    const res = await fetch(`/api/conversations/${convId}/messages`);
    const msgs = (await res.json()) as any[];
    setMessages(
      msgs.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        parts: [{ type: "text", text: m.content }],
      }))
    );
  };

  // Onboarding state
  if (hasSettings === false || devices.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4">Welcome to Nestor</h1>
          <p className="text-gray-500 mb-6">
            {hasSettings === false
              ? "Configure your AI provider to get started."
              : "Add a firewall connection to get started."}
          </p>
          <a
            href="/settings"
            className="inline-block rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Settings
          </a>
        </div>
      </div>
    );
  }

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="flex w-64 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <span className="text-lg font-bold">Nestor</span>
          <UserButton />
        </div>

        {/* Device selector */}
        <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-800">
          <label htmlFor="chat-device-select" className="sr-only">
            Device
          </label>
          <select
            id="chat-device-select"
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              setActiveConversationId("");
              setMessages([]);
            }}
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* New conversation button */}
        <div className="px-3 py-2">
          <button
            onClick={startNewConversation}
            className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                conv.id === activeConversationId
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : "text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <div className="truncate">{conv.title}</div>
            </button>
          ))}
        </div>

        {/* Account links */}
        <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-800">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <a
              href="/account"
              className="rounded-md px-3 py-2 text-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800"
            >
              Account
            </a>
            <a
              href="/settings"
              className="rounded-md px-3 py-2 text-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800"
            >
              Settings
            </a>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-3 dark:border-gray-800">
          <h2 className="text-sm font-medium text-gray-500">
            {selectedDevice
              ? `${selectedDevice.name} — ${selectedDevice.host}`
              : "Select a device"}
          </h2>
        </div>

        {showAiDataNotice && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="max-w-3xl leading-relaxed">
                Firewall data you ask about may be sent to your configured AI provider.
                See{" "}
                <a href="/settings" className="font-medium underline">
                  Settings
                </a>{" "}
                for details and provider privacy links.
              </p>
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.setItem("nestor-ai-data-notice-dismissed", "1");
                  } catch {
                    /* ignore */
                  }
                  setShowAiDataNotice(false);
                }}
                className="shrink-0 rounded border border-amber-300 px-2 py-1 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-50 dark:hover:bg-amber-900/50"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-gray-400">
                <p className="text-lg font-medium">
                  {activeConversationId
                    ? "Start chatting"
                    : "Create a new chat to begin"}
                </p>
                <p className="mt-1 text-sm">
                  Ask about your firewall's configuration, status, or logs
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-4 ${
                msg.role === "user" ? "flex justify-end" : ""
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                }`}
              >
                <div className="whitespace-pre-wrap">
                  {msg.parts
                    .filter((part) => part.type === "text" || part.type === "reasoning")
                    .map((part, index) => (
                      <span key={`${msg.id}-${index}`}>
                        {"text" in part ? part.text : ""}
                      </span>
                    ))}
                </div>
                {msg.parts?.some((part) => part.type === "tool-invocation") && (
                  <div className="mt-2 flex items-center gap-1 text-xs opacity-70">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
                    Querying firewall...
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="mb-4">
              <div className="inline-block rounded-lg bg-gray-100 px-4 py-3 text-sm dark:bg-gray-800">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce [animation-delay:0.1s]">.</span>
                  <span className="animate-bounce [animation-delay:0.2s]">.</span>
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedDeviceId) return;
              const trimmedInput = input.trim();
              if (!trimmedInput) return;

              let conversationId = activeConversationId;

              // Auto-create conversation if needed
              if (!conversationId) {
                const res = await fetch("/api/conversations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    deviceId: selectedDeviceId,
                    title: trimmedInput.slice(0, 50) || "New conversation",
                  }),
                });
                const conv = (await res.json()) as any;
                conversationId = conv.id;
                setActiveConversationId(conv.id);
                setConversations([
                  { ...conv, device_id: selectedDeviceId, updated_at: new Date().toISOString() },
                  ...conversations,
                ]);
              }

              // Save user message to D1
              if (conversationId) {
                await fetch(`/api/conversations/${conversationId}/messages`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ role: "user", content: trimmedInput }),
                }).catch(() => {}); // Best effort
              }

              handleSubmit(e, {
                body: {
                  deviceId: selectedDeviceId,
                  conversationId,
                },
              });
            }}
            className="flex gap-3"
          >
            <input
              value={input}
              onChange={handleInputChange}
              placeholder={
                selectedDeviceId
                  ? "Ask about your firewall..."
                  : "Select a device first"
              }
              disabled={!selectedDeviceId || isLoading}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
            />
            <button
              type="submit"
              disabled={!input.trim() || !selectedDeviceId || isLoading}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
