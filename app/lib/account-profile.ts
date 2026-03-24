import type { EmailAddress, User } from "@clerk/backend";

export type ClerkAccountProfileEmail = Pick<EmailAddress, "id" | "emailAddress">;

export type ClerkAccountProfileUser = Pick<
  User,
  | "id"
  | "username"
  | "firstName"
  | "lastName"
  | "imageUrl"
  | "primaryEmailAddressId"
  | "emailAddresses"
>;

export type AccountProfile = {
  id: string;
  displayName: string;
  username: string | null;
  imageUrl: string;
  primaryEmailAddress: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    isPrimary: boolean;
  }>;
  sessionId: string | null;
  orgId: string | null;
};

export function createAccountProfile(
  user: ClerkAccountProfileUser,
  auth: { sessionId: string | null; orgId: string | null }
): AccountProfile {
  const emailAddresses = user.emailAddresses.map((email) => ({
    id: email.id,
    emailAddress: email.emailAddress,
    isPrimary: email.id === user.primaryEmailAddressId,
  }));

  const primaryEmail = emailAddresses.find((email) => email.isPrimary) ?? null;
  const displayName = buildDisplayName(user, primaryEmail?.emailAddress ?? null);

  return {
    id: user.id,
    displayName,
    username: user.username,
    imageUrl: user.imageUrl,
    primaryEmailAddress: primaryEmail?.emailAddress ?? null,
    emailAddresses,
    sessionId: auth.sessionId,
    orgId: auth.orgId,
  };
}

function buildDisplayName(
  user: Pick<ClerkAccountProfileUser, "id" | "username" | "firstName" | "lastName">,
  primaryEmailAddress: string | null
) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  return user.username ?? primaryEmailAddress ?? user.id;
}
