import rubric from "@/lib/rubric.json";
import { DEPLOYMENT, addressUrl } from "@/lib/deployment";

export const metadata = { title: "The judge prompt · Keepalive" };

export default function RubricPage() {
  return (
    <section style={{ padding: "40px 0 72px" }}>
      <div className="wrap stack" style={{ gap: 24, maxWidth: 900 }}>
        <div className="section-head" style={{ marginBottom: 0 }}>
          <span className="label">The rubric</span>
          <h1 style={{ fontSize: "clamp(30px,4.2vw,44px)" }}>The exact prompt every validator runs.</h1>
          <p className="lede">
            This is the constant in the deployed contract, generated from its source, not retyped. The leader and every validator fill it
            in themselves, fetch each link themselves, and agree only when their verdict labels match. The reason sentence is never
            compared.
          </p>
        </div>
        <div className="panel stack">
          <span className="label">How each link is filled in</span>
          <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13 }}>
            {rubric.evidenceLine}
          </pre>
          <p className="hint">
            Up to four links: the report&apos;s three and the repo&apos;s commits for the window. Each page is cut to{" "}
            {rubric.pageChars.toLocaleString("en-US")} characters. Every value written by the builder or fetched from the web has its angle
            brackets replaced, so no text can close its own block and open a forged one.
          </p>
        </div>
        <pre
          className="panel mono"
          style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13, lineHeight: 1.6, color: "var(--body)" }}
        >
          {rubric.check.replace(/\{\{/g, "{").replace(/\}\}/g, "}")}
        </pre>
        <p className="hint">
          sha256 <span className="mono">{rubric.sha256}</span> · contract{" "}
          {DEPLOYMENT.keepalive ? (
            <a className="mono" href={addressUrl(DEPLOYMENT.keepalive)} target="_blank" rel="noreferrer">
              {DEPLOYMENT.keepalive}
            </a>
          ) : (
            "not deployed"
          )}
        </p>
      </div>
    </section>
  );
}
