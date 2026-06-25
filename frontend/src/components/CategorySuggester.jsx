import { useEffect, useState, useRef } from "react";
import axios from "../api/axios";

/**
 * Drop this anywhere inside your Add Expense form.
 * Props:
 *   merchant    — string (controlled input value for merchant/description)
 *   onSuggest   — fn({ category, confidence, method }) called when suggestion arrives
 */
export default function CategorySuggester({ merchant, onSuggest }) {
  const [suggestion, setSuggestion] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!merchant || merchant.length < 2) {
      setSuggestion(null);
      return;
    }

    // Debounce — wait 600ms after user stops typing before calling API
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await axios.post("/expenses/categorize", {
          merchant,
          description: merchant,
        });
        setSuggestion(data);
        onSuggest(data);
      } catch {
        // silent fail — user can still pick manually
      }
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [merchant]);

  if (!suggestion) return null;

  const confidencePct = Math.round(suggestion.confidence * 100);
  const colorMap = {
    faiss: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    groq:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    fallback: "bg-gray-100 text-gray-500",
  };

  return (
    <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium mt-1 ${colorMap[suggestion.method]}`}>
      <span>✦ Auto: {suggestion.category}</span>
      <span className="opacity-60">({confidencePct}%)</span>
      {suggestion.method === "groq" && (
        <span className="opacity-50 text-[10px]">via AI</span>
      )}
    </div>
  );
}