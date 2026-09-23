"use client";

import { useMemo, useState } from "react";

import type { StreamRow } from "@/lib/types";
import { StreamCard } from "./StreamCard";

const STATUSES = ["All", "Active", "Paused", "Closed", "Demo"] as const;
const PERIODS = ["Any", "7 day", "14 day", "30 day", "10 min"] as const;
const SORTS = ["Pool", "Streak", "Newest"] as const;

function periodOf(row: StreamRow): string {
  return row.period_s < 86400 ? "10 min" : `${row.period_s / 86400} day`;
}

/** Filters for status, period and topic, sorted by pool or streak. Everything shown came from one read. */
export function Explore({ rows }: { rows: StreamRow[] }) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("All");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("Any");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Pool");
  const [topic, setTopic] = useState("");

  const shown = useMemo(() => {
    const words = topic.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows
      .filter((row) => {
        if (status === "Demo" && !row.demo) return false;
        if (status !== "All" && status !== "Demo" && row.status !== status.toUpperCase()) return false;
        if (period !== "Any" && periodOf(row) !== period) return false;
        const text = `${row.title} ${row.mission} ${row.sources.join(" ")}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .sort((a, b) => {
        if (sort === "Streak") return b.streak - a.streak || b.alive - a.alive;
        if (sort === "Newest") return b.sid - a.sid;
        const pa = BigInt(a.pool);
        const pb = BigInt(b.pool);
        return pb > pa ? 1 : pb < pa ? -1 : b.sid - a.sid;
      });
  }, [rows, status, period, sort, topic]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="row" style={{ gap: "10px 16px" }}>
        <div className="toggle" role="group" aria-label="Status">
          {STATUSES.map((one) => (
            <button key={one} aria-pressed={status === one} onClick={() => setStatus(one)}>
              {one}
            </button>
          ))}
        </div>
        <div className="toggle" role="group" aria-label="Period">
          {PERIODS.map((one) => (
            <button key={one} aria-pressed={period === one} onClick={() => setPeriod(one)}>
              {one}
            </button>
          ))}
        </div>
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder="Topic, such as zk or docs"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          aria-label="Filter by topic"
        />
        <label className="row hint" style={{ gap: 8, marginLeft: "auto" }}>
          Sort by
          <select className="select" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])}>
            {SORTS.map((one) => (
              <option key={one}>{one}</option>
            ))}
          </select>
        </label>
      </div>
      <span className="hint">
        {shown.length} of {rows.length} stream{rows.length === 1 ? "" : "s"}
      </span>
      {shown.length ? (
        <div className="grid grid-3">
          {shown.map((row) => (
            <StreamCard key={row.sid} stream={row} />
          ))}
        </div>
      ) : (
        <p className="body">Nothing matches those filters.</p>
      )}
    </div>
  );
}
