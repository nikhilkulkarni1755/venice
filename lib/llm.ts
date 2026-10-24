import Anthropic from "@anthropic-ai/sdk";

// Shared structured-JSON helper. Returns parsed JSON from Claude, or `fallback`
// when there's no key or anything goes wrong. Keeps generators resilient.
export async function llmJson<T>(system: string, user: string, fallback: T): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
      max_tokens: 1800,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = resp.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return json as T;
  } catch {
    return fallback;
  }
}
