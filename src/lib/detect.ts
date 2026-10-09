export type Category =
  | "email" | "phone" | "card" | "key" | "password" | "name" | "address" | "id" | "bank" | "url" | "ip";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "email", label: "Emails" },
  { id: "phone", label: "Phones" },
  { id: "card", label: "Cards" },
  { id: "key", label: "Keys" },
  { id: "password", label: "Passwords" },
  { id: "name", label: "Names" },
  { id: "address", label: "Places" },
  { id: "id", label: "IDs" },
  { id: "bank", label: "Bank" },
  { id: "url", label: "URLs" },
  { id: "ip", label: "IPs" },
];

export type Tag =
  | "PASSWORD" | "EMAIL" | "PHONE" | "CARD" | "CVV" | "EXPIRY" | "KEY" | "IP" | "URL" | "AADHAAR" | "PAN" | "SSN"
  | "ACCOUNT" | "IFSC" | "UPI" | "ID" | "NAME" | "ADDRESS";

export interface Found {
  start: number;
  end: number;
  value: string;
  tag: Tag;
  cat: Category;
}

interface Rule {
  cat: Category;
  tag: Tag;
  re: RegExp;
  /** The value is always the LAST capture group (or the whole match when 0). */
  group?: number;
  check?: (value: string, m: RegExpMatchArray) => boolean;
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
  if (!/\d/.test(s) || classes < 2) return false;
  return s.length >= 24 ? entropy(s) >= 3.6 : classes === 3 && entropy(s) >= 3.4;
}

export const PLACEHOLDER = /^\[[A-Z]+_\d+\]$/;

// ---- Label-nearby grammar --------------------------------------------------
// "<label> <up to ~3 fillers/separators> <value>", e.g. "card number - 4111…", "my pin is 4821", "pass=x".
const FILLERS = "is|was|are|no|nos|num|number|of|my|the|at|on|me|a|code|id|its|it's|here|be|will";
const GAP = `((?:\\s*(?:->|=>|[:=#\\u2013\\u2014-]+|(?:${FILLERS})(?![A-Za-z0-9]))\\s*|\\s+){1,4})`;
const FILLER_WORD = new RegExp(`^(?:${FILLERS})$`, "i");

function labeled(labels: string, value: string): RegExp {
  return new RegExp(
    `(?<![A-Za-z0-9])(?:[A-Za-z0-9]+[_-])*(${labels})(?![A-Za-z0-9])["']?${GAP}["']?(${value})`,
    "gi",
  );
}

const DIGITS = (min: number, max: number) => `\\d(?:[ -]?\\d){${min - 1},${max - 1}}(?![ -]?\\d)`;
const FREE = `[^\\s"',&;]+`;
const WEAK = /^(pass|pin|key|token|secret|auth|bearer)$/i;
const hasPunct = (gap: string) => /[:=#>\u2013\u2014]|\s-|-\s|^-/.test(gap);
const secretShape = (v: string) => /\d/.test(v) || /[^A-Za-z]/.test(v) || (/[a-z]/.test(v) && /[A-Z]/.test(v));

const freeCheck = (v: string, m: RegExpMatchArray) =>
  !PLACEHOLDER.test(v) &&
  !FILLER_WORD.test(v) &&
  (hasPunct(m[2]) || secretShape(v) || (!WEAK.test(m[1]) && /\S/.test(m[2])));

const octet = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";

// Order = priority. Earlier rules win when matches overlap.
const RULES: Rule[] = [
  // Exact-shape vendor secrets.
  { cat: "key", tag: "KEY", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { cat: "key", tag: "KEY", re: /\beyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]{8,}/g },
  { cat: "key", tag: "KEY", re: /\bsk-(?:proj-|ant-[a-z0-9]+-)?[A-Za-z0-9_-]{20,}/g },
  { cat: "key", tag: "KEY", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { cat: "key", tag: "KEY", re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g },
  { cat: "key", tag: "KEY", re: /\bAIza[0-9A-Za-z_-]{35}/g },
  { cat: "key", tag: "KEY", re: /\b(?:xox[abprs]-[A-Za-z0-9-]{10,}|[sr]k_(?:live|test)_[A-Za-z0-9]{16,})/g },

  // Labeled values (fuzzy grammar).
  { cat: "card", tag: "CARD", re: labeled("credit\\s+card|debit\\s+card|card|cc", DIGITS(12, 19)), group: 3 },
  { cat: "card", tag: "CVV", re: labeled("cvv2?|cvc|csc", "\\d{3,4}(?!\\d)"), group: 3 },
  {
    cat: "card",
    tag: "EXPIRY",
    re: labeled("expiry(?:\\s+date)?|exp(?:\\s+date)?|expires|valid\\s+(?:thru|till|until)", "(?:0[1-9]|1[0-2])\\s*[/-]\\s*(?:\\d{4}|\\d{2})(?!\\d)"),
    group: 3,
  },
  { cat: "id", tag: "AADHAAR", re: labeled("aadhaar|aadhar|adhaar|aadhaar\\s+card|uidai|uid", "\\d{4}[ -]?\\d{4}[ -]?\\d{4}(?![ -]?\\d)"), group: 3 },
  { cat: "id", tag: "PAN", re: labeled("pan(?:\\s+card)?", "[A-Za-z]{5}\\d{4}[A-Za-z](?![A-Za-z0-9])"), group: 3 },
  { cat: "id", tag: "SSN", re: labeled("ssn|social\\s+security(?:\\s+number)?", "\\d{3}[ -]?\\d{2}[ -]?\\d{4}(?!\\d)"), group: 3 },
  { cat: "bank", tag: "IFSC", re: labeled("ifsc", "[A-Za-z]{4}0[A-Za-z0-9]{6}(?![A-Za-z0-9])"), group: 3 },
  { cat: "bank", tag: "UPI", re: labeled("upi(?:\\s+id)?|vpa", "[\\w.-]{2,}@[\\w.-]{2,}"), group: 3 },
  { cat: "bank", tag: "ACCOUNT", re: labeled("bank\\s+account|account|acct|acc|a/c", DIGITS(9, 18)), group: 3 },
  { cat: "password", tag: "PASSWORD", re: labeled("m?pin|otp|passcode", "\\d{4,8}(?!\\d)"), group: 3 },
  {
    cat: "phone",
    tag: "PHONE",
    re: labeled("phone|mobile|mob|cell|contact|whatsapp|call|tel|ph|number", "\\+?\\d(?:[\\s().-]{0,2}\\d){6,14}(?!\\d)"),
    group: 3,
  },
  { cat: "password", tag: "PASSWORD", re: labeled("password|passwd|passcode|pass|pwd|otp|pin", FREE), group: 3, check: freeCheck },
  {
    cat: "key",
    tag: "KEY",
    re: labeled(
      "api[_ -]?key|apikey|access[_ -]?key|access[_ -]?token|client[_ -]?secret|private[_ -]?key|secret[_ -]?key|secret|token|bearer|auth|key",
      FREE,
    ),
    group: 3,
    check: freeCheck,
  },

  // Value shapes, label or not.
  {
    cat: "url",
    tag: "URL",
    re: /\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s<>"'`]+/gi,
    check: (u) =>
      /:\/\/[^/\s:@]+:[^/\s@]+@/.test(u) ||
      /[?&#](?:[\w-]*(?:token|key|sig|signature|secret|auth|code|password|pass|session|credential)[\w-]*)=/i.test(u),
  },
  { cat: "email", tag: "EMAIL", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { cat: "bank", tag: "UPI", re: /\b[\w.-]{2,}@[A-Za-z]{2,}\b(?![.@\w])/g },
  { cat: "card", tag: "CARD", re: /\b\d(?:[ -]?\d){12,18}\b/g, check: luhn },
  { cat: "id", tag: "SSN", re: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
  { cat: "id", tag: "AADHAAR", re: /(?<![+\w])[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b(?![ -]?\d)/g },
  { cat: "id", tag: "PAN", re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { cat: "bank", tag: "IFSC", re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g, check: (v) => /\d/.test(v.slice(5)) },
  { cat: "phone", tag: "PHONE", re: /(?:\+91[\s-]?|\b0)?(?<![\d.,])[6-9](?:[\s-]?\d){9}(?![\d.,]?\d)/g },
  { cat: "phone", tag: "PHONE", re: /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}\b/g },
  { cat: "phone", tag: "PHONE", re: /(?:\(\d{3}\)\s?|\b\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/g },
  { cat: "ip", tag: "IP", re: new RegExp(`\\b${octet}(?:\\.${octet}){3}\\b`, "g") },
  { cat: "ip", tag: "IP", re: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g },

  // Names and places in prose (rule-based fallback; the AI check catches the rest).
  { cat: "name", tag: "NAME", re: /(?:\b[Mm]y\s+[Nn]ame\s+is|\b[Nn]ame\s*[:=\u2013-])\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g, group: 1 },
  {
    cat: "address",
    tag: "ADDRESS",
    re: /(?:\b[Ii]\s+(?:live|stay|reside)\s+(?:in|at)|\b[Aa]ddress\s*(?:is|[:=\u2013-]))\s+([A-Z0-9][\w.-]*(?:,?\s+[A-Z][\w.-]*){0,5})/g,
    group: 1,
  },
  {
    cat: "address",
    tag: "ADDRESS",
    re: /\b\d{1,5}[A-Za-z]?,?\s+(?:[A-Z][a-z]+\.?\s+){1,4}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Boulevard|Blvd|Drive|Dr|Court|Ct|Way|Marg|Nagar|Colony|Layout|Sector)\b\.?/g,
  },
  { cat: "address", tag: "ADDRESS", re: /\b(?:PIN|Pincode|PIN code|ZIP|Zip code)[:\s-]*\d{5,6}\b/gi },

  // Generic high-entropy strings last.
  { cat: "key", tag: "KEY", re: /(?<![\w/+=.-])[A-Za-z0-9_\-+/=]{16,}(?![\w/+=-])/g, check: looksRandom },
];

const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && a.end > b.start;

/** Rule spans first (by priority), then extra spans (e.g. from the AI model) fill any gaps. */
export function detect(text: string, enabled: Set<Category> = new Set(CATEGORIES.map((c) => c.id)), extra: Found[] = []): Found[] {
  const kept: Found[] = [];
  for (const r of RULES) {
    if (!enabled.has(r.cat)) continue;
    for (const m of text.matchAll(r.re)) {
      const whole = m[0];
      const part = r.group ? m[r.group] : whole;
      if (!part || PLACEHOLDER.test(part) || (r.check && !r.check(part, m))) continue;
      const start = m.index! + (r.group ? whole.lastIndexOf(part) : 0);
      const f = { start, end: start + part.length, value: part, tag: r.tag, cat: r.cat };
      if (!kept.some((k) => overlap(k, f))) kept.push(f);
    }
  }
  const rules = kept.slice();
  for (const f of [...extra].sort((a, b) => b.end - b.start - (a.end - a.start))) {
    if (!enabled.has(f.cat) || f.end > text.length || text.slice(f.start, f.end) !== f.value) continue;
    const hits = kept.filter((k) => overlap(k, f));
    // Longest wins: an AI span may swallow shorter rule spans it fully contains.
    if (hits.every((k) => rules.includes(k) && k.start >= f.start && k.end <= f.end && k.end - k.start < f.end - f.start && k.cat === f.cat)) {
      for (const h of hits) kept.splice(kept.indexOf(h), 1);
      kept.push(f);
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

export function clean(text: string, enabled?: Set<Category>, extra?: Found[]): CleanResult {
  const found = detect(text, enabled, extra);
  const byValue = new Map<string, string>();
  const map = new Map<string, string>();
  const counts = new Map<Tag, number>();
  const spans: CleanResult["spans"] = [];
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
  return { text: spans.map((s) => s.text).join(""), map, counts, spans };
}

/** Swap placeholders (with or without brackets) back to the originals. */
export function restore(reply: string, map: Map<string, string>): string {
  if (!map.size) return reply;
  const names = [...map.keys()].map((k) => k.slice(1, -1)).sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\[?\\b(${names.join("|")})\\b\\]?`, "g");
  return reply.replace(re, (m, name: string) => map.get(`[${name}]`) ?? m);
}

const NOUNS: Record<Tag, [string, string]> = {
  PASSWORD: ["password", "passwords"],
  EMAIL: ["email", "emails"],
  PHONE: ["phone number", "phone numbers"],
  CARD: ["card number", "card numbers"],
  CVV: ["CVV", "CVVs"],
  EXPIRY: ["expiry date", "expiry dates"],
  KEY: ["key", "keys"],
  IP: ["IP address", "IP addresses"],
  URL: ["private URL", "private URLs"],
  AADHAAR: ["Aadhaar number", "Aadhaar numbers"],
  PAN: ["PAN", "PANs"],
  SSN: ["SSN", "SSNs"],
  ACCOUNT: ["account number", "account numbers"],
  IFSC: ["IFSC code", "IFSC codes"],
  UPI: ["UPI ID", "UPI IDs"],
  ID: ["ID number", "ID numbers"],
  NAME: ["name", "names"],
  ADDRESS: ["place", "places"],
};

export function summary(counts: Map<Tag, number>): string {
  if (!counts.size) return "Nothing private found.";
  return `Removed ${[...counts].map(([t, n]) => `${n} ${NOUNS[t][n === 1 ? 0 : 1]}`).join(", ")}`;
}
