export type Category = "email" | "phone" | "card" | "key" | "ip" | "url" | "id" | "address";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "email", label: "Emails" },
  { id: "phone", label: "Phones" },
  { id: "card", label: "Cards" },
  { id: "key", label: "Keys" },
  { id: "url", label: "URLs" },
  { id: "ip", label: "IPs" },
  { id: "id", label: "IDs" },
  { id: "address", label: "Addresses" },
];

type Tag = "EMAIL" | "PHONE" | "CARD" | "KEY" | "IP" | "URL" | "AADHAAR" | "PAN" | "SSN" | "ADDRESS";

interface Rule {
  cat: Category;
  tag: Tag;
  re: RegExp;
  /** Capture group holding the sensitive part (default: whole match). */
  group?: number;
  check?: (s: string) => boolean;
}

export function luhn(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = d.charCodeAt(d.length - 1 - i) - 48;
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function entropy(s: string): number {
  const f = new Map<string, number>();
  for (const c of s) f.set(c, (f.get(c) ?? 0) + 1);
  let h = 0;
  for (const n of f.values()) h -= (n / s.length) * Math.log2(n / s.length);
  return h;
}

function looksRandom(s: string): boolean {
  const classes = [/[a-z]/, /[A-Z]/, /\d/].filter((r) => r.test(s)).length;
  return classes >= 2 && /\d/.test(s) && entropy(s) >= 3.6;
}

const octet = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";

// Order = priority. Earlier rules win when matches overlap.
const RULES: Rule[] = [
  { cat: "key", tag: "KEY", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { cat: "key", tag: "KEY", re: /\beyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]{8,}/g },
  { cat: "key", tag: "KEY", re: /\bsk-(?:proj-|ant-[a-z0-9]+-)?[A-Za-z0-9_-]{20,}/g },
  { cat: "key", tag: "KEY", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { cat: "key", tag: "KEY", re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g },
  { cat: "key", tag: "KEY", re: /\bAIza[0-9A-Za-z_-]{35}/g },
  { cat: "key", tag: "KEY", re: /\b(?:xox[abprs]-[A-Za-z0-9-]{10,}|[sr]k_(?:live|test)_[A-Za-z0-9]{16,})/g },
  {
    cat: "key",
    tag: "KEY",
    re: /\b(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|auth)\b["']?\s*[:=]\s*["']?([^\s"',;]{6,})/gi,
    group: 1,
  },
  {
    cat: "url",
    tag: "URL",
    re: /\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s<>"'`]+/gi,
    check: (u) =>
      /:\/\/[^/\s:@]+:[^/\s@]+@/.test(u) ||
      /[?&#](?:[\w-]*(?:token|key|sig|signature|secret|auth|code|password|pass|session|credential)[\w-]*)=/i.test(u),
  },
  { cat: "email", tag: "EMAIL", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { cat: "card", tag: "CARD", re: /\b\d(?:[ -]?\d){12,18}\b/g, check: luhn },
  { cat: "id", tag: "SSN", re: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
  { cat: "id", tag: "AADHAAR", re: /(?<![+\w])[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b(?![ -]?\d)/g },
  { cat: "id", tag: "PAN", re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { cat: "phone", tag: "PHONE", re: /(?:\+91[\s-]?|\b0)?(?<!\d)[6-9]\d{4}[\s-]?\d{5}(?!\d)/g },
  { cat: "phone", tag: "PHONE", re: /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}\b/g },
  { cat: "phone", tag: "PHONE", re: /(?:\(\d{3}\)\s?|\b\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/g },
  { cat: "ip", tag: "IP", re: new RegExp(`\\b${octet}(?:\\.${octet}){3}\\b`, "g") },
  { cat: "ip", tag: "IP", re: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g },
  {
    cat: "address",
    tag: "ADDRESS",
    re: /\b\d{1,5}[A-Za-z]?,?\s+(?:[A-Z][a-z]+\.?\s+){1,4}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Boulevard|Blvd|Drive|Dr|Court|Ct|Way|Marg|Nagar|Colony|Layout|Sector)\b\.?/g,
  },
  { cat: "address", tag: "ADDRESS", re: /\b(?:PIN|Pincode|PIN code|ZIP|Zip code)[:\s-]*\d{5,6}\b/gi },
  // Generic high-entropy strings last.
  { cat: "key", tag: "KEY", re: /(?<![\w/+=.-])[A-Za-z0-9_\-+/=]{24,}(?![\w/+=-])/g, check: looksRandom },
];

export interface Found {
  start: number;
  end: number;
  value: string;
  tag: Tag;
  cat: Category;
}

export function detect(text: string, enabled: Set<Category> = new Set(CATEGORIES.map((c) => c.id))): Found[] {
  const kept: Found[] = [];
  const overlaps = (s: number, e: number) => kept.some((k) => s < k.end && e > k.start);
  for (const r of RULES) {
    if (!enabled.has(r.cat)) continue;
    for (const m of text.matchAll(r.re)) {
      const whole = m[0];
      const part = r.group ? m[r.group] : whole;
      if (!part || (r.check && !r.check(part))) continue;
      const start = m.index! + (r.group ? whole.lastIndexOf(part) : 0);
      const end = start + part.length;
      if (!overlaps(start, end)) kept.push({ start, end, value: part, tag: r.tag, cat: r.cat });
    }
  }
  return kept.sort((a, b) => a.start - b.start);
}

export interface CleanResult {
  text: string;
  /** placeholder -> original */
  map: Map<string, string>;
  counts: Map<Tag, number>;
  spans: { text: string; placeholder: boolean }[];
}

export function clean(text: string, enabled?: Set<Category>): CleanResult {
  const found = detect(text, enabled);
  const byValue = new Map<string, string>();
  const map = new Map<string, string>();
  const counts = new Map<Tag, number>();
  const spans: CleanResult["spans"] = [];
  let out = "";
  let i = 0;
  for (const f of found) {
    if (f.start > i) spans.push({ text: text.slice(i, f.start), placeholder: false });
    const key = `${f.tag}\u0000${f.value}`;
    let ph = byValue.get(key);
    if (!ph) {
      const n = (counts.get(f.tag) ?? 0) + 1;
      counts.set(f.tag, n);
      ph = `[${f.tag}_${n}]`;
      byValue.set(key, ph);
      map.set(ph, f.value);
    }
    spans.push({ text: ph, placeholder: true });
    i = f.end;
  }
  if (i < text.length) spans.push({ text: text.slice(i), placeholder: false });
  for (const s of spans) out += s.text;
  return { text: out, map, counts, spans };
}

/** Swap placeholders (with or without brackets) back to the originals. */
export function restore(reply: string, map: Map<string, string>): string {
  if (!map.size) return reply;
  const names = [...map.keys()].map((k) => k.slice(1, -1)).sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\[?\\b(${names.join("|")})\\b\\]?`, "g");
  return reply.replace(re, (_m, name: string) => map.get(`[${name}]`) ?? _m);
}

const NOUNS: Record<Tag, [string, string]> = {
  EMAIL: ["email", "emails"],
  PHONE: ["phone number", "phone numbers"],
  CARD: ["card number", "card numbers"],
  KEY: ["key", "keys"],
  IP: ["IP address", "IP addresses"],
  URL: ["private URL", "private URLs"],
  AADHAAR: ["Aadhaar number", "Aadhaar numbers"],
  PAN: ["PAN", "PANs"],
  SSN: ["SSN", "SSNs"],
  ADDRESS: ["address", "addresses"],
};

export function summary(counts: Map<Tag, number>): string {
  if (!counts.size) return "Nothing private found.";
  const parts = [...counts].map(([t, n]) => `${n} ${NOUNS[t][n === 1 ? 0 : 1]}`);
  return `Removed ${parts.join(", ")}`;
}
