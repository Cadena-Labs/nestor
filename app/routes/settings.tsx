import { Show, RedirectToSignIn, useUser } from "@clerk/react-router";
import { useState, useEffect } from "react";
import { PROVIDERS, type Provider } from "../lib/ai-provider";

function SettingsContent() {
  const { user } = useUser();
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [modelId, setModelId] = useState("claude-opus-4-6");
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Devices state
  const [devices, setDevices] = useState<
    Array<{ id: string; name: string; host: string }>
  >([]);
  const [newDevice, setNewDevice] = useState({ name: "", host: "", apiKey: "" });
  const [addingDevice, setAddingDevice] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: any) => {
        if (data.provider) setProvider(data.provider);
        if (data.modelId) setModelId(data.modelId);
        setHasApiKey(data.hasApiKey);
      });

    fetch("/api/devices")
      .then((r) => r.json())
      .then((data: any) => setDevices(data));
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setMessage("");
    const body: any = { provider, modelId };
    if (apiKey) body.apiKey = apiKey;

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setMessage("Settings saved");
      setApiKey("");
      setHasApiKey(true);
    } else {
      setMessage("Failed to save settings");
    }
    setSaving(false);
  };

  const addDevice = async () => {
    if (!newDevice.name || !newDevice.host || !newDevice.apiKey) return;
    setAddingDevice(true);

    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDevice),
    });

    if (res.ok) {
      const device = await res.json() as any;
      setDevices([device, ...devices]);
      setNewDevice({ name: "", host: "", apiKey: "" });
    }
    setAddingDevice(false);
  };

  const deleteDevice = async (id: string) => {
    await fetch(`/api/devices/${id}`, { method: "DELETE" });
    setDevices(devices.filter((d) => d.id !== id));
  };

  const models = PROVIDERS[provider]?.models ?? [];

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <a href="/" className="text-blue-600 hover:underline">
            &larr; Back to chat
          </a>
          <span className="text-gray-300">/</span>
          <a href="/account" className="text-blue-600 hover:underline">
            Account
          </a>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <aside
        className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        role="note"
      >
        <p className="font-semibold text-amber-900 dark:text-amber-50">
          Data handling and third-party AI
        </p>
        <p className="mt-2 leading-relaxed">
          Chat requests are processed by the AI provider you configure below. Firewall
          configuration, operational output, and logs retrieved via tools may be sent to
          that provider as part of the conversation. Review their data and retention
          policies before use in regulated or sensitive environments.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1">
          <li>
            <a
              href="https://www.anthropic.com/legal/privacy"
              className="text-amber-900 underline hover:no-underline dark:text-amber-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              Anthropic privacy
            </a>
          </li>
          <li>
            <a
              href="https://openai.com/policies/privacy-policy"
              className="text-amber-900 underline hover:no-underline dark:text-amber-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAI privacy
            </a>
          </li>
          <li>
            <a
              href="https://openrouter.ai/privacy"
              className="text-amber-900 underline hover:no-underline dark:text-amber-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenRouter privacy
            </a>
          </li>
        </ul>
      </aside>

      {/* AI Provider */}
      <section className="mb-8 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
        <h2 className="text-lg font-semibold mb-4">AI Provider</h2>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Provider
          </span>
          <select
            value={provider}
            onChange={(e) => {
              const p = e.target.value as Provider;
              setProvider(p);
              setModelId(PROVIDERS[p].models[0]?.id ?? "");
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {Object.entries(PROVIDERS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Model
          </span>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            API Key {hasApiKey && "(saved)"}
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasApiKey ? "Enter new key to update" : "Enter API key"}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {message && (
          <span className="ml-3 text-sm text-gray-600">{message}</span>
        )}
      </section>

      {/* Devices */}
      <section className="rounded-lg border border-gray-200 p-6 dark:border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Firewall Connections</h2>

        {devices.length > 0 && (
          <div className="mb-4 space-y-2">
            {devices.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700"
              >
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-sm text-gray-500">{d.host}</div>
                </div>
                <button
                  onClick={() => deleteDevice(d.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Add Device
          </h3>
          <input
            type="text"
            value={newDevice.name}
            onChange={(e) =>
              setNewDevice({ ...newDevice, name: e.target.value })
            }
            placeholder="Name (e.g., Prod Firewall)"
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <input
            type="text"
            value={newDevice.host}
            onChange={(e) =>
              setNewDevice({ ...newDevice, host: e.target.value })
            }
            placeholder="Host (e.g., 10.0.0.1 or fw.example.com)"
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <input
            type="password"
            value={newDevice.apiKey}
            onChange={(e) =>
              setNewDevice({ ...newDevice, apiKey: e.target.value })
            }
            placeholder="PAN-OS API Key"
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            onClick={addDevice}
            disabled={addingDevice || !newDevice.name || !newDevice.host || !newDevice.apiKey}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {addingDevice ? "Adding..." : "Add Device"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <Show when="signed-in">
        <SettingsContent />
      </Show>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </>
  );
}
