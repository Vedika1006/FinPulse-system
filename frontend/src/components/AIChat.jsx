import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, SendHorizonal } from "lucide-react";
import API from "../api/axios";
import FormattedAIResponse from "./FormattedAIResponse";

export default function AIChat() {
  const [open,    setOpen]    = useState(false);
  const [input,   setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hi! I'm your FinPulse assistant. Ask me about spending, savings, budgets, or next best actions.",
    },
  ]);
  const scrollerRef = useRef(null);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, open]);

  const sendMessage = async (overrideText) => {
    const text = (typeof overrideText === "string" ? overrideText : input).trim();
    if (!text || sending) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);
    try {
      const res   = await API.post("/ai/chat", { message: text });
      const reply = res.data?.reply || "I could not generate a response right now.";
      setMessages((prev) => [...prev, { role: "ai", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "AI chat is temporarily unavailable. Please try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating button — teal brand color */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-[#06080F] shadow-lg transition hover:bg-cyan-400"
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        AI Chat
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4 sm:p-6 dark:bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Chat panel */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex h-[560px] w-full max-w-md flex-col rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/[0.08] dark:bg-app-card"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-white/[0.08]">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    AI Financial Assistant
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-app-muted">
                    Ask about spending, savings, and budgets
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-900 dark:text-app-muted dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {/* Message list */}
              <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((m, idx) => (
                  <div
                    key={`${m.role}-${idx}`}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-cyan-500 text-[#06080F]"
                          : "border border-gray-200 bg-gray-50 text-gray-800 dark:border-white/[0.08] dark:bg-app-surface dark:text-app-subtle"
                      }`}
                    >
                      {m.role === "ai" ? <FormattedAIResponse text={m.text} /> : m.text}
                    </div>
                  </div>
                ))}

                {/* Quick-start chips — only shown on first load */}
                {messages.length <= 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      "What's my financial health score?",
                      "Where am I overspending?",
                      "Suggest a budget for food",
                      "Show my top spending categories",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => sendMessage(chip)}
                        className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-800/30 dark:bg-cyan-900/20 dark:text-cyan-300 dark:hover:bg-cyan-800/25"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

                {sending && (
                  <p className="text-xs text-gray-400 dark:text-app-muted">Thinking…</p>
                )}
              </div>

              {/* Input row */}
              <div className="border-t border-gray-200 p-3 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Ask about your spending…"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-white/[0.08] dark:bg-app-surface dark:text-white dark:placeholder:text-app-muted dark:focus:border-cyan-500/40"
                  />
                  <button
                    type="button"
                    disabled={sending}
                    onClick={sendMessage}
                    className="inline-flex items-center gap-1 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-[#06080F] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <SendHorizonal className="h-4 w-4" aria-hidden />
                    Send
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
