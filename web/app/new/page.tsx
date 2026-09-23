import { NewStream } from "@/components/NewStream";

export const metadata = { title: "Open a stream · Keepalive" };

export default function NewPage() {
  return (
    <section style={{ padding: "40px 0 72px" }}>
      <div className="wrap stack" style={{ gap: 24 }}>
        <div className="section-head" style={{ marginBottom: 0 }}>
          <span className="label">Open a stream</span>
          <h1 style={{ fontSize: "clamp(30px,4.2vw,44px)" }}>Four short steps, each one decision.</h1>
        </div>
        <NewStream />
      </div>
    </section>
  );
}
