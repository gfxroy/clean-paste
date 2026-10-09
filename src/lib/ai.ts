import type { Category, Found, Tag } from "./detect";

export const MODEL = "onnx-community/bert-small-pii-detection-ONNX";

const MAP: Record<string, [Tag, Category]> = {
  PERSON: ["NAME", "name"],
  LOCATION: ["ADDRESS", "address"],
  PASSWORD: ["PASSWORD", "password"],
  CREDIT_CARD: ["CARD", "card"],
  PHONE_NUMBER: ["PHONE", "phone"],
  EMAIL_ADDRESS: ["EMAIL", "email"],
  US_SSN: ["SSN", "id"],
  IP_ADDRESS: ["IP", "ip"],
  IBAN_CODE: ["ACCOUNT", "bank"],
  US_BANK_NUMBER: ["ACCOUNT", "bank"],
  US_PASSPORT: ["ID", "id"],
  US_DRIVER_LICENSE: ["ID", "id"],
  US_ITIN: ["ID", "id"],
  IMEI: ["ID", "id"],
};

/** Words the model sometimes tags as entities but are just labels. */
const STOP = /^(?:aadhaar|aadhar|pan|ssn|card|password|pass|pin|otp|key|token|phone|mobile|number|account|upi|ifsc|cvv|name|address|i|me|my)$/i;

export interface TokenTag {
  entity: string;
  score: number;
  index: number;
}

/** Map wordpiece tokens back to character offsets in the original text. */
export function alignTokens(text: string, tokens: string[]): ([number, number] | null)[] {
  const lower = text.toLowerCase();
  let cur = 0;
  return tokens.map((t) => {
    const piece = t.startsWith("##") ? t.slice(2) : t;
    if (t === "[UNK]" || !piece) return null;
    const at = lower.indexOf(piece, cur);
    if (at < 0 || at - cur > 40) return null;
    cur = at + piece.length;
    return [at, cur];
  });
}

/** Turn BIO token tags into whole-word spans. */
export function toSpans(text: string, tokens: string[], tags: TokenTag[], offset = 0): Found[] {
  const pos = alignTokens(text, tokens);
  const out: Found[] = [];
  let open: { type: string; start: number; end: number; scores: number[] } | null = null;
  const close = () => {
    if (!open) return;
    const mapped = MAP[open.type];
    let { start, end } = open;
    while (start > 0 && /[\w@.]/.test(text[start - 1])) start--;
    while (end < text.length && /\w/.test(text[end])) end++;
    while (end > start && /[\s,.;:]/.test(text[end - 1])) end--;
    const value = text.slice(start, end);
    const avg = open.scores.reduce((a, b) => a + b, 0) / open.scores.length;
    const digits = value.replace(/\D/g, "").length;
    const numeric = mapped && ["PHONE", "CARD", "SSN", "ACCOUNT"].includes(mapped[0]);
    if (mapped && avg >= 0.6 && value.length >= 2 && !STOP.test(value) && (!numeric || digits >= 7))
      out.push({ start: start + offset, end: end + offset, value, tag: mapped[0], cat: mapped[1] });
    open = null;
  };
  for (const t of [...tags].sort((a, b) => a.index - b.index)) {
    const p = pos[t.index - 1];
    if (!p) continue;
    const [bio, type] = t.entity.includes("-") ? t.entity.split(/-(.+)/) : ["B", t.entity];
    const sub = tokens[t.index - 1].startsWith("##");
    if (open && open.type === type && (bio === "I" || sub) && p[0] - open.end <= 3) {
      open.end = p[1];
      open.scores.push(t.score);
    } else {
      close();
      open = { type, start: p[0], end: p[1], scores: [t.score] };
    }
  }
  close();
  return out;
}

/** Split long text into model-sized chunks on line / sentence boundaries. */
export function chunks(text: string, max = 1200): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + max);
    if (end < text.length) {
      const cut = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(". ", end));
      if (cut > i + max / 2) end = cut + 1;
    }
    out.push({ text: text.slice(i, end), offset: i });
    i = end;
  }
  return out;
}
