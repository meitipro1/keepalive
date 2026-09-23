/**
 * The source and link rules, as the contract applies them, so the forms can
 * say "source match" before anything is signed. The contract is the authority:
 * these functions are a copy of _bare, _normalise_source, _matches and
 * _github_repo in contracts/keepalive.py, and web/scripts/sources.test.mjs runs
 * the same cases the Python tests do.
 */

export const SHARED_HOSTS = new Set([
  "github.com",
  "gitlab.com",
  "codeberg.org",
  "bitbucket.org",
  "gist.github.com",
  "raw.githubusercontent.com",
  "medium.com",
  "mirror.xyz",
  "paragraph.xyz",
  "dev.to",
  "hashnode.com",
  "substack.com",
  "youtube.com",
  "x.com",
  "twitter.com",
  "npmjs.com",
  "pypi.org",
  "crates.io",
  "huggingface.co",
  "arxiv.org",
]);

const URL_CHARS = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/;
const NAME = /^[A-Za-z0-9\-._]+$/;

export function bare(url: string): string {
  let text = url.trim().toLowerCase();
  for (const scheme of ["https://", "http://"]) {
    if (text.startsWith(scheme)) {
      text = text.slice(scheme.length);
      break;
    }
  }
  if (text.startsWith("www.")) text = text.slice(4);
  return text;
}

/** The prefix the contract will store, or a sentence saying why it will refuse it. */
export function normaliseSource(raw: string): { ok: true; prefix: string } | { ok: false; why: string } {
  const text = raw.trim();
  if (!text) return { ok: false, why: "Empty." };
  if (text.length > 120) return { ok: false, why: "At most 120 characters." };
  if (!URL_CHARS.test(text)) return { ok: false, why: "It has a character a URL cannot have." };
  const prefix = bare(text);
  const host = prefix.split("/")[0];
  const rest = prefix.slice(host.length).replace(/^\/+|\/+$/g, "");
  if (!host.includes(".") || host.startsWith(".") || host.endsWith(".") || host.includes(":") || host.includes("@")) {
    return { ok: false, why: "Start with a host, such as github.com/you/." };
  }
  if (SHARED_HOSTS.has(host) && rest === "") {
    return { ok: false, why: `${host} is shared by everyone. Name your account or repo, like ${host}/you/.` };
  }
  return { ok: true, prefix };
}

export function matches(linkBare: string, prefix: string): boolean {
  if (!linkBare.startsWith(prefix)) return false;
  if (linkBare.length === prefix.length || prefix.endsWith("/")) return true;
  return "/?#".includes(linkBare[prefix.length]);
}

/** What report() does to a link, or why it refuses it. */
export function checkLink(raw: string, prefixes: string[]): { ok: true; link: string } | { ok: false; why: string } {
  const text = raw.trim();
  if (!text) return { ok: false, why: "Empty." };
  if (text.length > 300) return { ok: false, why: "At most 300 characters." };
  if (!URL_CHARS.test(text)) return { ok: false, why: "It has a character a URL cannot have." };
  const link = /^https?:\/\//i.test(text) ? text : "https://" + text;
  const b = bare(link);
  if (!prefixes.some((p) => matches(b, p))) {
    return { ok: false, why: "It does not start with one of this stream's sources." };
  }
  return { ok: true, link };
}

function repoName(part: string): string {
  let name = part.split("#")[0].split("?")[0];
  if (name.endsWith(".git")) name = name.slice(0, -4);
  if (!name || name === "." || name === ".." || !NAME.test(name)) return "";
  return name;
}

export function githubRepo(sources: string[], links: string[]): string {
  for (const source of sources) {
    if (!source.startsWith("github.com/")) continue;
    const parts = source.slice("github.com/".length).split("/");
    const owner = repoName(parts[0] ?? "");
    if (!owner) continue;
    const repo = parts.length > 1 ? repoName(parts[1]) : "";
    if (repo) return `${owner}/${repo}`;
    for (const link of links) {
      const b = bare(link);
      if (!b.startsWith(`github.com/${owner.toLowerCase()}/`)) continue;
      const tail = b.slice("github.com/".length).split("/");
      if (tail.length > 1) {
        const found = repoName(tail[1]);
        if (found) return `${owner}/${found}`;
      }
    }
  }
  return "";
}

function iso(seconds: number): string {
  return new Date(seconds * 1000).toISOString().replace(".000Z", "Z");
}

/** The commits API link the contract will add to the check for this window, or "". */
export function autolink(sources: string[], links: string[], start: number, end: number): string {
  const repo = githubRepo(sources, links);
  if (!repo) return "";
  return `https://api.github.com/repos/${repo}/commits?since=${iso(start)}&until=${iso(end)}&per_page=100`;
}
