import Link from "next/link";

import { CHAIN_HEX, DEPLOYMENT, NETWORK_NAME, REPO_URL, addressUrl } from "@/lib/deployment";
import { Glyph } from "./Pulse";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap grid grid-3" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="wordmark" style={{ fontSize: 14 }}>
            <Glyph size={13} />
            KEEPALIVE
          </span>
          <span>Funding that stops when the work stops.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">Contract</span>
          {DEPLOYMENT.keepalive ? (
            <a className="mono" href={addressUrl(DEPLOYMENT.keepalive)} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>
              {DEPLOYMENT.keepalive}
            </a>
          ) : (
            <span>Not deployed from this copy.</span>
          )}
          <span className="mono" style={{ fontSize: 12 }}>
            {NETWORK_NAME} · chain {DEPLOYMENT.chainId} ({"0x" + CHAIN_HEX.slice(2).toUpperCase()})
          </span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">More</span>
          <Link href="/rubric">The exact judge prompt</Link>
          <Link href="/streams">Every stream</Link>
          {REPO_URL ? (
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
