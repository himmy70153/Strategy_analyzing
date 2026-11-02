import { useMemo, useState } from "react";
import "@/App.css";
import { Toaster, toast } from "sonner";
import { FlaskConical, Eraser } from "lucide-react";
import { parseMt5Report } from "./lib/mt5Parser";
import { buildPortfolio, reportSummary, REPORT_COLORS } from "./lib/portfolio";
import { Uploader } from "./components/Uploader";
import { KpiGrid } from "./components/KpiGrid";
import { EquityChart } from "./components/EquityChart";
import { ReportTable } from "./components/ReportTable";
import { MonthlyTable } from "./components/MonthlyTable";
import { WorstDays, DrawdownWindow } from "./components/WorstDays";
import { ProfitCalendar } from "./components/ProfitCalendar";

const SAMPLES = ["dynamic.html", "smc.html"];

function App() {
  const [reports, setReports] = useState([]);
  const [enabled, setEnabled] = useState({});
  const [balance, setBalance] = useState("1000");

  const addParsed = (parsed) => {
    if (!parsed.length) return;
    setReports((r) => [...r, ...parsed]);
    setEnabled((e) => ({ ...e, ...Object.fromEntries(parsed.map((p) => [p.id, true])) }));
    toast.success(`${parsed.length} report${parsed.length > 1 ? "s" : ""} analysed`);
  };

  const handleFiles = async (files) => {
    const out = [];
    for (const f of files) {
      try { out.push(parseMt5Report(await f.arrayBuffer(), f.name)); }
      catch (err) { toast.error(`${f.name}: ${err.message}`); }
    }
    addParsed(out);
  };

  const loadSamples = async () => {
    const out = [];
    for (const s of SAMPLES) {
      const buf = await (await fetch(`/samples/${s}`)).arrayBuffer();
      out.push(parseMt5Report(buf, s));
    }
    addParsed(out);
  };

  const summaries = useMemo(() => Object.fromEntries(reports.map((r) => [r.id, reportSummary(r)])), [reports]);
  const colorIdx = Object.fromEntries(reports.map((r, i) => [r.id, i]));
  const active = reports.filter((r) => enabled[r.id]).map((r) => ({ ...r, ci: colorIdx[r.id] }));
  const start = parseFloat(balance) || 0;
  const portfolio = useMemo(() => (active.length ? buildPortfolio(active, start) : null), [reports, enabled, start]); // eslint-disable-line react-hooks/exhaustive-deps
  const colorOf = (ri) => REPORT_COLORS[(active[ri]?.ci ?? 0) % REPORT_COLORS.length];

  return (
    <div className="qf-app min-h-screen">
      <Toaster theme="dark" position="bottom-right" />
      <header data-testid="header-bar" className="sticky top-0 z-30 border-b border-slate-800 bg-[#0B0F19]/80 backdrop-blur-lg">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-baseline gap-3 mr-auto">
            <span className="font-heading text-lg font-bold tracking-[0.2em] text-slate-50">QUANTFOLIO</span>
            <span className="qf-label hidden sm:inline">MT5 Portfolio Analyser</span>
          </div>
          <label className="flex items-center gap-2">
            <span className="qf-label">Start balance $</span>
            <input data-testid="portfolio-starting-balance-input" type="number" min="0" value={balance} onChange={(e) => setBalance(e.target.value)}
              className="w-28 bg-slate-900 border border-slate-700 px-2 py-1.5 font-mono text-sm text-slate-100 focus:outline-none focus:border-cyan-400" />
          </label>
          <button data-testid="load-sample-data-button" onClick={loadSamples}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300 transition-colors">
            <FlaskConical className="h-3.5 w-3.5" /> Load sample reports
          </button>
          {reports.length > 0 && (
            <button data-testid="clear-all-reports-button" onClick={() => { setReports([]); setEnabled({}); }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-slate-700 text-slate-400 hover:border-red-400 hover:text-red-300 transition-colors">
              <Eraser className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {reports.length === 0 ? (
          <section className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center pt-10">
            <div className="qf-rise">
              <p className="qf-label text-cyan-400 mb-4">Portfolio backtest merger</p>
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-50 leading-[1.05]">
                Combine MT5 backtests.<br /><span className="text-slate-500">See the real drawdown.</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-400 mt-6 max-w-xl leading-relaxed">
                Upload any number of Strategy Tester reports. Every deal from every strategy is replayed on one timeline —
                to the second — so when three systems hit stop-loss on the same afternoon, your drawdown shows it.
              </p>
            </div>
            <div className="qf-rise" style={{ animationDelay: "120ms" }}><Uploader onFiles={handleFiles} /></div>
          </section>
        ) : (
          <>
            <Uploader onFiles={handleFiles} compact />
            <ReportTable reports={reports} summaries={summaries} enabled={enabled}
              onToggle={(id) => setEnabled((e) => ({ ...e, [id]: !e[id] }))}
              onRemove={(id) => setReports((r) => r.filter((x) => x.id !== id))} />
            {portfolio ? (
              <>
                <KpiGrid p={portfolio} activeCount={active.length} />
                <EquityChart p={portfolio} />
                <DrawdownWindow p={portfolio} colorOf={colorOf} />
                <ProfitCalendar p={portfolio} colorOf={colorOf} />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  <MonthlyTable p={portfolio} reports={active} />
                  <WorstDays p={portfolio} colorOf={colorOf} />
                </div>
              </>
            ) : (
              <p data-testid="no-active-reports" className="text-sm text-slate-500">Enable at least one report to see the combined portfolio.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
