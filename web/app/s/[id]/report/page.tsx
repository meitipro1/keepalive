import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportForm } from "@/components/ReportForm";
import { StatusChips } from "@/components/Seal";
import { day, when } from "@/lib/format";
import { attempt, currentPeriod, getStream } from "@/lib/read";

export const dynamic = "force-dynamic";

export const metadata = { title: "Builder check-in · Keepalive" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = Number(id);
  if (!Number.isInteger(sid) || sid < 1) notFound();
  const [streamRead, currentRead] = await Promise.all([attempt(() => getStream(sid)), attempt(() => currentPeriod(sid))]);
  if (!streamRead.ok || !currentRead.ok) {
    const error = !streamRead.ok ? streamRead.error : !currentRead.ok ? currentRead.error : "";
    if (/unknown stream/.test(error)) notFound();
    return (
      <section className="wrap" style={{ padding: "48px 0" }}>
        <div className="banner">
          <strong>This stream could not be read just now.</strong> {error}
        </div>
      </section>
    );
  }
  const stream = streamRead.data;
  const current = currentRead.data;
  return (
    <section style={{ padding: "40px 0 72px" }}>
      <div className="wrap stack" style={{ gap: 24 }}>
        <div className="stack" style={{ gap: 8 }}>
          <Link href={`/s/${stream.sid}`} className="hint">
            ← {stream.title}
          </Link>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h1 style={{ fontSize: "clamp(28px,3.8vw,40px)" }}>
              Period {current.number} <span className="muted">· {stream.title}</span>
            </h1>
            <StatusChips stream={stream} />
          </div>
          <span className="hint">
            {stream.demo ? `${when(current.start, true)} to ${when(current.end, true)}` : `${day(current.start, true)} to ${day(current.end - 1, true)}`}
          </span>
        </div>
        <ReportForm stream={stream} current={current} />
      </div>
    </section>
  );
}
