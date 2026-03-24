import { describe, expect, test } from "bun:test";
import { connectItemFieldsToSecrets } from "./connect-env";

describe("connectItemFieldsToSecrets", () => {
  test("maps allowlisted labels from Connect item fields", () => {
    const secrets = connectItemFieldsToSecrets({
      id: "x",
      fields: [
        { label: "ENCRYPTION_KEY", value: "abc", type: "CONCEALED" },
        { label: "CLERK_SECRET_KEY", value: "sk_live", type: "STRING" },
        { label: "IGNORE_ME", value: "nope", type: "STRING" },
        { label: "lowercase_ignored", value: "nope", type: "STRING" },
      ],
    });
    expect(secrets.ENCRYPTION_KEY).toBe("abc");
    expect(secrets.CLERK_SECRET_KEY).toBe("sk_live");
    expect(secrets.IGNORE_ME).toBeUndefined();
    expect(secrets.lowercase_ignored).toBeUndefined();
  });

  test("returns empty for invalid input", () => {
    expect(connectItemFieldsToSecrets(null)).toEqual({});
    expect(connectItemFieldsToSecrets({})).toEqual({});
    expect(connectItemFieldsToSecrets({ fields: "bad" })).toEqual({});
  });
});
