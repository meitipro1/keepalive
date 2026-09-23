import { getPortfolio, getPosition } from "@/lib/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ?addr=0x... for the whole portfolio, &sid=N for one position. Read only. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const addr = url.searchParams.get("addr") ?? "";
  const sid = Number(url.searchParams.get("sid") ?? "0");
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return Response.json({ error: "bad address" }, { status: 400 });
  if (!Number.isInteger(sid) || sid < 0) return Response.json({ error: "bad id" }, { status: 400 });
  try {
    const body = sid === 0 ? await getPortfolio(addr) : await getPosition(sid, addr);
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: String((error as Error).message).slice(0, 240) }, { status: 502 });
  }
}
