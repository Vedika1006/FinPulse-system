import React, { useState, useEffect } from 'react';
import API from '../api/axios';

const BehaviorCard = () => {
  const [behavior, setBehavior] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBehavior = async () => {
      try {
        const response = await API.get('/analytics/behavior');
        setBehavior(response.data);
      } catch (error) {
        console.error("Failed to fetch behavior", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBehavior();
  }, []);

  if (loading) {
    return <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 animate-pulse h-48 w-full dark:bg-[#171A35] dark:border-white/10"></div>;
  }

  if (!behavior) return null;

  const { type, savings_rate, top_category, insight } = behavior;

  const getStyles = () => {
    switch (type) {
      case "Saver":
        return { color: "text-green-700 dark:text-green-300", bg: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-500/20", icon: "🌱" };
      case "Impulse Spender":
        return { color: "text-red-700 dark:text-red-300", bg: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-500/20", icon: "⚡" };
      case "Lifestyle Creep":
        return { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-500/20", icon: "📈" };
      case "Balanced":
      default:
        return { color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-500/20", icon: "⚖️" };
    }
  };

  const styles = getStyles();

  return (
    <div className={`p-6 rounded-2xl shadow-sm border w-full flex flex-col font-sans transition-colors ${styles.bg}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xs font-bold text-gray-500 dark:text-[#9AA3B2] uppercase tracking-wider mb-2">Financial Fingerprint</h3>
          <p className={`text-2xl font-black ${styles.color} flex items-center gap-2`}>
            {styles.icon} {type}
          </p>
        </div>
      </div>
      
      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium mb-6 leading-relaxed flex-1">
        "{insight}"
      </p>

      <div className="grid grid-cols-2 gap-4 mt-auto">
        <div className="bg-white/60 dark:bg-black/25 p-3 rounded-xl border border-white/40 dark:border-white/10 text-center">
          <p className="text-xs font-semibold text-gray-500 dark:text-[#9AA3B2] mb-1">Savings Rate</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{(savings_rate * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-white/60 dark:bg-black/25 p-3 rounded-xl border border-white/40 dark:border-white/10 text-center">
          <p className="text-xs font-semibold text-gray-500 dark:text-[#9AA3B2] mb-1">Top Category</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white truncate" title={top_category}>{top_category}</p>
        </div>
      </div>
    </div>
  );
};

export default BehaviorCard;
