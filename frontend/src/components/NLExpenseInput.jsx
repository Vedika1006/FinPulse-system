import { useState, useRef } from "react";
import API from "../api/axios";
import { addExpense } from "../api/expenses";
import { useToast } from "./ToastProvider";
import { Sparkles, Loader2, Mic, MicOff } from "lucide-react";

const NLExpenseInput = ({ onExpenseAdded }) => {
  const [text,    setText]    = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  // ── Voice recognition state ──────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      showToast("Voice input works best in Chrome on desktop", "error");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang            = "en-IN";
    recognition.continuous      = false;
    recognition.interimResults  = true;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const current    = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      setText(transcript);
    };

    recognition.onend = () => setIsListening(false);

    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  // ── Existing submit logic (unchanged) ────────────────────
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
      showToast(`Added: ${parsedData.description} (₹${Number(parsedData.amount).toLocaleString("en-IN")})`, "success");
      setText("");
      if (onExpenseAdded) onExpenseAdded();
    } catch (err) {
      showToast(err.response?.data?.detail || err.message || "Failed to parse expense", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex w-full gap-2">
        <div className="relative flex-1">
          {/* Left icon */}
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Sparkles className="h-4 w-4 text-purple-500" aria-hidden />
          </div>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. spent ₹300 on Zomato yesterday"
            disabled={loading}
            className="block w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-10 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 dark:border-white/[0.08] dark:bg-app-surface/80 dark:text-white dark:placeholder:text-app-muted dark:focus:border-purple-500/50"
          />

          {/* Mic button — right side of input */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
            <button
              type="button"
              title="Click to speak your expense"
              aria-label={isListening ? "Stop listening" : "Click to speak your expense"}
              onClick={isListening ? stopListening : startListening}
              disabled={loading}
              className="relative flex h-6 w-6 items-center justify-center rounded-full transition disabled:opacity-40"
            >
              {/* Pulsing red ring — only when listening */}
              {isListening && (
                <span
                  className="absolute inset-0 rounded-full bg-red-400 animate-pulse"
                  aria-hidden
                />
              )}
              {isListening ? (
                <MicOff className="relative z-10 h-3.5 w-3.5 text-red-400" aria-hidden />
              ) : (
                <Mic className="h-3.5 w-3.5 text-gray-400 dark:text-app-muted" aria-hidden />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "AI Add"}
        </button>
      </form>

      {/* Listening indicator */}
      {isListening && (
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" aria-hidden />
          <span className="text-xs text-gray-400 dark:text-app-muted">
            Listening… speak your expense in English or Hindi-English mix
          </span>
        </div>
      )}
    </div>
  );
};

export default NLExpenseInput;
