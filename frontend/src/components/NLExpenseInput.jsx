import { useState } from "react";
import API from "../api/axios";
import { addExpense } from "../api/expenses";
import { useToast } from "./ToastProvider";
import { Sparkles, Loader2 } from "lucide-react";

const NLExpenseInput = ({ onExpenseAdded }) => {
  const [text,    setText]    = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const parseRes   = await API.post("/ai/parse-expense", { text });
      const parsedData = parseRes.data;
      if (isNaN(parsedData.amount) || parsedData.amount <= 0) {
        throw new Error("Could not parse a valid amount. Please be more specific.");
      }
      await addExpense({
        category:    parsedData.category,
        amount:      parsedData.amount,
        description: parsedData.description,
        date:        parsedData.date ? new Date(parsedData.date).toISOString() : null,
      });
      showToast(`Added: ${parsedData.description} (₹${parsedData.amount})`, "success");
      setText("");
      if (onExpenseAdded) onExpenseAdded();
    } catch (err) {
      showToast(err.response?.data?.detail || err.message || "Failed to parse expense", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Sparkles className="h-4 w-4 text-purple-500" aria-hidden />
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. spent ₹300 on Zomato yesterday"
          disabled={loading}
          className="block w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 dark:border-white/[0.08] dark:bg-app-surface/80 dark:text-white dark:placeholder:text-app-muted dark:focus:border-purple-500/50"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "AI Add"}
      </button>
    </form>
  );
};

export default NLExpenseInput;
