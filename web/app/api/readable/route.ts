import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The readability test for sources and evidence links. A hint, never the
 * verdict: it fetches the page from this server, turns it into text the way a
 * text-mode render roughly does, cuts it to 5,000 characters as the judge does,
 * and says whether anything readable and dated is in there. Free, and it
 * touches no chain.
 *
 * What it knows beyond that comes from eval/web_probe.md, measured through
 * consensus on Studionet: X posts do not load for validators; GitHub pull
 * request and release pages read, but print no dates in text mode; the commits
 * API is read and condensed with every date; raw changelogs and dated blog
 * posts read well.
 *
 * It fetches URLs a visitor typed, so it is fenced: https only, public
 * addresses only (checked after DNS), no redirects followed to anywhere else,
 * ten seconds, two megabytes, and a per-IP limit held in memory.
 */

const PAGE_CHARS = 5000;
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;
const PER_IP_MS = 1500;
const lastByIp = new Map<string, number>();

const DATE = new RegExp(
  String.raw`\b(?:\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}|\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4})`,
  "g",
);

const MEASURED: { test: RegExp; readable: boolean; note: string }[] = [
  {
    test: /^(www\.)?(x|twitter)\.com\//i,
    readable: false,
    note: "Not readable. Measured on Studionet: validators could not load an X post at all. Link the work itself instead.",
  },
  {
    test: /^(www\.)?(discord\.com|discord\.gg|t\.me|telegram\.me|figma\.com|docs\.google\.com|drive\.google\.com|notion\.so)\//i,
    readable: false,
    note: "Not readable. This kind of page is private, behind a login, or has no text for validators.",
  },
];

function bareOf(url: string): string {
  return url.replace(/^https?:\/\//i, "");
}

function privateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const low = ip.toLowerCase();
    return low === "::1" || low.startsWith("fc") || low.startsWith("fd") || low.startsWith("fe80") || low.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function publicHost(hostname: string): Promise<boolean> {
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
  if (isIP(hostname)) return !privateAddress(hostname);
  try {
    const found = await lookup(hostname, { all: true });
    return found.length > 0 && found.every((one) => !privateAddress(one.address));
  } catch {
    return false;
  }
}

function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** The commits API condensed the way the contract condenses it: one line per commit. */
function commitsDigest(body: string): string {
  try {
    const rows = JSON.parse(body);
    if (!Array.isArray(rows)) return `GitHub API answered: ${String(rows?.message ?? "")}`;
    if (rows.length === 0) return "The repository has no commits between these two dates.";
    return [
      `${rows.length} commits in the window, newest first:`,
      ...rows.map((row) => {
        const commit = row?.commit ?? {};
        const committed = String(commit?.committer?.date ?? commit?.author?.date ?? "");
        return `${committed} ${String(commit?.author?.name ?? "")}: ${String(commit?.message ?? "").split("\n")[0].slice(0, 160)}`;
      }),
    ].join("\n");
  } catch {
    return body;
  }
}

async function read(url: string): Promise<{ status: number; text: string; type: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KeepaliveReadabilityTest/1.0)",
        Accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.5",
      },
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      return { status: response.status, text: "", type: "redirect" };
    }
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        size += value.length;
        chunks.push(value);
        if (size > MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    }
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return { status: response.status, text: raw, type: response.headers.get("content-type") ?? "" };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const now = Date.now();
  if ((lastByIp.get(ip) ?? 0) + PER_IP_MS > now) {
    return Response.json({ readable: false, note: "One test at a time. Try again in a second." }, { status: 429 });
  }
  lastByIp.set(ip, now);
  if (lastByIp.size > 5000) lastByIp.clear();

  const body = await request.json().catch(() => ({}));
  const raw = String((body as { url?: unknown })?.url ?? "").trim();
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ readable: false, note: "That is not a URL." }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) {
    return Response.json({ readable: false, note: "Only plain https pages can be tested." }, { status: 400 });
  }

  for (const rule of MEASURED) {
    if (rule.test.test(bareOf(url))) {
      return Response.json({ readable: rule.readable, chars: 0, dates: [], note: rule.note, measured: true });
    }
  }
  if (!(await publicHost(parsed.hostname))) {
    return Response.json({ readable: false, note: "That host is not a public address." }, { status: 400 });
  }

  try {
    const page = await read(parsed.toString());
    if (page.type === "redirect") {
      return Response.json({ readable: false, chars: 0, dates: [], note: "The page redirects. Link the page it ends on." });
    }
    if (page.status >= 400) {
      return Response.json({ readable: false, chars: 0, dates: [], note: `The page answered HTTP ${page.status}. Validators would read an error.` });
    }
    const isApi = parsed.hostname === "api.github.com";
    const text = (isApi ? commitsDigest(page.text) : page.type.includes("html") ? toText(page.text) : page.text).slice(0, PAGE_CHARS);
    const dates = Array.from(new Set(text.match(DATE) ?? [])).slice(0, 6);
    const login = /sign in to (continue|view)|log in to (continue|view)|you must be logged in|enable javascript to/i.test(text);
    const readable = text.trim().length >= 200 && !login;
    let note = readable
      ? dates.length
        ? `Readable, ${text.length.toLocaleString("en-US")} characters, dates found.`
        : `Readable, ${text.length.toLocaleString("en-US")} characters, but no absolute dates in the first 5,000.`
      : login
        ? "Asks for a login. Validators would read a login wall."
        : "Almost no text. Validators would read an empty page.";
    if (readable && /^github\.com\/[^/]+\/[^/]+\/(pull|releases|issues)\//i.test(bareOf(url))) {
      note +=
        " Measured on Studionet: GitHub pull request and release pages print no dates in text mode, so the repo autolink or a dated changelog carries the dates.";
    }
    return Response.json({ readable, chars: text.length, dates, note });
  } catch (error) {
    const aborted = (error as Error)?.name === "AbortError";
    return Response.json({
      readable: false,
      chars: 0,
      dates: [],
      note: aborted ? "The page took more than ten seconds. Validators may time out on it too." : "The page could not be fetched.",
    });
  }
}
