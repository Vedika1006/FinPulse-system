import React, { useState, useEffect } from 'react';
import API from '../api/axios';

const AnomalyAlerts = () => {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnomalies = async () => {
      try {
        const response = await API.get('/analytics/anomalies');
        setAnomalies(response.data?.anomalies || []);
      } catch (error) {
        console.error("Failed to fetch anomalies", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnomalies();
  }, []);

  if (loading) {
    return <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 animate-pulse h-48 w-full dark:bg-[#171A35] dark:border-white/10"></div>;
  }

  if (anomalies.length === 0) {
    return null; // Don't show if no anomalies exist
  }

  const getSeverityStyles = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return { icon: '🔥', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-500/20', text: 'text-red-700 dark:text-red-300', badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' };
      case 'medium':
        return { icon: '⚠️', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200' };
      case 'low':
      default:
        return { icon: '🔍', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-500/20', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' };
    }
  };

  return (
    <div className="p-6 rounded-2xl shadow-sm border border-gray-200 bg-white dark:bg-[#171A35] dark:border-white/10 w-full mb-6 font-sans">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <span>🚨</span> Unusual Spending Detected
      </h3>
      
      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
        {anomalies.map((anomaly, idx) => {
          const styles = getSeverityStyles(anomaly.severity);
          return (
            <div key={idx} className={`p-4 rounded-xl border ${styles.bg} ${styles.border} flex flex-col sm:flex-row sm:items-center gap-4 transition-all hover:scale-[1.01]`}>
              <div className="text-3xl shrink-0">{styles.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-extrabold text-lg text-gray-900 dark:text-white">₹{anomaly.amount.toLocaleString()}</span>
                  <span className="text-sm font-medium text-gray-600 dark:text-[#9AA3B2]">on {anomaly.category}</span>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full ${styles.badge}`}>
                    {anomaly.severity}
                  </span>
                </div>
                <p className={`text-sm font-semibold mb-1 ${styles.text}`}>
                  {anomaly.reason}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Date: {anomaly.date}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnomalyAlerts;
