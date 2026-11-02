// Calendar / heatmap helpers for the daily P&L grid.
// Everything is computed in UTC (MT5 report timestamps are replayed as UTC) so a
// deal never drifts into a neighbouring day because of the viewer's timezone.

const pad = (n) => String(n).padStart(2, "0");

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const monthKeyOf = (y, m) => `${y}-${pad(m + 1)}`;
export const monthLabel = (y, m) => `${MONTH_SHORT[m]} ${y}`;
export const shiftMonth = (y, m, delta) => {
  const d = new Date(Date.UTC(y, m + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
};

/** Every month key from `firstKey` to `lastKey` inclusive (YYYY-MM). */
export function monthRange(firstKey, lastKey) {
  if (!firstKey || !lastKey || firstKey > lastKey) return [];
  const out = [];
  let y = +firstKey.slice(0, 4);
  let m = +firstKey.slice(5, 7) - 1;
  for (let guard = 0; guard < 600; guard++) {
    const key = monthKeyOf(y, m);
    out.push(key);
    if (key >= lastKey) break;
    m += 1;
    if (m === 12) { m = 0; y += 1; }
  }
  return out;
}

/**
 * Monday-first calendar grid for one month.
 * Each cell: { key, dayNum, dow, weekend } or null for the leading/trailing padding.
 * Returns an array of week arrays (always 7 cells each).
 */
export function monthGrid(y, m) {
  const total = daysInMonth(y, m);
  const firstDow = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= total; d++) {
    const dow = (firstDow + d - 1) % 7;
    cells.push({
      key: `${y}-${pad(m + 1)}-${pad(d)}`,
      dayNum: d,
      dow,
      weekend: dow >= 5,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const shortMoney = (v) => {
  if (!v) return "$0";
  const sign = v > 0 ? "+" : "-";
  const a = Math.abs(v);
  const body = a >= 10000 ? `${(a / 1000).toFixed(1)}k` : a >= 1000 ? Math.round(a).toLocaleString("en-US") : a.toFixed(2);
  return `${sign}$${body}`;
};

export const shortPct = (v) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v).toFixed(2)}%`;

export const toneOf = (v) => (v > 0 ? "text-emerald-300" : v < 0 ? "text-red-300" : "text-slate-500");

/** Green / red wash whose opacity scales with |value| relative to the month's biggest day. */
export function heatStyle(v, maxAbs) {
  if (!v) return undefined;
  const ratio = maxAbs > 0 ? Math.min(1, Math.abs(v) / maxAbs) : 0;
  const alpha = (0.07 + ratio * 0.32).toFixed(3);
  return { background: v > 0 ? `rgba(16, 185, 129, ${alpha})` : `rgba(239, 68, 68, ${alpha})` };
}

export const dayNumLabel = (key) => String(+key.slice(8, 10));
export const monthShortOf = (key) => MONTH_SHORT[+key.slice(5, 7) - 1];

/** "Feb 3 – 7" (or "Feb 27 – Mar 3" if a week ever straddles a month). */
export function rangeLabel(startKey, endKey) {
  if (!startKey || !endKey) return "—";
  const sm = monthShortOf(startKey);
  const em = monthShortOf(endKey);
  return sm === em
    ? `${sm} ${dayNumLabel(startKey)}–${dayNumLabel(endKey)}`
    : `${sm} ${dayNumLabel(startKey)} – ${em} ${dayNumLabel(endKey)}`;
}

/**
 * Build the full model for one calendar month.
 * `p` is the object returned by buildPortfolio(); `y`/`m` are UTC year / 0-based month.
 *
 * Returns:
 *  - grid:   padding-aware week arrays of cells
 *  - weeks:  per-grid-week aggregate (in-month days only), with opening/closing balance
 *  - days:   the month's trading days, chronological
 *  - summary: month totals, winning/losing days, best/worst/avg day
 *  - openBalance / closeBalance: portfolio balance entering / leaving the month
 */
export function buildMonthModel(p, y, m) {
  const all = p.days || [];
  const dayMap = new Map(all.map((d) => [d.key, d]));
  const grid = monthGrid(y, m);
  const monthStart = Date.UTC(y, m, 1);
  const prefix = monthKeyOf(y, m);

  // Balance carried into the month = balance after the last day before it.
  let openBalance = p.start;
  for (const d of all) {
    if (d.time >= monthStart) { openBalance = d.balanceStart; break; }
    openBalance = d.balanceEnd;
  }

  let bal = openBalance;
  const weeks = grid.map((cells, index) => {
    const days = cells.filter(Boolean).map((c) => dayMap.get(c.key)).filter(Boolean);
    const inMonth = cells.filter(Boolean);
    const total = days.reduce((s, d) => s + d.total, 0);
    const trades = days.reduce((s, d) => s + d.trades, 0);
    const winDays = days.filter((d) => d.total > 0).length;
    const lossDays = days.filter((d) => d.total < 0).length;
    const weekOpen = bal;
    bal += total;
    return {
      index,
      label: `W${index + 1}`,
      cells,
      days,
      startKey: inMonth[0]?.key ?? null,
      endKey: inMonth[inMonth.length - 1]?.key ?? null,
      total,
      trades,
      winDays,
      lossDays,
      tradingDays: days.length,
      openBalance: weekOpen,
      closeBalance: bal,
      pct: weekOpen > 0 ? (total / weekOpen) * 100 : 0,
    };
  });

  const days = weeks.flatMap((w) => w.days);
  const total = days.reduce((s, d) => s + d.total, 0);
  const trades = days.reduce((s, d) => s + d.trades, 0);
  const tradeWins = days.reduce((s, d) => s + d.wins, 0);
  const winDays = days.filter((d) => d.total > 0).length;
  const lossDays = days.filter((d) => d.total < 0).length;
  const flatDays = days.filter((d) => d.total === 0).length;
  const best = days.reduce((a, d) => (!a || d.total > a.total ? d : a), null);
  const worst = days.reduce((a, d) => (!a || d.total < a.total ? d : a), null);

  return {
    key: prefix,
    y,
    m,
    grid,
    weeks,
    days,
    dayMap,
    openBalance,
    closeBalance: openBalance + total,
    maxAbs: days.reduce((a, d) => Math.max(a, Math.abs(d.total)), 0),
    summary: {
      total,
      pct: openBalance > 0 ? (total / openBalance) * 100 : 0,
      tradingDays: days.length,
      totalDays: daysInMonth(y, m),
      winDays,
      lossDays,
      flatDays,
      best,
      worst,
      avg: days.length ? total / days.length : 0,
      trades,
      tradeWins,
      tradeWinRate: trades ? tradeWins / trades : 0,
      dayWinRate: days.length ? winDays / days.length : 0,
    },
  };
}
