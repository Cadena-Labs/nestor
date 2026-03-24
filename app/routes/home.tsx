import type { Route } from "./+types/home";
import { Show, RedirectToSignIn } from "@clerk/react-router";
import { ChatView } from "../components/chat-view";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Nestor" },
    { name: "description", content: "AI-powered networking assistant for Palo Alto firewalls" },
  ];
}

export default function Home() {
  return (
    <>
      <Show when="signed-in">
        <ChatView />
      </Show>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </>
  );
}
