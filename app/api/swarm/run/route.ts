import { NextResponse } from "next/server";
import {
  getSwarm, setSwarm, makeId, MODEL_MAP, ROLE_PROMPTS,
  type SwarmAgent, type SwarmRun,
} from "@/lib/swarm";
import { PROXY_BASE, PROXY_TOKEN, HERMES_MODEL } from "@/lib/hermesClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function callAgent(
  role: string,
  model: string,
  prompt: string,
  orchestratorPrompt: string,
): Promise<string> {
  const system = ROLE_PROMPTS[role] ?? `You are a ${role}. Complete the task concisely.`;
  const fullModel = MODEL_MAP[model] ?? HERMES_MODEL;

  try {
    const res = await fetch(`${PROXY_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PROXY_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: fullModel,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Swarm task: ${orchestratorPrompt}\n\nYour specific sub-task as ${role}: ${prompt}\n\nBe concise — max 3 short paragraphs.`,
          },
        ],
        max_tokens: 512,
        stream: false,
      }),
    });
    if (!res.ok) return `⚠ HTTP ${res.status}`;
    const j = await res.json() as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content?.trim() ?? "⚠ No output";
  } catch (e) {
    return `⚠ ${String(e)}`;
  }
}

function subTaskFor(role: string, mainPrompt: string): string {
  const map: Record<string, string> = {
    researcher:       `Research and summarise key background on: ${mainPrompt}`,
    architect:        `Design the high-level architecture for: ${mainPrompt}`,
    coder:            `Write the core implementation code for: ${mainPrompt}`,
    "frontend-dev":   `Build the UI components for: ${mainPrompt}`,
    reviewer:         `Review the approach and flag issues for: ${mainPrompt}`,
    "seo-specialist": `Optimise content for SEO for: ${mainPrompt}`,
    writer:           `Write clear documentation for: ${mainPrompt}`,
  };
  return map[role] ?? `Complete your part of: ${mainPrompt}`;
}

export async function POST(req: Request) {
  const { prompt } = (await req.json().catch(() => ({}))) as { prompt?: string };
  if (!prompt?.trim()) return NextResponse.json({ error: "missing prompt" }, { status: 400 });

  const swarm = await getSwarm();

  // Reset statuses + create run record
  const runId = makeId();
  const run: SwarmRun = {
    id: runId,
    prompt: prompt.trim(),
    startedAt: Date.now(),
    status: "running",
    events: [],
  };

  const agents: SwarmAgent[] = swarm.agents.map((a) => ({ ...a, status: "idle", output: "" }));
  await setSwarm({ agents, activeRun: run });

  // Dispatch agents — respect topology
  const { topology } = swarm;
  let agentsCopy = [...agents];

  const dispatchAgent = async (agent: SwarmAgent) => {
    // Mark running
    agentsCopy = agentsCopy.map((a) => a.id === agent.id ? { ...a, status: "running" } : a);
    await setSwarm({ agents: agentsCopy });

    const output = await callAgent(agent.role, agent.model, subTaskFor(agent.role, prompt.trim()), prompt.trim());

    // Mark done + store output
    agentsCopy = agentsCopy.map((a) => a.id === agent.id ? { ...a, status: "done", output } : a);

    run.events.push({ agentId: agent.id, role: agent.role, text: output, ts: Date.now() });
    await setSwarm({ agents: agentsCopy, activeRun: run });
    return output;
  };

  // Run in background (don't await — client polls /api/swarm for status updates)
  void (async () => {
    try {
      if (topology === "sequential") {
        for (const a of agentsCopy) await dispatchAgent(a);
      } else {
        // hierarchical & flat both dispatch concurrently (each agent sees the full prompt)
        await Promise.all(agentsCopy.map((a) => dispatchAgent(a)));
      }
      run.status = "done";
      run.doneAt = Date.now();
    } catch (e) {
      run.status = "error";
      run.events.push({ agentId: "orchestrator", role: "system", text: `⚠ ${String(e)}`, ts: Date.now() });
    } finally {
      await setSwarm({ agents: agentsCopy, activeRun: run });
    }
  })();

  return NextResponse.json({ ok: true, runId });
}
