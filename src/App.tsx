import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, clean, restore, summary, type Category, type Found } from "./lib/detect";
import type { AiIn, AiOut } from "./worker/ai.worker";

type AiState = { status: "loading"; pct: number } | { status: "ready" } | { status: "off" };

/** In-browser AI check: scans ~300ms after typing stops; rule results show instantly meanwhile. */
function useAi(text: string) {
  const [state, setState] = useState<AiState>({ status: "loading", pct: 0 });
  const [result, setResult] = useState<{ text: string; spans: Found[] }>({ text: "", spans: [] });
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const texts = useRef(new Map<number, string>());
  useEffect(() => {
    const w = new Worker(new URL("./worker/ai.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<AiOut>) => {
      const m = e.data;
      if (m.type === "progress") setState({ status: "loading", pct: m.pct });
      else if (m.type === "ready") setState({ status: "ready" });
      else if (m.type === "error") setState({ status: "off" });
      else if (m.id === seq.current) setResult({ text: texts.current.get(m.id) ?? "", spans: m.spans });
    };
    return () => w.terminate();
  }, []);
  useEffect(() => {
    if (!text.trim()) return;
    const t = setTimeout(() => {
      const id = ++seq.current;
      texts.current = new Map([[id, text]]);
      worker.current?.postMessage({ type: "scan", id, text } satisfies AiIn);
    }, 300);
    return () => clearTimeout(t);
  }, [text]);
  return { state, spans: result.text === text ? result.spans : [] };
}
import { SAMPLE } from "./lib/fixtures";

function useCopy() {
  const [done, setDone] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  };
  return [done, copy] as const;
}

export default function App() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [enabled, setEnabled] = useState<Set<Category>>(() => new Set(CATEGORIES.map((c) => c.id)));
  const [copied, copy] = useCopy();
  const [copiedR, copyR] = useCopy();

  const ai = useAi(input);
  const result = useMemo(() => clean(input, enabled, ai.spans), [input, enabled, ai.spans]);
  const restored = useMemo(() => restore(reply, result.map), [reply, result.map]);

  const toggle = (id: Category) =>
    setEnabled((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <main className="wrap">
      <header>
        <div className="brand">Clean Paste</div>
        <h1>Remove private info before you paste into AI.</h1>
      </header>

      <div className="chips" role="group" aria-label="What to remove">
        {CATEGORIES.map((c) => (
          <button key={c.id} className="chip" aria-pressed={enabled.has(c.id)} onClick={() => toggle(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <section>
        <div className="row">
          <label htmlFor="in">Your text</label>
          <div className="links">
            {input ? (
              <button className="link" onClick={() => { setInput(""); setReply(""); }}>Clear</button>
            ) : (
              <button className="link" onClick={() => setInput(SAMPLE)}>Try a sample</button>
            )}
          </div>
        </div>
        <textarea
          id="in"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste anything: logs, emails, code, a support ticket…"
          spellCheck={false}
          autoFocus
        />
        <div className="ai" data-testid="ai">
          {ai.state.status === "ready"
            ? "AI check ready"
            : ai.state.status === "off"
              ? "AI check unavailable. Using rules only."
              : `Loading AI check${ai.state.pct ? ` ${ai.state.pct}%` : ""}…`}
        </div>
      </section>

      {input && (
        <section className="fade">
          <div className="row">
            <span className="label">Clean text</span>
            <span className="count" data-testid="count">{summary(result.counts)}</span>
          </div>
          <pre className="out" data-testid="clean">
            {result.spans.map((s, i) => (s.placeholder ? <mark key={i}>{s.text}</mark> : s.text))}
          </pre>
          <button className="primary" onClick={() => copy(result.text)}>
            {copied ? "Copied" : "Copy clean text"}
          </button>
        </section>
      )}

      {result.map.size > 0 && (
        <section className="fade restore">
          <div className="row">
            <label htmlFor="reply">Restore</label>
            <span className="count">Paste the AI's reply to put the originals back.</span>
          </div>
          <textarea
            id="reply"
            className="small"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="e.g. Email [EMAIL_1] about the refund…"
            spellCheck={false}
          />
          {reply && (
            <div className="fade">
              <pre className="out" data-testid="restored">{restored}</pre>
              <button className="secondary" onClick={() => copyR(restored)}>
                {copiedR ? "Copied" : "Copy restored text"}
              </button>
            </div>
          )}
        </section>
      )}

      <footer>Runs entirely in your browser, AI check included. Nothing is uploaded or stored. <a href="https://github.com/gfxroy/clean-paste">Source</a></footer>
    </main>
  );
}
