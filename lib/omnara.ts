// Omnara agent-run logging. When OMNARA_API_KEY is set, each agent step is
// sent to Omnara so you can watch/monitor runs live (and from mobile).
// No key -> console log, so local dev still shows the agent's steps.

export async function logAgentRun(agent: string, step: string): Promise<void> {
  const key = process.env.OMNARA_API_KEY;
  const line = `[agent:${agent}] ${step}`;
  if (!key) {
    console.log(line);
    return;
  }
  try {
    await fetch("https://agent.omnara.com/api/v1/messages/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ agent_type: "footfall-ai", content: line, requires_user_input: false }),
    });
  } catch {
    console.log(line);
  }
}
