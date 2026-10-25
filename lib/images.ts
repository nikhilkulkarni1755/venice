// Dish illustrations via the OpenAI image API (server-only). The prompt asks for a tiny "AI generated"
// caption in the image's corner; small models (gpt-image-1-mini) ignore it, the 2.5 models render it. Returns a JPEG data URI, or null
// when OPENAI_API_KEY is unset or on any failure, so the poster falls back to plain cards.
export async function dishImage(item: string, dark: boolean): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
        prompt: `Appetizing close-up food photograph of ${item} from a bakery, centered on a plain ${dark ? "dark" : "soft light"} background, natural light, no logos, no people. The only text in the image is a tiny, left-aligned caption "AI generated" in small plain ${dark ? "light gray" : "dark gray"} type, in the bottom-left corner, about 8% in from the left and bottom edges.`,
        size: "1024x1024",
        quality: "low",
        output_format: "jpeg",
        output_compression: 70,
      }),
    });
    const b64 = (await res.json())?.data?.[0]?.b64_json;
    return b64 ? `data:image/jpeg;base64,${b64}` : null;
  } catch {
    return null;
  }
}
