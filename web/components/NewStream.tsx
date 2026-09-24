"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { gen, parseGen } from "@/lib/format";
import { testReadable, type Readability } from "@/lib/readable";
import { normaliseSource } from "@/lib/sources";
import { refreshReads, send, type TxState } from "@/lib/write";
import { TxLine, WriteGate } from "./Tx";
import { useWallet } from "./Wallet";

const STEPS = ["Mission", "Sources", "Schedule and tranche", "Review"];
const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
];

function SourceField({ value, onChange, index }: { value: string; onChange: (v: string) => void; index: number }) {
  const [test, setTest] = useState<Readability | null>(null);
  const norm = value.trim() ? normaliseSource(value) : null;
  useEffect(() => {
    setTest(null);
    if (!norm || !norm.ok) return;
    const timer = setTimeout(() => testReadable(norm.prefix).then(setTest), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const github = norm?.ok && norm.prefix.startsWith("github.com/");
  return (
    <div className="field">
      <input
        className="input mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={index === 0 ? "github.com/you/" : index === 1 ? "yourproject.dev/changelog" : "optional"}
        aria-label={`Source ${index + 1}`}
      />
      {norm ? (
        <span className={`hint ${norm.ok && (!test || test.readable) ? "ok" : "no"}`}>
          {norm.ok ? (test ? test.note : "testing readability") : norm.why}
          {github ? " · GitHub repo: the commits autolink will be added to every check" : ""}
        </span>
      ) : null}
    </div>
  );
}

export function NewStream() {
  const w = useWallet();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [mission, setMission] = useState("");
  const [sources, setSources] = useState(["", "", ""]);
  const [demo, setDemo] = useState(false);
  const [days, setDays] = useState(14);
  const [tranche, setTranche] = useState("150");
  const [example, setExample] = useState("2000");
  const [tx, setTx] = useState<TxState | null>(null);

  const missionText = mission.split(/\s+/).filter(Boolean).join(" ");
  const titleOk = title.trim().length > 0 && title.trim().length <= 80;
  const missionOk = missionText.length >= 20 && missionText.length <= 400;
  const filled = sources.map((s) => s.trim()).filter(Boolean);
  const norms = filled.map(normaliseSource);
  const sourcesOk = filled.length > 0 && norms.every((n) => n.ok);
  let trancheWei: bigint | null = null;
  try {
    trancheWei = parseGen(tranche);
    if (trancheWei <= 0n) trancheWei = null;
  } catch {
    trancheWei = null;
  }
  let exampleWei = 0n;
  try {
    exampleWei = parseGen(example);
  } catch {
    exampleWei = 0n;
  }
  const runway = trancheWei ? exampleWei / trancheWei : 0n;
  const ok = [titleOk && missionOk, sourcesOk, trancheWei !== null, true];
  const busy = tx !== null && ["estimating", "signing", "submitted", "deciding"].includes(tx.phase);

  async function open() {
    if (!w.address || trancheWei === null) return;
    const done = await send(
      w.address,
      "open_stream",
      [title.trim(), missionText, filled, demo ? 0 : days, trancheWei, demo],
      0n,
      setTx,
    );
    if (done.phase === "decided") {
      await refreshReads();
      const sid = Number(done.result);
      if (Number.isInteger(sid) && sid > 0) router.push(`/s/${sid}`);
      else router.push("/streams");
    }
  }

  return (
    <div className="split">
      <div className="stack" style={{ gap: 22, minWidth: 0 }}>
        <ol className="steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {STEPS.map((name, index) => (
            <li key={name} className={`step ${index < step ? "done" : ""}`} aria-current={index === step ? "step" : undefined}>
              <span className="num">{index + 1}</span>
              {name}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="stack" style={{ gap: 16 }}>
            <h2>What is the work?</h2>
            <div className="field">
              <label className="label" htmlFor="title">
                Name
              </label>
              <input id="title" className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Corvid Circuits" />
            </div>
            <div className="field">
              <label className="label" htmlFor="mission">
                Mission
              </label>
              <textarea
                id="mission"
                className="textarea"
                value={mission}
                maxLength={400}
                onChange={(e) => setMission(e.target.value)}
                placeholder="Maintain and extend Corvid, an MIT-licensed zk circuit library: new gadgets, audit fixes, docs and tagged releases."
              />
              <span className="hint">
                {missionText.length} / 400. Validators judge every period against these words, and they never change. A new mission is a new
                stream, so patrons never fund something they did not sign up for.
              </span>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="stack" style={{ gap: 16 }}>
            <h2>Where will your work show up?</h2>
            <p className="body">Every link in a report must start with one of these. Validators open them, so pick pages they can read.</p>
            {sources.map((value, index) => (
              <SourceField key={index} index={index} value={value} onChange={(v) => setSources((all) => all.map((one, i) => (i === index ? v : one)))} />
            ))}
            <p className="hint">
              The readability test runs from our server in text mode, roughly as validators read. It is free, and it is only a hint.
            </p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="stack" style={{ gap: 16 }}>
            <h2>How often, and how much?</h2>
            <div className="row">
              <div className="toggle" role="group" aria-label="Period">
                {PERIODS.map((p) => (
                  <button key={p.days} aria-pressed={!demo && days === p.days} onClick={() => (setDemo(false), setDays(p.days))}>
                    {p.label}
                  </button>
                ))}
                <button aria-pressed={demo} onClick={() => setDemo(true)}>
                  DEMO · 10 min
                </button>
              </div>
            </div>
            {demo ? (
              <p className="hint">
                A DEMO stream runs ten-minute periods with five minutes of grace and is labelled DEMO everywhere, so the whole loop can be
                recorded in one sitting.
              </p>
            ) : (
              <p className="hint">Reports can be posted from the start of a period until three days after it ends.</p>
            )}
            <div className="field" style={{ maxWidth: 260 }}>
              <label className="label" htmlFor="tranche">
                Tranche per alive period, GEN
              </label>
              <input id="tranche" className="input mono" inputMode="decimal" value={tranche} onChange={(e) => setTranche(e.target.value)} />
              {trancheWei === null ? <span className="hint no">Enter an amount above zero.</span> : null}
            </div>
            <div className="panel tight row" style={{ gap: 10 }}>
              <span className="body">A pool of</span>
              <input className="input mono" style={{ width: 120 }} value={example} onChange={(e) => setExample(e.target.value)} aria-label="Example pool" />
              <span className="body">
                GEN lasts <strong className="amount">{runway.toString()}</strong> alive period{runway === 1n ? "" : "s"}.
              </span>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="stack" style={{ gap: 16 }}>
            <h2>Review</h2>
            <dl className="kv panel" style={{ margin: 0 }}>
              <dt>Name</dt>
              <dd style={{ fontFamily: "inherit" }}>{title.trim()}</dd>
              <dt>Mission</dt>
              <dd style={{ fontFamily: "inherit", textAlign: "left" }}>{missionText}</dd>
              <dt>Sources</dt>
              <dd>{norms.map((n) => (n.ok ? n.prefix : "")).join(", ")}</dd>
              <dt>Period</dt>
              <dd>{demo ? "10 minutes (DEMO)" : `${days} days`}</dd>
              <dt>Grace</dt>
              <dd>{demo ? "5 minutes" : "3 days"}</dd>
              <dt>Tranche</dt>
              <dd>{trancheWei ? gen(trancheWei, 4) : "?"} GEN</dd>
              <dt>Starts</dt>
              <dd>when this is decided, never in the past</dd>
            </dl>
            <WriteGate>
              <button className="btn solid" onClick={open} disabled={busy || !ok.every(Boolean)}>
                Open the stream
              </button>
              <TxLine state={tx} />
            </WriteGate>
          </div>
        ) : null}

        <div className="row">
          <button className="btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
            Back
          </button>
          {step < 3 ? (
            <button className="btn solid" onClick={() => setStep((s) => s + 1)} disabled={!ok[step]}>
              Continue to {STEPS[step + 1].toLowerCase()}
            </button>
          ) : null}
        </div>
      </div>

      <aside className="stack" style={{ gap: 16 }}>
        <div className="panel stack">
          <span className="label">What validators can read</span>
          <ul className="body stack" style={{ margin: 0, paddingLeft: 18, gap: 6, fontSize: 14 }}>
            <li>Pull requests, releases, tag compares</li>
            <li>Changelog files with dates</li>
            <li>Blog posts that print their date</li>
            <li>The autolinked commits for the period</li>
          </ul>
          <ul className="muted stack" style={{ margin: 0, paddingLeft: 18, gap: 6, fontSize: 14 }}>
            <li>Posts on X, Discord, Telegram</li>
            <li>Private docs, Figma, video only</li>
            <li>Pages with no dates on them</li>
          </ul>
        </div>
        {missionText ? (
          <div className="panel stack">
            <span className="label">Your mission, from step 1</span>
            <p className="body" style={{ fontSize: 14.5 }}>
              {missionText}
            </p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
