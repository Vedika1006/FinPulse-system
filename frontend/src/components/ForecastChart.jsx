import { useState, useEffect } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import API from "../api/axios";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: ₹{Number(p.value).toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
};

export default function ForecastChart() {
  const [data, setData] = useState(null);
  const [view, setView] = useState("7");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    API.get("/analytics/forecast")
      .then((res) => setData(res.data))
      .catch(() => setError("Could not load forecast."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
        Loading forecast…
      </div>
    );
  }

  if (error || !data || data.method === "no_data") {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
        {error || "Add more expenses to unlock spending forecasts."}
      </div>
    );
  }

  const forecastList = view === "7" ? data.forecast_7 : data.forecast_30;

  const recentHistory = (data.history || []).slice(-14).map((h) => ({
    ds: h.ds,
    actual: h.y,
  }));

  const todayLabel = recentHistory[recentHistory.length - 1]?.ds;

  const forecastPoints = forecastList.map((f) => ({
    ds: f.ds,
    yhat: f.yhat,
    yhat_lower: f.yhat_lower,
    yhat_upper: f.yhat_upper,
    band: [f.yhat_lower, f.yhat_upper],
  }));

  const chartData = [...recentHistory, ...forecastPoints];

  const methodLabel =
    data.method === "prophet" ? "Prophet ML Forecast" : "Rolling Average Forecast";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Spending Forecast
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {methodLabel} · 80% confidence interval
          </p>
        </div>

        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {["7", "30"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${
                view === v
                  ? "bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {v}d
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />

          <XAxis
            dataKey="ds"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickFormatter={(v) => {
              const d = new Date(v);
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
            interval="preserveStartEnd"
          />

          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            width={52}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            formatter={(value) =>
              value === "actual"
                ? "Actual Spend"
                : value === "yhat"
                  ? "Forecast"
                  : "Confidence Band"
            }
          />

          {todayLabel ? (
            <ReferenceLine
              x={todayLabel}
              stroke="#6366f1"
              strokeDasharray="4 4"
              label={{ value: "Today", position: "top", fontSize: 10, fill: "#6366f1" }}
            />
          ) : null}

          <Area
            type="monotone"
            dataKey="band"
            name="Confidence Band"
            fill="#6366f1"
            fillOpacity={0.08}
            stroke="none"
            legendType="rect"
          />

          <Line
            type="monotone"
            dataKey="actual"
            name="actual"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />

          <Line
            type="monotone"
            dataKey="yhat"
            name="yhat"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {forecastList.length > 0 ? (
        <div className="flex gap-3 mt-4 flex-wrap">
          <div className="flex-1 min-w-[120px] bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">
              Next {view}d Total
            </p>
            <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
              ₹
              {forecastList
                .reduce((s, f) => s + f.yhat, 0)
                .toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="flex-1 min-w-[120px] bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">
              Avg / Day
            </p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              ₹
              {(
                forecastList.reduce((s, f) => s + f.yhat, 0) / forecastList.length
              ).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="flex-1 min-w-[120px] bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-500 dark:text-amber-400 font-medium">
              Worst Case
            </p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
              ₹
              {forecastList
                .reduce((s, f) => s + f.yhat_upper, 0)
                .toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
