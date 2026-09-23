import { currentPeriod, getStream } from "@/lib/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One stream and its current period, for a page that refreshes after a write. Read only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = Number(id);
  if (!Number.isInteger(sid) || sid < 1) return Response.json({ error: "bad id" }, { status: 400 });
  try {
    const [stream, current] = await Promise.all([getStream(sid), currentPeriod(sid)]);
    return Response.json({ stream, current }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: String((error as Error).message).slice(0, 240) }, { status: 502 });
  }
}
