import Link from "next/link";

export default function NotFound() {
  return (
    <section className="wrap stack" style={{ padding: "80px 0", gap: 16, maxWidth: 560 }}>
      <span className="label">Not found</span>
      <h1 style={{ fontSize: 40 }}>No stream here.</h1>
      <p className="body">That stream does not exist on this deployment.</p>
      <Link href="/streams" className="btn" style={{ justifySelf: "start" }}>
        Every stream
      </Link>
    </section>
  );
}
