import { useState, useEffect } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import API from "../api/axios";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  // The confidence band Area stores [yhat_lower, yhat_upper] as its value.
  // Number([lower, upper]) = NaN. Filter it out — the shaded area is
  // self-explanatory visually and doesn't need a tooltip entry.
  const items = payload.filter((p) => p.dataKey !== "band");
  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-lg dark:border-white/[0.08] dark:bg-app-surface dark:text-white">
      <p className="mb-1.5 font-semibold text-gray-700 dark:text-app-subtle">{label}</p>
      {items.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.dataKey === "actual" ? "Actual spend" : "Forecast"}:{" "}
          ₹{Number(p.value).toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
};

export default function ForecastChart() {
  const [data,    setData]    = useState(null);
  const [view,    setView]    = useState("7");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    API.get("/analytics/forecast")
      .then((res) => setData(res.data))
      .catch(() => setError("Could not load forecast."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400 dark:text-app-muted">
        Loading forecast…
      </div>
    );
  }

  if (error || !data || data.method === "no_data") {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400 dark:text-app-muted">
        {error || "Add more expenses to unlock spending forecasts."}
      </div>
    );
  }

  const forecastList   = view === "7" ? data.forecast_7 : data.forecast_30;
  const recentHistory  = (data.history || []).slice(-14).map((h) => ({ ds: h.ds, actual: h.y }));
  const todayLabel     = recentHistory[recentHistory.length - 1]?.ds;
  const forecastPoints = forecastList.map((f) => ({
    ds:         f.ds,
    yhat:       f.yhat,
    yhat_lower: f.yhat_lower,
    yhat_upper: f.yhat_upper,
    band:       [f.yhat_lower, f.yhat_upper],
  }));
  const chartData   = [...recentHistory, ...forecastPoints];
  const methodLabel = data.method === "prophet" ? "Prophet ML Forecast" : "Rolling Average Forecast";

  return (
    <div className="h-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">Spending Forecast</h3>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-app-muted">
            {methodLabel} · 80% confidence interval
          </p>
        </div>
        {/* Toggle — dark:bg-app-card */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-app-card">
          {["7", "30"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                view === v
                  ? "bg-white text-cyan-600 shadow-sm dark:bg-app-surface dark:text-cyan-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-app-muted dark:hover:text-app-subtle"
              }`}
            >
              {v}d
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
          <XAxis
            dataKey="ds"
            tick={{ fontSize: 10, fill: "#94A3B8" }}
            tickFormatter={(v) => {
              const d = new Date(v);
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94A3B8" }}
            tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: "#94A3B8" }}
            formatter={(value) =>
              value === "actual" ? "Actual Spend" : value === "yhat" ? "Forecast" : "Confidence Band"
            }
          />
          {todayLabel && (
            <ReferenceLine
              x={todayLabel}
              stroke="#06B6D4"
              strokeDasharray="4 4"
              label={{ value: "Today", position: "top", fontSize: 10, fill: "#06B6D4" }}
            />
          )}
          <Area type="monotone" dataKey="band" name="Confidence Band"
            fill="#06B6D4" fillOpacity={0.07} stroke="none" legendType="rect" />
          <Line type="monotone" dataKey="actual" name="actual"
            stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
          <Line type="monotone" dataKey="yhat" name="yhat"
            stroke="#06B6D4" strokeWidth={2} strokeDasharray="5 4"
            dot={false} activeDot={{ r: 4 }} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {forecastList.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            { label: `Next ${view}d Total`, value: forecastList.reduce((s, f) => s + f.yhat, 0), color: "indigo" },
            { label: "Avg / Day",           value: forecastList.reduce((s, f) => s + f.yhat, 0) / forecastList.length, color: "emerald" },
            { label: "Worst Case",          value: forecastList.reduce((s, f) => s + f.yhat_upper, 0), color: "amber" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`flex-1 min-w-[110px] rounded-xl bg-${color}-50 p-3 text-center dark:bg-${color}-900/20`}>
              <p className={`text-xs font-medium text-${color}-500 dark:text-${color}-400`}>{label}</p>
              <p className={`mt-0.5 text-lg font-bold text-${color}-700 dark:text-${color}-300`}>
                ₹{value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
