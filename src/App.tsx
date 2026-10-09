import { useMemo, useState } from "react";
import { CATEGORIES, clean, restore, summary, type Category } from "./lib/detect";
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

  const result = useMemo(() => clean(input, enabled), [input, enabled]);
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

      <footer>Runs entirely in your browser. Nothing is uploaded or stored. <a href="https://github.com/gfxroy/clean-paste">Source</a></footer>
    </main>
  );
}
