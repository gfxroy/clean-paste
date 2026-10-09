/// <reference lib="webworker" />
import { env, pipeline, type TokenClassificationPipeline } from "@huggingface/transformers";
import { chunks, MODEL, toSpans, type TokenTag } from "../lib/ai";
import type { Found } from "../lib/detect";

export type AiIn = { type: "scan"; id: number; text: string };
export type AiOut =
  | { type: "progress"; pct: number }
  | { type: "ready"; device: string }
  | { type: "result"; id: number; spans: Found[] }
  | { type: "error"; message: string };

declare const self: DedicatedWorkerGlobalScope;
env.allowLocalModels = false;
env.useBrowserCache = true;
const post = (m: AiOut) => self.postMessage(m);

const files = new Map<string, [number, number]>();
const progress_callback = (p: unknown) => {
  const i = p as { status: string; file?: string; loaded?: number; total?: number };
  if (i.status !== "progress" || !i.file) return;
  files.set(i.file, [i.loaded ?? 0, i.total ?? 0]);
  let l = 0, t = 0;
  for (const [a, b] of files.values()) { l += a; t += b; }
  if (t) post({ type: "progress", pct: Math.round((l / t) * 100) });
};

async function load(): Promise<TokenClassificationPipeline> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null;
  const devices: ("webgpu" | "wasm")[] = adapter ? ["webgpu", "wasm"] : ["wasm"];
  let last: unknown;
  for (const device of devices) {
    try {
      const p = (await pipeline("token-classification", MODEL, { device, dtype: "q8", progress_callback })) as TokenClassificationPipeline;
      await p("warm up Rahul");
      post({ type: "ready", device });
      return p;
    } catch (e) {
      last = e;
      console.warn(`AI check: ${device} failed`, e);
    }
  }
  throw last;
}

const ready = load();
ready.catch((e) => post({ type: "error", message: String(e) }));
let latest = 0;

self.onmessage = async (ev: MessageEvent<AiIn>) => {
  const { id, text } = ev.data;
  latest = id;
  const ner = await ready;
  if (id !== latest) return;
  const spans: Found[] = [];
  for (const c of chunks(text)) {
    if (!c.text.trim()) continue;
    const tags = (await ner(c.text, { ignore_labels: ["O"] })) as unknown as TokenTag[];
    spans.push(...toSpans(c.text, ner.tokenizer.tokenize(c.text), tags, c.offset));
    if (id !== latest) return;
  }
  post({ type: "result", id, spans });
};
