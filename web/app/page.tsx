import Link from "next/link";

import { HeroStream } from "@/components/Hero";
import { PulseLegend } from "@/components/Pulse";
import { Seal } from "@/components/Seal";
import { StreamCard } from "@/components/StreamCard";
import { CHAIN_HEX, DEPLOYMENT, NETWORK_NAME, NETWORK_SHORT } from "@/lib/deployment";
import { when } from "@/lib/format";
import { featured, heroStream, recentChecks } from "@/lib/pick";
import { attempt, listStreams } from "@/lib/read";

export const dynamic = "force-dynamic";

const STEPS = [
  ["01", "Set the mission", "The builder says what counts as work, declares where it shows up, and picks a period and a tranche. The mission never changes."],
  ["02", "Fund the pool", "Patrons deposit any time and receive shares of the pool. They can leave any time with everything not yet released."],
  ["03", "Report", "Each period, a short summary with up to three links to the real work. Every link must start with a declared source."],
  ["04", "Validators check", "After the period closes, each validator opens the links itself. Alive releases one tranche. Quiet holds it. Two in a row pause."],
];

const VERDICTS = [
  ["ALIVE", "The evidence shows real work on the mission, dated inside the period. Small but real work counts, and so do research, writing, docs, design or media when the mission is about them.", "One tranche moves to the builder."],
  ["QUIET", "No work inside the period is shown, or the report claims work the links do not show, or the only activity is trivial and presented as progress.", "The tranche stays in the pool. A strike."],
  ["OFF_MISSION", "Real work happened inside the period, but not on the stated mission.", "The tranche stays in the pool. A strike."],
  ["UNREADABLE", "None of the pages could be read: errors, login walls, empty pages.", "Nothing moves, no strike, and the builder may swap links once."],
];

const FAQ = [
  ["Who checks?", "GenLayer validators. The leader and every validator fetch the report's links themselves, run the same public rubric, and a tranche moves only when their verdict labels agree. Nobody at Keepalive decides anything."],
  ["What if a link breaks?", "A page that cannot be read shows up as unreadable to the judge. If nothing in a report can be read, the period is UNREADABLE: no strike, and the builder can swap links once inside the grace days."],
  ["Can I leave?", "Always. Exit burns your shares and sends you your part of everything not yet released, in any state: active, paused or closed. It is never hidden or disabled."],
  ["What does it cost?", `Only what you choose to fund. On ${NETWORK_SHORT} the GEN is test GEN with no value, and the faucet on every write screen hands it out.`],
  ["Which network?", `${NETWORK_NAME}, chain ${DEPLOYMENT.chainId} (0x${CHAIN_HEX.slice(2).toUpperCase()}). The contract address is in the footer, and every verdict is a transaction anyone can open on the explorer.`],
  ["What does it not judge?", "Quality, popularity and pace. Keepalive proves that work on the mission happened, not that it was good or that it mattered. That stays the patrons' call, which is why every reason is public."],
];

export default async function Landing() {
  const read = await attempt(() => listStreams("", 0, 50));
  const rows = read.ok ? read.data.rows : [];
  const hero = heroStream(rows);
  const recent = recentChecks(rows);
  const cards = featured(rows);

  return (
    <>
      <section style={{ padding: "64px 0 56px" }}>
        <div className="wrap hero-grid">
          <div className="stack" style={{ gap: 22 }}>
            <span className="label">Recurring support, checked on GenLayer</span>
            <h1>
              Funding that stops when the work stops.
            </h1>
            <p className="lede">
              Back a builder once. Keepalive releases your support one period at a time, and only after GenLayer validators read the
              builder&apos;s report and links and agree the work is still happening.
            </p>
            <div className="row">
              <Link href="/streams" className="btn solid">
                Back a builder
              </Link>
              <Link href="/new" className="btn">
                Start a stream
              </Link>
            </div>
            <p className="hint">Patrons can exit at any time with everything not yet released.</p>
          </div>
          <div>
            {hero ? (
              <HeroStream stream={hero} />
            ) : (
              <div className="panel stack">
                <span className="label">Live</span>
                <p className="body">
                  {read.ok
                    ? "No stream has been opened on this deployment yet. The first one will appear here with its pulse strip."
                    : `The chain could not be read just now: ${read.error}`}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section style={{ borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)", padding: "16px 0" }}>
        <div className="wrap row" style={{ gap: "12px 28px", flexWrap: "nowrap", overflowX: "auto" }}>
          <span className="label" style={{ flex: "none" }}>
            Recent checks
          </span>
          {recent.length === 0 ? (
            <span className="hint">No period has been checked yet.</span>
          ) : (
            recent.map((row) => (
              <Link key={row.sid} href={`/s/${row.sid}`} className="row" style={{ flex: "none", flexWrap: "nowrap", textDecoration: "none", gap: 8 }}>
                <Seal verdict={row.last.verdict} />
                <span style={{ fontSize: 14 }}>{row.title}</span>
                <span className="hint" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.last.reason}
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="section" id="how" style={{ borderTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <span className="label">How it works</span>
            <h2>A period, a report, a check, then release or hold.</h2>
          </div>
          <div className="grid grid-4">
            {STEPS.map(([n, title, text]) => (
              <div key={n} className="panel stack" style={{ gap: 10 }}>
                <span className="label">{n}</span>
                <h3>{title}</h3>
                <p className="body" style={{ fontSize: 14.5 }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="rubric">
        <div className="wrap">
          <div className="section-head">
            <span className="label">The rubric</span>
            <h2>Four verdicts, in plain words.</h2>
            <p className="lede">
              Every validator runs the same public prompt against the same mission and window. They compare the verdict label and
              never the reason sentence. <Link href="/rubric">Read the exact prompt</Link>.
            </p>
          </div>
          <div className="grid grid-2">
            {VERDICTS.map(([verdict, meaning, money]) => (
              <div key={verdict} className="panel stack" style={{ gap: 10 }}>
                <Seal verdict={verdict} />
                <p className="body" style={{ fontSize: 14.5 }}>
                  {meaning}
                </p>
                <span className="hint">{money}</span>
              </div>
            ))}
          </div>
          <div className="stack" style={{ marginTop: 20, gap: 10 }}>
            <PulseLegend cells="AQOULC" />
            <p className="hint">
              What it does not judge: quality, popularity or pace. A period with no report by the end of its grace days lapses, which
              anyone can record, and it counts like QUIET.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <span className="label">Featured streams</span>
            <h2>Every card is a real stream on {NETWORK_SHORT}.</h2>
          </div>
          {cards.length ? (
            <div className="grid grid-3">
              {cards.map((row) => (
                <StreamCard key={row.sid} stream={row} />
              ))}
            </div>
          ) : (
            <p className="body">No streams yet.</p>
          )}
          <div style={{ marginTop: 20 }}>
            <Link href="/streams" className="btn">
              Explore every stream
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="builders">
        <div className="wrap">
          <div className="section-head">
            <span className="label">For builders</span>
            <h2>What counts as evidence.</h2>
            <p className="lede">
              Validators open your links themselves, in a text-mode browser, and read the first 5,000 characters of each. Link the
              work itself, on pages that print dates. We measured what reads well through validator consensus before writing this.
            </p>
          </div>
          <div className="grid grid-2">
            <div className="panel stack">
              <span className="label">Reads well</span>
              <ul className="body stack" style={{ margin: 0, paddingLeft: 18, gap: 8, fontSize: 14.5 }}>
                <li>The autolinked commits for the period. Every date, condensed to one line per commit.</li>
                <li>A raw changelog file with dates, such as CHANGES.md at a tag.</li>
                <li>A blog post that prints its date on the page.</li>
                <li>A pull request or a release page for what shipped. These read, but GitHub prints no dates in text mode, so pair them with the autolink or a dated changelog.</li>
              </ul>
            </div>
            <div className="panel stack">
              <span className="label">Reads badly</span>
              <ul className="body stack" style={{ margin: 0, paddingLeft: 18, gap: 8, fontSize: 14.5 }}>
                <li>Posts on X. Validators could not load one at all.</li>
                <li>Discord messages, Telegram channels, private docs.</li>
                <li>Figma files, video with no text, a homepage with no dates.</li>
                <li>Anything behind a login.</li>
              </ul>
            </div>
          </div>
          <div className="banner" style={{ marginTop: 16 }}>
            <strong>Keepalive only suits work that leaves a public trace.</strong> Security audits under NDA, private research and
            closed-source products are not a fit, because validators can only judge what they can open.
          </div>
        </div>
      </section>

      <section className="section" id="programs">
        <div className="wrap split">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <span className="label">For programs</span>
            <h2>One public rubric instead of a monthly review.</h2>
            <p className="lede">
              A grant program funds each grantee&apos;s stream from its own wallet, with the tranches it would have paid anyway.
              Every grantee is held to the same rule, checks run on their own once each period closes, and reviewer time goes only to
              the streams that come back quiet. The program can exit a stream at any time with its unreleased share.
            </p>
          </div>
          <div className="panel stack">
            <span className="label">A cohort, run on Keepalive</span>
            <ol className="body stack" style={{ margin: 0, paddingLeft: 18, gap: 8, fontSize: 14.5 }}>
              <li>Each grantee opens a stream with the mission from their proposal.</li>
              <li>The program funds each stream once, for the whole grant.</li>
              <li>The portfolio page shows the cohort in one table, twelve periods per row.</li>
              <li>A paused stream is the only alert. Step in there, or exit.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <span className="label">Questions</span>
            <h2>Before you fund.</h2>
          </div>
          <div className="grid grid-2">
            {FAQ.map(([q, a]) => (
              <div key={q} className="panel stack" style={{ gap: 8 }}>
                <h3>{q}</h3>
                <p className="body" style={{ fontSize: 14.5 }}>
                  {a}
                </p>
              </div>
            ))}
          </div>
          {read.ok ? (
            <p className="hint" style={{ marginTop: 20 }}>
              Read from the chain at {when(read.data.now, true)}: {read.data.count} stream{read.data.count === 1 ? "" : "s"} on this
              deployment.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
