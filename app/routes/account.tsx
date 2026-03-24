import { clerkClient, getAuth } from "@clerk/react-router/server";
import { redirect } from "react-router";

import type { Route } from "./+types/account";
import { createAccountProfile } from "../lib/account-profile";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Account | Nestor" },
    { name: "description", content: "View your Nestor account profile." },
  ];
}

export async function loader(args: Route.LoaderArgs) {
  const { isAuthenticated, userId, sessionId, orgId } = await getAuth(args);

  if (!isAuthenticated || !userId) {
    const search = new URLSearchParams({
      redirect_url: args.request.url,
    });
    throw redirect(`/sign-in?${search.toString()}`);
  }

  const user = await clerkClient(args).users.getUser(userId);

  return {
    profile: createAccountProfile(user, {
      sessionId: sessionId ?? null,
      orgId: orgId ?? null,
    }),
  };
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-sm text-gray-900 dark:text-gray-100">
        {value ?? "Unavailable"}
      </div>
    </div>
  );
}

export default function AccountPage({ loaderData }: Route.ComponentProps) {
  const { profile } = loaderData;
  const secondaryEmails = profile.emailAddresses.filter((email) => !email.isPrimary);

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm">
          <a href="/" className="text-blue-600 hover:underline">
            Back to chat
          </a>
          <span className="text-gray-300">/</span>
          <a href="/settings" className="text-blue-600 hover:underline">
            Settings
          </a>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-8 py-8 dark:border-gray-800">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <img
                src={profile.imageUrl}
                alt={profile.displayName}
                className="h-20 w-20 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-gray-700"
              />
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
                  Account
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-gray-950 dark:text-gray-50">
                  {profile.displayName}
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                  {profile.username
                    ? `@${profile.username}`
                    : "No username configured"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section>
              <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-50">
                Contact
              </h2>
              <div className="mt-4 grid gap-4">
                <Field label="Primary email" value={profile.primaryEmailAddress} />
                <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
                    Other email addresses
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-gray-900 dark:text-gray-100">
                    {secondaryEmails.length > 0 ? (
                      secondaryEmails.map((email) => (
                        <div key={email.id}>{email.emailAddress}</div>
                      ))
                    ) : (
                      <div className="text-gray-500">No additional email addresses</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-50">
                Session
              </h2>
              <div className="mt-4 grid gap-4">
                <Field label="User ID" value={profile.id} />
                <Field label="Session ID" value={profile.sessionId} />
                <Field label="Organization ID" value={profile.orgId} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
