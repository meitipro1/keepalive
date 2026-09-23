/** Formatting shared by server and client. No chain imports. */

export const WEI = 10n ** 18n;

/** Wei as GEN, with thousands separators and at most `digits` decimals, trailing zeros dropped. */
export function gen(wei: string | bigint | number, digits = 2): string {
  let value: bigint;
  try {
    value = BigInt(typeof wei === "number" ? Math.trunc(wei) : wei);
  } catch {
    return "0";
  }
  const negative = value < 0n;
  if (negative) value = -value;
  const whole = value / WEI;
  let fraction = "";
  if (digits > 0) {
    const scale = 10n ** BigInt(digits);
    const rest = ((value % WEI) * scale) / WEI;
    fraction = rest.toString().padStart(digits, "0").replace(/0+$/, "");
  }
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (negative ? "-" : "") + grouped + (fraction ? "." + fraction : "");
}

/** A GEN amount typed by a person, as wei. Throws on anything that is not a plain positive number. */
export function parseGen(text: string): bigint {
  const clean = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,18})?$/.test(clean)) throw new Error("Enter an amount in GEN, like 150 or 12.5.");
  const [whole, fraction = ""] = clean.split(".");
  return BigInt(whole) * WEI + BigInt((fraction + "0".repeat(18)).slice(0, 18));
}

export function short(address: string, head = 6, tail = 4): string {
  if (!address) return "";
  return address.length <= head + tail + 1 ? address : `${address.slice(0, head)}...${address.slice(-tail)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A unix time as "Sep 15" or "Sep 15, 2026" in UTC, which is the clock the contract uses. */
export function day(seconds: number, withYear = false): string {
  const d = new Date(seconds * 1000);
  const text = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withYear ? `${text}, ${d.getUTCFullYear()}` : text;
}

/** "Sep 15, 14:20 UTC", for short periods where the hour matters. */
export function stamp(seconds: number): string {
  const d = new Date(seconds * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC`;
}

/** The right precision for a moment in a stream: the hour for DEMO streams, the day otherwise. */
export function when(seconds: number, demo: boolean): string {
  return demo ? stamp(seconds) : day(seconds, true);
}

/** A span of seconds in words: "14 days", "10 minutes", "3 days". */
export function span(seconds: number): string {
  if (seconds % 86400 === 0) {
    const n = seconds / 86400;
    return `${n} day${n === 1 ? "" : "s"}`;
  }
  if (seconds % 3600 === 0) {
    const n = seconds / 3600;
    return `${n} hour${n === 1 ? "" : "s"}`;
  }
  const n = Math.round(seconds / 60);
  return `${n} minute${n === 1 ? "" : "s"}`;
}

/** Time left until `target`, from `now`, in the largest sensible unit. */
export function left(target: number, now: number): string {
  const s = Math.max(0, target - now);
  if (s >= 2 * 86400) return `${Math.floor(s / 86400)} days`;
  if (s >= 2 * 3600) return `${Math.floor(s / 3600)} hours`;
  if (s >= 120) return `${Math.floor(s / 60)} minutes`;
  return `${s} seconds`;
}

export function periodLabel(periodSeconds: number): string {
  return periodSeconds < 86400 ? `${Math.round(periodSeconds / 60)} min` : `${periodSeconds / 86400} day`;
}

export function verdictWords(v: string): string {
  return v === "OFF_MISSION" ? "OFF MISSION" : v;
}

/** Two initials for a stream's badge. */
export function initials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
