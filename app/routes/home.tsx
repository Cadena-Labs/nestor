import { useEffect } from "react";
import { redirect, useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { getAuth } from "@clerk/react-router/server";
import { useAuth } from "@clerk/react-router";
import { ChatView } from "../components/chat-view";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Nestor" },
    { name: "description", content: "AI-powered networking assistant for Palo Alto firewalls" },
  ];
}

export async function loader(args: Route.LoaderArgs) {
  const { isAuthenticated } = await getAuth(args);
  if (!isAuthenticated) {
    const search = new URLSearchParams({
      redirect_url: args.request.url,
    });
    throw redirect(`/sign-in?${search.toString()}`);
  }
  return null;
}

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  // Client-only: if user signs out while on this page (loader already ran when they were signed in).
  // Do not use <Navigate> on initial render — SSR uses StaticRouter and it is a no-op + warning loop.
  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    const search = new URLSearchParams({
      redirect_url: typeof window !== "undefined" ? window.location.href : "/",
    });
    void navigate(`/sign-in?${search.toString()}`, { replace: true });
  }, [isLoaded, isSignedIn, navigate]);
  // While Clerk is loading, <Show> renders null for both branches (see @clerk/react Show),
  // which left only the dark page background — show explicit UI instead.
  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-300">Loading…</p>
      </main>
    );
  }
  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-300">Redirecting to sign in…</p>
      </main>
    );
  }
  return <ChatView />;
}
