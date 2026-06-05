import { notFound } from "next/navigation";
import { getAgent, AGENTS } from "@/lib/agents";
import { ChatView } from "@/components/ChatView";
import HermesView from "@/components/HermesView";

export function generateStaticParams() {
  return AGENTS.map((a) => ({ slug: a.slug }));
}

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();
  if (slug === "hermes") return <HermesView />;
  return <ChatView agent={agent} />;
}
