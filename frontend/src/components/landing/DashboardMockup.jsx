// Static recreation of the real FinPulse Dashboard, wrapped in a styled
// "browser window" frame. Pure CSS/SVG — no screenshots, no image assets.

const HEALTH_SCORE = 64; // "Fair" band (40-70), matches HeroBanner's healthColor logic
const INCOME = 85000;
const EXPENSES = 41121;
const SAVINGS = INCOME - EXPENSES;

const healthTone = HEALTH_SCORE > 70 ? "emerald" : HEALTH_SCORE > 40 ? "amber" : "red";
const healthLabel = HEALTH_SCORE > 70 ? "Good" : HEALTH_SCORE > 40 ? "Fair" : "Needs attention";

const TONE_TEXT = { emerald: "text-emerald-400", amber: "text-amber-400", red: "text-red-400" };
const TONE_BORDER = { emerald: "border-emerald-500/30", amber: "border-amber-500/30", red: "border-red-500/30" };
const TONE_BG = { emerald: "bg-emerald-500/10", amber: "bg-amber-500/10", red: "bg-red-500/10" };

export default function DashboardMockup() {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0D1420] shadow-[0_32px_80px_-12px_rgba(0,0,0,0.7)] sm:max-w-lg lg:max-w-none">
      {/* Browser bar */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#080C14] px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <div className="flex-1 rounded-md bg-white/[0.04] px-3 py-1 text-center font-mono text-[9px] text-gray-500">
          app.finpulse.in/dashboard
        </div>
      </div>

      {/* Mini dashboard */}
      <div className="space-y-2.5 p-3.5">
        {/* Greeting + health score, mirrors HeroBanner */}
        <div className="rounded-xl border border-white/[0.05] bg-[#112030] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[8px] font-medium uppercase tracking-wider text-gray-500">Good evening</p>
              <p className="mt-0.5 text-sm font-semibold text-white">Vedika</p>
            </div>
            <div className="text-right">
              <p className="text-[7px] font-medium uppercase tracking-wider text-gray-500">Health score</p>
              <p className={`font-mono text-2xl font-bold leading-none ${TONE_TEXT[healthTone]}`}>{HEALTH_SCORE}</p>
              <p className={`mt-0.5 text-[8px] font-semibold ${TONE_TEXT[healthTone]}`}>{healthLabel}</p>
            </div>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full ${TONE_BG[healthTone].replace("/10", "")}`} style={{ width: `${HEALTH_SCORE}%` }} />
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Income", `₹${INCOME.toLocaleString("en-IN")}`, "text-emerald-400"],
            ["Expenses", `₹${EXPENSES.toLocaleString("en-IN")}`, "text-orange-400"],
            ["Savings", `₹${SAVINGS.toLocaleString("en-IN")}`, "text-cyan-400"],
          ].map(([lbl, val, cls]) => (
            <div key={lbl} className="rounded-lg border border-white/[0.05] bg-[#112030] p-2">
              <p className="text-[7px] font-semibold uppercase tracking-wider text-gray-500">{lbl}</p>
              <p className={`mt-0.5 font-mono text-[11px] font-bold ${cls}`}>{val}</p>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="rounded-xl border border-white/[0.05] bg-[#112030] p-2.5">
          <p className="mb-2 text-[8px] font-semibold uppercase tracking-wider text-gray-500">Monthly Trend</p>
          <svg viewBox="0 0 220 44" className="w-full" height="36">
            {[
              [6, 30, "#06B6D4"],
              [44, 38, "#F97316"],
              [82, 22, "#06B6D4"],
              [120, 44, "#06B6D4"],
              [158, 34, "#F97316"],
              [196, 40, "#06B6D4"],
            ].map(([x, h, c], i) => (
              <rect key={i} x={x} y={44 - h} width="18" height={h} rx="2" fill={c} fillOpacity="0.75" />
            ))}
          </svg>
        </div>

        {/* Anomaly alert strip */}
        <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${TONE_BG.amber}`}>
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
          <p className="text-[8px] font-medium text-amber-300">
            Unusual spend: ₹12,000 on Shopping — 3.8x your usual
          </p>
        </div>
      </div>
    </div>
  );
}
