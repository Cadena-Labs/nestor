import { describe, expect, test } from "bun:test";

import {
  createAccountProfile,
  type ClerkAccountProfileUser,
} from "./account-profile";

function makeUser(
  overrides: Partial<ClerkAccountProfileUser> = {}
): ClerkAccountProfileUser {
  return {
    id: "user_123",
    username: "alice",
    firstName: "Alice",
    lastName: "Ng",
    imageUrl: "https://img.clerk.com/avatar.png",
    primaryEmailAddressId: "email_primary",
    emailAddresses: [
      { id: "email_primary", emailAddress: "alice@example.com" },
      { id: "email_secondary", emailAddress: "alerts@example.com" },
    ],
    ...overrides,
  };
}

describe("createAccountProfile", () => {
  test("maps a full Clerk user into the account profile model", () => {
    const profile = createAccountProfile(makeUser(), {
      sessionId: "sess_123",
      orgId: "org_123",
    });

    expect(profile).toEqual({
      id: "user_123",
      displayName: "Alice Ng",
      username: "alice",
      imageUrl: "https://img.clerk.com/avatar.png",
      primaryEmailAddress: "alice@example.com",
      emailAddresses: [
        {
          id: "email_primary",
          emailAddress: "alice@example.com",
          isPrimary: true,
        },
        {
          id: "email_secondary",
          emailAddress: "alerts@example.com",
          isPrimary: false,
        },
      ],
      sessionId: "sess_123",
      orgId: "org_123",
    });
  });

  test("falls back to the primary email when name fields are unavailable", () => {
    const profile = createAccountProfile(
      makeUser({
        username: null,
        firstName: null,
        lastName: null,
      }),
      {
        sessionId: "sess_456",
        orgId: null,
      }
    );

    expect(profile.displayName).toBe("alice@example.com");
    expect(profile.username).toBeNull();
    expect(profile.primaryEmailAddress).toBe("alice@example.com");
    expect(profile.orgId).toBeNull();
  });

  test("marks the configured primary email when it is not the first address", () => {
    const profile = createAccountProfile(
      makeUser({
        primaryEmailAddressId: "email_secondary",
        emailAddresses: [
          { id: "email_primary", emailAddress: "alice@example.com" },
          { id: "email_secondary", emailAddress: "team@example.com" },
          { id: "email_tertiary", emailAddress: "logs@example.com" },
        ],
      }),
      {
        sessionId: "sess_789",
        orgId: "org_789",
      }
    );

    expect(profile.primaryEmailAddress).toBe("team@example.com");
    expect(profile.emailAddresses).toEqual([
      {
        id: "email_primary",
        emailAddress: "alice@example.com",
        isPrimary: false,
      },
      {
        id: "email_secondary",
        emailAddress: "team@example.com",
        isPrimary: true,
      },
      {
        id: "email_tertiary",
        emailAddress: "logs@example.com",
        isPrimary: false,
      },
    ]);
  });
});
