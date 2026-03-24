import { afterEach, describe, expect, mock, test } from "bun:test";
import { PanosClient } from "./client";

describe("PanosClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("POSTs form body and does not put API key in the request URL", async () => {
    const fetchMock = mock((_input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          `<?xml version="1.0"?><response status="success"><result>ok</result></response>`,
          { status: 200, headers: { "Content-Type": "application/xml" } }
        )
      )
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = new PanosClient("fw.example.com", "secret-api-key");
    await client.executeOp("<show><version></version></show>");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit | undefined,
    ];
    expect(input.href).toBe("https://fw.example.com/api/");
    expect(input.search).toBe("");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Accept: "application/xml",
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const body = String(init?.body ?? "");
    expect(body).toContain("key=secret-api-key");
    expect(body).toContain("type=op");
    expect(body).toContain("cmd=");
  });
});
