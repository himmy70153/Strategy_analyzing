import { Fragment, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Rows3 } from "lucide-react";
import { money } from "../lib/portfolio";
import {
  WEEKDAYS,
  buildMonthModel,
  heatStyle,
  monthLabel,
  monthRange,
  rangeLabel,
  shortMoney,
  shortPct,
  shiftMonth,
  toneOf,
} from "../lib/calendar";
import { DealList } from "./WorstDays";

const Seg = ({ options, value, onChange, testId, label }) => (
  <div className="flex items-stretch border border-slate-700">
    {label ? <span className="qf-label flex items-center px-2 border-r border-slate-700">{label}</span> : null}
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        data-testid={`${testId}-${o.value}`}
        aria-pressed={value === o.value}
        onClick={() => onChange(o.value)}
        className={`px-3 py-1.5 text-xs font-mono transition-colors ${value === o.value ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const DayCell = ({ cell, day, maxAbs, unit, active, onSelect }) => {
  const value = day ? (unit === "usd" ? shortMoney(day.total) : shortPct(day.pct)) : null;
  const sub = day ? (unit === "usd" ? shortPct(day.pct) : shortMoney(day.total)) : null;
  return (
    <button
      type="button"
      data-testid={`calendar-day-${cell.key}`}
      onClick={() => day && onSelect(day.key)}
      disabled={!day}
      title={
        day
          ? `${day.day}  ·  ${day.deals.length} deals / ${day.trades} trades (W${day.wins} L${day.losses})\nP&L ${money(day.total, true)}  ·  ${shortPct(day.pct)}  ·  balance ${money(day.balanceEnd)}`
          : `${cell.key}  ·  no trades`
      }
      className={`relative flex h-[78px] flex-col justify-between overflow-hidden px-2 py-1.5 text-left border transition-colors ${
        active ? "border-cyan-400" : "border-slate-800/70"
      } ${day ? "hover:border-cyan-500/70" : "cursor-default"} ${cell.weekend ? "bg-slate-900/50" : "bg-slate-900/20"}`}
      style={day ? heatStyle(day.total, maxAbs) : undefined}
    >
      <span className="flex w-full items-center justify-between">
        <span className={`font-mono text-[11px] ${day ? "text-slate-300" : "text-slate-600"}`}>{cell.dayNum}</span>
        {day ? <span className="font-mono text-[10px] text-slate-400">{day.trades}t</span> : null}
      </span>
      {day ? (
        <span className="w-full">
          <span className={`block whitespace-nowrap font-mono text-[15px] font-bold leading-tight ${toneOf(day.total)}`}>{value}</span>
          <span className="block whitespace-nowrap font-mono text-[10px] text-slate-400">{sub}</span>
        </span>
      ) : (
        <span className="font-mono text-[11px] text-slate-700">—</span>
      )}
    </button>
  );
};

const Stat = ({ label, value, sub, tone }) => (
  <div className="border border-slate-800 bg-slate-900/40 px-3 py-2">
    <div className="qf-label text-[10px]">{label}</div>
    <div className={`mt-0.5 font-mono text-sm font-bold ${tone || "text-slate-100"}`}>{value}</div>
    {sub ? <div className="mt-0.5 font-mono text-[10px] text-slate-500">{sub}</div> : null}
  </div>
);

export const ProfitCalendar = ({ p, colorOf }) => {
  const [mode, setMode] = useState("days");
  const [unit, setUnit] = useState("usd");
  const [selected, setSelected] = useState(null);
  const [openWeek, setOpenWeek] = useState(null);

  // Every month that has at least one deal, plus the empty months in between so the
  // cursor can be walked across the whole uploaded backtest range.
  const months = useMemo(() => {
    const keys = (p.days || []).map((d) => d.key.slice(0, 7)).sort();
    if (!keys.length) return [];
    return monthRange(keys[0], keys[keys.length - 1]);
  }, [p]);

  const [cursor, setCursor] = useState(() => months[months.length - 1] || monthRange("2026-01", "2026-01")[0]);

  useEffect(() => {
    if (!months.length) return;
    setCursor((c) => (months.includes(c) ? c : months[months.length - 1]));
  }, [months]);

  const y = +cursor.slice(0, 4);
  const m = +cursor.slice(5, 7) - 1;
  const model = useMemo(() => buildMonthModel(p, y, m), [p, y, m]);
  const { summary } = model;
  const canPrev = months.length > 0 && cursor > months[0];
  const canNext = months.length > 0 && cursor < months[months.length - 1];

  const go = (delta) => {
    const next = shiftMonth(y, m, delta);
    setCursor(`${next.y}-${String(next.m + 1).padStart(2, "0")}`);
    setSelected(null);
    setOpenWeek(null);
  };

  const selectedDay = selected ? model.dayMap.get(selected) : null;
  const monthPnl = summary.total;
  // Bar scale for the weekly table: the biggest absolute week of this month.
  const maxWeekAbs = Math.max(1e-9, ...model.weeks.map((w) => Math.abs(w.total)));

  return (
    <div data-testid="profit-calendar-container" className="qf-card qf-rise p-5" style={{ animationDelay: "220ms" }}>
      {/* ── header ─────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-semibold text-slate-100 md:text-lg">Profit Calendar</h2>
          <p className="qf-label mt-1">
            {mode === "days" ? "Daily P&L, all enabled reports merged" : "Weekly P&L, days combined per week"}
            {" · "}
            {p.days?.length ? `${p.days[0].day} → ${p.days[p.days.length - 1].day}` : "no data"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Seg
            testId="calendar-unit-toggle"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "usd", label: "$" },
              { value: "pct", label: "%" },
            ]}
          />
          <Seg
            testId="calendar-mode-toggle"
            value={mode}
            onChange={setMode}
            options={[
              { value: "days", label: "Days" },
              { value: "weeks", label: "Weeks" },
            ]}
          />
          <div className="flex items-stretch border border-slate-700">
            <button
              type="button"
              data-testid="calendar-prev-month"
              aria-label="Previous month"
              onClick={() => go(-1)}
              disabled={!canPrev}
              title="Previous month"
              className="px-1.5 text-slate-400 hover:text-cyan-300 disabled:cursor-default disabled:opacity-25 disabled:hover:text-slate-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <select
              data-testid="calendar-month-select"
              aria-label="Calendar month"
              value={cursor}
              onChange={(e) => {
                setCursor(e.target.value);
                setSelected(null);
                setOpenWeek(null);
              }}
              className="w-[104px] border-0 bg-transparent px-1 py-1.5 text-center font-mono text-xs text-slate-100 outline-none"
            >
              {months.map((k) => (
                <option key={k} value={k} className="bg-slate-900">
                  {monthLabel(+k.slice(0, 4), +k.slice(5, 7) - 1)}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="calendar-next-month"
              aria-label="Next month"
              onClick={() => go(1)}
              disabled={!canNext}
              title="Next month"
              className="px-1.5 text-slate-400 hover:text-cyan-300 disabled:cursor-default disabled:opacity-25 disabled:hover:text-slate-400"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── month strip ────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-slate-800 py-2">
        <span className="qf-label flex items-center gap-1.5">
          {mode === "days" ? <CalendarDays className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
          {monthLabel(y, m)} combined
        </span>
        <span data-testid="calendar-month-total" className={`font-mono text-lg font-bold ${toneOf(monthPnl)}`}>
          {money(monthPnl, true)}
        </span>
        <span className={`font-mono text-xs ${toneOf(monthPnl)}`}>{shortPct(summary.pct)}</span>
        <span className="font-mono text-[11px] text-slate-500">
          {summary.tradingDays} trading day{summary.tradingDays === 1 ? "" : "s"} · {summary.trades} trades · open {money(model.openBalance)}
        </span>
        {summary.tradingDays === 0 && (
          <span data-testid="calendar-empty-month" className="font-mono text-[11px] text-amber-400/80">
            No deals were closed in this month
          </span>
        )}
      </div>

      {/* ── days grid ──────────────────────────────────────────────────────── */}
      {mode === "days" && (
        <div className="overflow-x-auto">
          <div className="min-w-[740px]">
            <div className="mb-1 grid grid-cols-[repeat(7,minmax(0,1fr))_112px] gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="qf-label py-1 text-center text-[10px]">
                  {w}
                </div>
              ))}
              <div className="qf-label py-1 text-center text-[10px] text-cyan-400/80">Week</div>
            </div>

            {model.weeks.map((week) => (
              <div key={week.index} data-testid={`calendar-week-row-${week.index}`} className="mb-1 grid grid-cols-[repeat(7,minmax(0,1fr))_112px] gap-1">
                {week.cells.map((cell, ci) =>
                  cell ? (
                    <DayCell
                      key={cell.key}
                      cell={cell}
                      day={model.dayMap.get(cell.key)}
                      maxAbs={model.maxAbs}
                      unit={unit}
                      active={selected === cell.key}
                      onSelect={setSelected}
                    />
                  ) : (
                    <div key={`pad-${week.index}-${ci}`} className="h-[78px] border border-transparent bg-slate-900/20" />
                  ),
                )}

                <button
                  type="button"
                  data-testid={`calendar-week-total-${week.index}`}
                  onClick={() => {
                    setMode("weeks");
                    setOpenWeek(week.index);
                  }}
                  title={`${week.label} · ${rangeLabel(week.startKey, week.endKey)} · click for the week breakdown`}
                  className="flex h-[78px] flex-col justify-between overflow-hidden border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-left transition-colors hover:border-cyan-500/60"
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-cyan-400/80">{week.label}</span>
                    <span className="font-mono text-[9px] text-slate-500">{rangeLabel(week.startKey, week.endKey)}</span>
                  </span>
                  <span className="w-full">
                    <span className={`block font-mono text-[15px] font-bold leading-tight ${toneOf(week.total)}`}>
                      {week.tradingDays ? (unit === "usd" ? shortMoney(week.total) : shortPct(week.pct)) : "—"}
                    </span>
                    <span className="block font-mono text-[10px] text-slate-500">
                      {week.tradingDays ? `${week.tradingDays}d · ${week.trades}t` : "no trades"}
                    </span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── weeks table ────────────────────────────────────────────────────── */}
      {mode === "weeks" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-slate-800">
              <tr>
                {["Week", "Period", "Trading days", "Trades", "Win / loss days", "Week return"].map((h) => (
                  <th key={h} className="qf-label px-2 py-2 text-left font-medium text-[9px]">
                    {h}
                  </th>
                ))}
                <th className="qf-label px-2 py-2 text-right font-medium text-[9px]">Week P&L</th>
              </tr>
            </thead>
            <tbody>
              {model.weeks.map((week) => {
                const share = week.tradingDays ? Math.min(100, (Math.abs(week.total) / maxWeekAbs) * 100) : 0;
                const open = openWeek === week.index;
                return (
                  <Fragment key={week.index}>
                    <tr
                      data-testid={`calendar-week-summary-${week.index}`}
                      onClick={() => setOpenWeek(open ? null : week.index)}
                      className={`cursor-pointer border-b border-slate-800/60 transition-colors hover:bg-slate-800/30 ${open ? "bg-slate-800/20" : ""}`}
                    >
                      <td className="px-2 py-2.5">
                        <span className="flex items-center gap-1.5 font-mono text-xs text-slate-200">
                          <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${open ? "" : "-rotate-90"}`} />
                          {week.label}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 font-mono text-xs text-slate-400">{rangeLabel(week.startKey, week.endKey)}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs text-slate-300">{week.tradingDays}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs text-slate-300">{week.trades}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs">
                        <span className="text-emerald-400">{week.winDays}</span>
                        <span className="text-slate-600"> / </span>
                        <span className="text-red-400">{week.lossDays}</span>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-slate-800">
                            <div
                              className={`h-full ${week.total >= 0 ? "bg-emerald-400/80" : "bg-red-400/80"}`}
                              style={{ width: `${share.toFixed(1)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono text-[10px] text-slate-500">{shortPct(week.pct)}</span>
                        </div>
                      </td>
                      <td className={`px-2 py-2.5 text-right font-mono text-xs font-bold ${toneOf(week.total)}`}>{money(week.total, true)}</td>
                    </tr>
                    {open && (
                      <tr className="border-b border-slate-800/60 bg-black/30">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {week.days.length ? (
                              week.days.map((d) => (
                                <button
                                  key={d.key}
                                  type="button"
                                  data-testid={`calendar-week-day-${d.key}`}
                                  onClick={() => setSelected(d.key)}
                                  className="group flex flex-col items-start border border-slate-800 px-2 py-1 text-left transition-colors hover:border-cyan-500/70"
                                  style={heatStyle(d.total, model.maxAbs)}
                                >
                                  <span className="font-mono text-[10px] text-slate-400">{d.day}</span>
                                  <span className={`font-mono text-[11px] font-bold ${toneOf(d.total)}`}>
                                    {unit === "usd" ? shortMoney(d.total) : shortPct(d.pct)}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <span className="font-mono text-[11px] text-slate-600">No deals closed in this week.</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr>
                <td className="px-2 py-2.5">
                  <span className="qf-label">Month</span>
                  <span className="ml-1.5 font-mono text-[10px] text-slate-500">{model.weeks.length}w</span>
                </td>
                <td className="px-2 py-2.5 font-mono text-[11px] text-slate-500">
                  {model.days.length ? rangeLabel(model.days[0].key, model.days[model.days.length - 1].key) : "—"}
                </td>
                <td className="px-2 py-2.5 text-right font-mono text-xs text-slate-300">{summary.tradingDays}</td>
                <td className="px-2 py-2.5 text-right font-mono text-xs text-slate-300">{summary.trades}</td>
                <td className="px-2 py-2.5 text-right font-mono text-xs">
                  <span className="text-emerald-400">{summary.winDays}</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-red-400">{summary.lossDays}</span>
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1" />
                    <span className={`w-10 text-right font-mono text-[10px] ${toneOf(summary.pct)}`}>{shortPct(summary.pct)}</span>
                  </div>
                </td>
                <td className={`px-2 py-2.5 text-right font-mono text-xs font-bold ${toneOf(summary.total)}`}>{money(summary.total, true)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── month stats ────────────────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Month P&L"
          value={money(summary.total, true)}
          tone={toneOf(summary.total)}
          sub={`${shortPct(summary.pct)} · close ${money(model.closeBalance)}`}
        />
        <Stat
          label="Trading days"
          value={`${summary.tradingDays} / ${summary.totalDays}`}
          sub={`${summary.winDays}W · ${summary.lossDays}L · ${summary.flatDays} flat`}
        />
        <Stat
          label="Trades"
          value={summary.trades.toLocaleString()}
          sub={summary.trades ? `${(summary.tradeWinRate * 100).toFixed(1)}% win rate` : "no trades"}
        />
        <Stat
          label="Best day"
          value={summary.best ? shortMoney(summary.best.total) : "—"}
          tone={summary.best ? "text-emerald-300" : "text-slate-500"}
          sub={summary.best ? `${summary.best.day} · ${shortPct(summary.best.pct)}` : "—"}
        />
        <Stat
          label="Worst day"
          value={summary.worst ? shortMoney(summary.worst.total) : "—"}
          tone={summary.worst ? "text-red-300" : "text-slate-500"}
          sub={summary.worst ? `${summary.worst.day} · ${shortPct(summary.worst.pct)}` : "—"}
        />
        <Stat
          label="Avg / trading day"
          value={summary.tradingDays ? shortMoney(summary.avg) : "—"}
          tone={summary.tradingDays ? toneOf(summary.avg) : "text-slate-500"}
          sub={`${(summary.dayWinRate * 100).toFixed(0)}% green days`}
        />
      </div>

      {/* ── selected day drill-down ────────────────────────────────────────── */}
      {selectedDay && (
        <div data-testid="calendar-day-detail" className="mt-4 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/70 px-3 py-2">
            <span className="font-mono text-xs text-slate-100">
              {selectedDay.day} <span className="text-slate-500">· {selectedDay.deals.length} deals</span>
            </span>
            <span className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
              <span className={toneOf(selectedDay.total)}>P&L {money(selectedDay.total, true)}</span>
              <span>{shortPct(selectedDay.pct)}</span>
              <span>
                {selectedDay.trades} trades · W{selectedDay.wins}/L{selectedDay.losses}
              </span>
              <span>balance {money(selectedDay.balanceEnd)}</span>
              <button
                type="button"
                data-testid="calendar-day-detail-close"
                onClick={() => setSelected(null)}
                className="text-slate-500 transition-colors hover:text-cyan-300"
              >
                close
              </button>
            </span>
          </div>
          <DealList deals={selectedDay.deals} colorOf={colorOf} />
        </div>
      )}
    </div>
  );
};
