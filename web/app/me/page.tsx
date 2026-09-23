import { Portfolio } from "@/components/Portfolio";

export const metadata = { title: "Your portfolio · Keepalive" };

export default function MePage() {
  return (
    <section style={{ padding: "40px 0 72px" }}>
      <div className="wrap stack" style={{ gap: 24 }}>
        <div className="section-head" style={{ marginBottom: 0 }}>
          <span className="label">Portfolio</span>
          <h1 style={{ fontSize: "clamp(30px,4.2vw,44px)" }}>Every stream you back.</h1>
        </div>
        <Portfolio />
      </div>
    </section>
  );
}
