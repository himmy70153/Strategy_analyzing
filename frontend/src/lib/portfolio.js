const pad = (n) => String(n).padStart(2, "0");
export const fmtDate = (t) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
};
export const fmtDateTime = (t) => {
  const d = new Date(t);
  return `${fmtDate(t)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};
export const monthKey = (t) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
export const dayKey = (t) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export const utcDayStart = (t) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
export const money = (v, sign = false) => {
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v < 0) return `-$${s}`;
  return `${sign && v > 0 ? "+" : ""}$${s}`;
};

export function tradeStats(deals) {
  let gp = 0, gl = 0, trades = 0, wins = 0;
  for (const d of deals) {
    if (d.isOut) {
      trades++;
      if (d.net > 0) { gp += d.net; wins++; } else gl += d.net;
    } else gl += Math.min(d.net, 0);
  }
  const net = deals.reduce((s, d) => s + d.net, 0);
  return { trades, wins, grossProfit: gp, grossLoss: gl, net, pf: gl < 0 ? gp / -gl : gp > 0 ? Infinity : 0, winRate: trades ? wins / trades : 0 };
}

export function drawdownWalk(events, start) {
  let bal = start, peak = start, peakTime = events[0]?.time ?? 0;
  const dd = { amount: 0, pct: 0, peakTime: null, troughTime: null, peakBal: start, troughBal: start, pctAmount: 0 };
  const curve = [];
  for (const e of events) {
    bal += e.net;
    if (bal > peak) { peak = bal; peakTime = e.time; }
    const cur = peak - bal;
    const pct = peak > 0 ? cur / peak : 0;
    if (cur > dd.amount) Object.assign(dd, { amount: cur, peakTime, troughTime: e.time, peakBal: peak, troughBal: bal });
    if (pct > dd.pct) Object.assign(dd, { pct, pctAmount: cur });
    curve.push({ time: e.time, balance: bal, dd: -cur, ddPct: -pct * 100 });
  }
  return { curve, dd, final: bal };
}

export function buildPortfolio(reports, start) {
  const events = [];
  reports.forEach((r, ri) => r.deals.forEach((d) => events.push({ ...d, report: r.expert, ri })));
  events.sort((a, b) => a.time - b.time);
  const stats = tradeStats(events);
  const { curve, dd, final } = drawdownWalk(events, start);

  const months = {};
  const days = {};
  events.forEach((e) => {
    const mk = monthKey(e.time);
    months[mk] = months[mk] || { key: mk, total: 0, trades: 0, byReport: {} };
    months[mk].total += e.net;
    months[mk].byReport[e.ri] = (months[mk].byReport[e.ri] || 0) + e.net;
    if (e.isOut) months[mk].trades++;
    const dk = dayKey(e.time);
    days[dk] = days[dk] || {
      key: dk,
      day: fmtDate(e.time),
      time: utcDayStart(e.time),
      total: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      volume: 0,
      deals: [],
      reports: new Set(),
    };
    const day = days[dk];
    day.total += e.net;
    day.volume += e.volume;
    day.deals.push(e);
    if (e.isOut) {
      day.trades++;
      if (e.net > 0) day.wins++;
      else if (e.net < 0) day.losses++;
      if (e.net < 0) day.reports.add(e.ri);
    }
  });

  // Roll days up in chronological order, carrying the running balance so the
  // calendar can show a day both in $ and as a % of the account at day open.
  const dayList = [];
  let running = start;
  for (const d of Object.values(days).sort((a, b) => a.time - b.time)) {
    let run = 0, peak = 0, intra = 0;
    d.deals.forEach((e) => { run += e.net; peak = Math.max(peak, run); intra = Math.max(intra, peak - run); });
    const balanceStart = running;
    running += d.total;
    dayList.push({
      key: d.key,
      day: d.day,
      time: d.time,
      total: d.total,
      trades: d.trades,
      wins: d.wins,
      losses: d.losses,
      volume: d.volume,
      deals: d.deals,
      intraDD: intra,
      losingReports: d.reports.size,
      balanceStart,
      balanceEnd: running,
      pct: balanceStart > 0 ? (d.total / balanceStart) * 100 : 0,
      winRate: d.trades ? d.wins / d.trades : 0,
    });
  }

  const ddDeals = dd.peakTime != null ? events.filter((e) => e.time > dd.peakTime && e.time <= dd.troughTime) : [];

  return {
    events,
    stats,
    curve,
    dd,
    final,
    months: Object.values(months).sort((a, b) => a.key.localeCompare(b.key)),
    days: dayList,
    worstDays: [...dayList].sort((a, b) => a.total - b.total).filter((d) => d.total < 0).slice(0, 15),
    ddDeals,
    start,
    from: events[0].time,
    to: events[events.length - 1].time,
  };
}

export function reportSummary(r) {
  const s = tradeStats(r.deals);
  const { dd } = drawdownWalk(r.deals, r.initialDeposit);
  return { ...s, dd, from: r.deals[0].time, to: r.deals[r.deals.length - 1].time };
}

export const REPORT_COLORS = ["#06B6D4", "#F59E0B", "#A78BFA", "#F472B6", "#34D399", "#FB923C", "#60A5FA", "#E879F9"];
