/**
 * Reads a JSON list of cases on stdin and prints what web/lib/sources.ts says
 * about each, so tests/test_web_parity.py can hold the site's copy of the
 * source and link rules to the contract's. Run with Node 23.6 or later, which
 * strips the types itself.
 */

import { autolink, checkLink, normaliseSource } from "../lib/sources.ts";

type Case =
  | { kind: "source"; raw: string }
  | { kind: "link"; raw: string; prefixes: string[] }
  | { kind: "autolink"; sources: string[]; links: string[]; start: number; end: number };

const chunks: Buffer[] = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const cases = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Case[];
  const out = cases.map((one) => {
    if (one.kind === "source") {
      const result = normaliseSource(one.raw);
      return result.ok ? { ok: true, value: result.prefix } : { ok: false };
    }
    if (one.kind === "link") {
      const result = checkLink(one.raw, one.prefixes);
      return result.ok ? { ok: true, value: result.link } : { ok: false };
    }
    return { ok: true, value: autolink(one.sources, one.links, one.start, one.end) };
  });
  process.stdout.write(JSON.stringify(out));
});
