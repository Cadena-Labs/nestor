import { describe, expect, test } from "bun:test";
import {
  buildPanosApiEndpoint,
  deviceHostSchema,
  parseEncryptionKey,
} from "./security";

describe("deviceHostSchema", () => {
  test("accepts bare hostnames and IP literals", () => {
    expect(deviceHostSchema.parse("fw.example.com")).toBe("fw.example.com");
    expect(deviceHostSchema.parse("10.0.0.1")).toBe("10.0.0.1");
    expect(deviceHostSchema.parse("2001:db8::1")).toBe("2001:db8::1");
  });

  test("rejects schemes, ports, paths, queries, and credentials", () => {
    for (const host of [
      "https://fw.example.com",
      "fw.example.com:443",
      "fw.example.com/api",
      "fw.example.com?x=1",
      "user@fw.example.com",
      "[2001:db8::1]",
    ]) {
      expect(() => deviceHostSchema.parse(host)).toThrow();
    }
  });
});

describe("parseEncryptionKey", () => {
  test("accepts a base64-encoded 32-byte key", () => {
    const key = btoa("12345678901234567890123456789012");

    expect(parseEncryptionKey(key)).toHaveLength(32);
  });

  test("rejects malformed or wrong-length keys", () => {
    expect(() => parseEncryptionKey("not-base64")).toThrow();
    expect(() => parseEncryptionKey(btoa("too-short"))).toThrow();
  });
});

describe("buildPanosApiEndpoint", () => {
  test("returns /api/ URL with no query string", () => {
    const url = buildPanosApiEndpoint("fw.example.com");
    expect(url.href).toBe("https://fw.example.com/api/");
    expect(url.search).toBe("");
  });

  test("brackets IPv6 in the authority", () => {
    const url = buildPanosApiEndpoint("2001:db8::1");
    expect(url.href).toBe("https://[2001:db8::1]/api/");
    expect(url.pathname).toBe("/api/");
    expect(url.search).toBe("");
  });
});
