/**
 * The shapes the contract's views answer, exactly as contracts/keepalive.py
 * builds them. Amounts are decimal strings of wei; times are unix seconds.
 */

export type StreamStatus = "ACTIVE" | "PAUSED" | "CLOSED";
export type Verdict = "ALIVE" | "QUIET" | "OFF_MISSION" | "UNREADABLE";
export type PeriodStatus = "" | "REPORTED" | "RECHECK" | "CHECKED" | "LAPSED";

/**
 * One character per period:
 *   A alive  Q quiet  O off mission  U unreadable (final)  L lapsed
 *   R unreadable, recheck open  P reported, waiting for its check
 *   G ended, no report yet, grace open  N ended, no report, lapse due
 *   C in progress
 */
export type Cell = "A" | "Q" | "O" | "U" | "L" | "R" | "P" | "G" | "N" | "C";

export type StreamRow = {
  sid: number;
  title: string;
  owner: string;
  mission: string;
  sources: string[];
  status: StreamStatus;
  demo: boolean;
  period_s: number;
  grace_s: number;
  tranche: string;
  start: number;
  pool: string;
  shares: string;
  epoch: number;
  claimable: string;
  released: string;
  claimed: string;
  deposited: string;
  returned: string;
  patrons: number;
  streak: number;
  best_streak: number;
  strikes: number;
  next_k: number;
  current_k: number;
  periods: number;
  alive: number;
  quiet: number;
  off_mission: number;
  unreadable: number;
  lapsed: number;
  runway: number;
  opened_at: number;
  closed_at: number;
  pulse: string;
  last: { k: number; verdict: string; reason: string; at: number };
};

export type PeriodRow = {
  k: number;
  number: number;
  start: number;
  end: number;
  grace_end: number;
  cell: Cell;
  status: PeriodStatus;
  summary: string;
  links: string[];
  autolinks: string[];
  verdict: "" | Verdict;
  reason: string;
  reporter?: string;
  reported_at?: number;
  amended?: boolean;
  first_reason?: string;
  pages?: number;
  readable?: number;
  released?: string;
  checker?: string;
  checked_at?: number;
};

export type StreamDetail = StreamRow & {
  history: string;
  recent_periods: PeriodRow[];
  top_patrons: { address: string; value: string; shares: string }[];
  more_patrons: { count: number; value: string };
  now: number;
};

export type StreamList = { total: number; count: number; rows: StreamRow[]; now: number };

export type Position = {
  sid: number;
  address: string;
  shares: string;
  value: string;
  paid_in: string;
  paid_out: string;
  released_while_in: string;
  joined_at: number;
};

export type Portfolio = {
  address: string;
  positions: (Position & { stream: StreamRow })[];
  now: number;
};

export type Current = {
  sid: number;
  status: StreamStatus;
  now: number;
  k: number;
  number: number;
  start: number;
  end: number;
  grace_end: number;
  reportable: number[];
  pending: {
    k: number;
    start: number;
    end: number;
    grace_end: number;
    status: PeriodStatus;
    amended: boolean;
    checkable: boolean;
    lapsable: boolean;
  };
};

export type Deployment = {
  network: string;
  chainId: number;
  rpc: string;
  explorer: string;
  keepalive: string;
  deployedAt: string;
  sourceSha256: string;
};
