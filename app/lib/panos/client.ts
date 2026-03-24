import { XMLParser } from "fast-xml-parser";
import { buildPanosApiEndpoint, PANOS_REQUEST_TIMEOUT_MS } from "../security";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export class PanosClient {
  private host: string;
  private apiKey: string;

  constructor(host: string, apiKey: string) {
    this.host = host;
    this.apiKey = apiKey;
  }

  private async request(params: Record<string, string>): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PANOS_REQUEST_TIMEOUT_MS);

    try {
      const url = buildPanosApiEndpoint(this.host);
      const body = new URLSearchParams();
      body.set("key", this.apiKey);
      for (const [k, v] of Object.entries(params)) {
        body.set(k, v);
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/xml",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        redirect: "error",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `PAN-OS API HTTP error: ${response.status} ${response.statusText}`
        );
      }

      const xml = await response.text();
      const parsed = parser.parse(xml);

      const status = parsed?.response?.["@_status"];
      if (status === "error") {
        const msg =
          parsed?.response?.result?.msg?.line ??
          parsed?.response?.msg?.line ??
          parsed?.response?.msg ??
          "Unknown PAN-OS API error";
        throw new Error(`PAN-OS API error: ${JSON.stringify(msg)}`);
      }

      return parsed?.response?.result;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("PAN-OS API request timed out");
      }

      if (error instanceof Error) {
        throw new Error(error.message);
      }

      throw new Error("PAN-OS API request failed");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async executeOp(cmd: string): Promise<any> {
    return this.request({ type: "op", cmd });
  }

  async getConfig(xpath: string): Promise<any> {
    return this.request({ type: "config", action: "get", xpath });
  }

  async queryLogs(
    logType: string,
    filter: string,
    maxLogs: number = 20
  ): Promise<any> {
    // Submit the log query job
    const params: Record<string, string> = {
      type: "log",
      "log-type": logType,
      nlogs: String(maxLogs),
    };
    if (filter) {
      params.query = filter;
    }

    const submitResult = await this.request(params);

    const jobId = submitResult?.job;
    if (!jobId) {
      throw new Error("PAN-OS log query did not return a job ID");
    }

    // Poll for results
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const pollResult = await this.request({
        type: "log",
        action: "get",
        "job-id": String(jobId),
      });

      const status = pollResult?.job?.status;
      if (status === "FIN") {
        return pollResult;
      }
    }

    throw new Error(
      `PAN-OS log query timed out after ${maxAttempts} attempts (job ${jobId})`
    );
  }
}
