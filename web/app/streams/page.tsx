import { Explore } from "@/components/Explore";
import { PulseLegend } from "@/components/Pulse";
import { attempt, listStreams } from "@/lib/read";

export const dynamic = "force-dynamic";

export const metadata = { title: "Streams · Keepalive" };

export default async function Streams() {
  const read = await attempt(() => listStreams("", 0, 50));
  return (
    <section style={{ padding: "48px 0 72px" }}>
      <div className="wrap stack" style={{ gap: 24 }}>
        <div className="section-head" style={{ marginBottom: 0 }}>
          <span className="label">Explore</span>
          <h1 style={{ fontSize: "clamp(34px,4.6vw,48px)" }}>Every stream, and how its periods went.</h1>
          <p className="lede">Reading needs no wallet. Each strip is one stream&apos;s last twelve periods, oldest on the left.</p>
        </div>
        <PulseLegend cells="AQOULRPC" />
        {read.ok ? (
          <Explore rows={read.data.rows} />
        ) : (
          <div className="banner">
            <strong>The chain could not be read just now.</strong> {read.error}
          </div>
        )}
      </div>
    </section>
  );
}
