// Deploy a generated static site to Freestyle (https://docs.freestyle.sh).
// Freestyle serverless deployments run JS/TS web apps; we wrap the generated
// HTML in a tiny Hono server and deploy it. Returns the live *.style.dev URL.
// No key -> returns null and the caller falls back to serving via our own app.

export async function deployToFreestyle(subdomain: string, html: string): Promise<string | null> {
  const key = process.env.FREESTYLE_API_KEY;
  if (!key) return null;
  try {
    const files: Record<string, { content: string }> = {
      "package.json": {
        content: JSON.stringify({
          name: subdomain,
          type: "module",
          dependencies: { hono: "^4.6.0", "@hono/node-server": "^1.13.0" },
        }),
      },
      "index.js": {
        content: [
          `import { serve } from "@hono/node-server";`,
          `import { Hono } from "hono";`,
          `const app = new Hono();`,
          `const html = ${JSON.stringify(html)};`,
          `app.get("/", (c) => c.html(html));`,
          `serve({ fetch: app.fetch, port: process.env.PORT || 3000 });`,
        ].join("\n"),
      },
    };
    const res = await fetch("https://api.freestyle.sh/web/v1/web/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        files,
        config: { domains: [`${subdomain}.style.dev`], build: true, entrypoint: "index.js" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const domain = data?.domains?.[0] || `${subdomain}.style.dev`;
    return `https://${domain}`;
  } catch {
    return null;
  }
}
