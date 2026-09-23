"use client";

export type Readability = { readable: boolean; chars?: number; dates?: string[]; note: string; measured?: boolean };

const cache = new Map<string, Readability>();

/** Ask /api/readable about one URL, once per URL per page load. */
export async function testReadable(url: string): Promise<Readability> {
  const key = url.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const response = await fetch("/api/readable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const body = (await response.json()) as Readability;
    if (response.status !== 429) cache.set(key, body);
    return body;
  } catch {
    return { readable: false, note: "The test could not run. It is only a hint; you can still continue." };
  }
}
