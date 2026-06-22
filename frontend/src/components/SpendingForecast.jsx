import React, { useState, useEffect } from 'react';
import API from '../api/axios';

const SpendingForecast = ({ income = 0 }) => {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const response = await API.get(`/analytics/forecast?income=${income}`);
        setForecast(response.data);
      } catch (error) {
        console.error("Failed to fetch spending forecast", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchForecast();
  }, [income]);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-2xl shadow-lg border border-gray-100 animate-pulse h-64 w-full max-w-md mx-auto dark:bg-[#171A35] dark:border-white/10"></div>
    );
  }

  if (!forecast) return null;

  const {
    current_spend,
    predicted_spend,
    daily_avg,
    safe_daily_limit
  } = forecast;

  const isOverspending = predicted_spend > income && income > 0;
  const progressPercentage = predicted_spend > 0 
    ? Math.min((current_spend / predicted_spend) * 100, 100) 
    : 0;

  return (
    <div className="p-6 bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-md mx-auto font-sans dark:bg-[#171A35] dark:border-white/10 flex flex-col h-full">
      <h3 className="text-xl font-bold text-gray-800 mb-6 dark:text-white">Monthly Spending Forecast</h3>
      
      <div className="space-y-6 flex-1 flex flex-col justify-between">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 dark:bg-[#1E2247] dark:border-white/10 flex flex-col justify-center">
            <p className="text-xs font-medium text-gray-500 mb-1 dark:text-[#9AA3B2]">Current Spend</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">₹{current_spend.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 dark:bg-[#1E2247] dark:border-white/10 flex flex-col justify-center">
            <p className="text-xs font-medium text-gray-500 mb-1 dark:text-[#9AA3B2]">Daily Avg</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">₹{daily_avg.toFixed(0).toLocaleString()}</p>
          </div>
        </div>

        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-500/20">
          <p className="text-sm font-medium text-indigo-800 mb-1 dark:text-indigo-300">Predicted Month-End Spend</p>
          <p className="text-3xl font-black text-indigo-900 dark:text-indigo-100">₹{predicted_spend.toLocaleString()}</p>
          
          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-indigo-600 dark:text-indigo-300">Progress</span>
              <span className="text-indigo-600 dark:text-indigo-300">{progressPercentage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-indigo-200/50 rounded-full h-2 dark:bg-indigo-800/50">
              <div 
                className="bg-indigo-600 h-2 rounded-full dark:bg-indigo-400" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 dark:bg-[#1E2247] dark:border-white/10">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1 dark:text-[#9AA3B2]">Safe Daily Limit</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">₹{safe_daily_limit.toFixed(0).toLocaleString()}</p>
          </div>
        </div>

        <div className={`p-4 rounded-xl text-center text-sm font-bold transition-colors mt-auto ${
          isOverspending 
            ? 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-500/30' 
            : 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-500/30'
        }`}>
          {isOverspending ? "⚠️ You are likely to overspend this month" : "✅ You are on track"}
        </div>
      </div>
    </div>
  );
};

export default SpendingForecast;
