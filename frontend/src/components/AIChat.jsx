import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, SendHorizonal } from "lucide-react";
import API from "../api/axios";
import FormattedAIResponse from "./FormattedAIResponse";

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hi! I am your finance assistant. Ask me about spending, savings, budgets, or next best actions.",
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
      const res = await API.post("/ai/chat", { message: text });
      const reply = res.data?.reply || "I could not generate a response right now.";
      setMessages((prev) => [...prev, { role: "ai", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "AI chat is temporarily unavailable. Please try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
      >
        <MessageCircle className="h-4 w-4" />
        AI Chat
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex h-[560px] w-full max-w-md flex-col rounded-2xl border border-gray-200 bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">AI Financial Assistant</h3>
                  <p className="text-xs text-gray-500">Ask about spending, savings, and budgets</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((m, idx) => (
                  <div
                    key={`${m.role}-${idx}`}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-blue-600 text-white"
                          : "border border-gray-200 bg-gray-50 text-gray-800"
                      }`}
                    >
                      {m.role === "ai" ? <FormattedAIResponse text={m.text} /> : m.text}
                    </div>
                  </div>
                ))}
                {messages.length <= 1 && (
                  <div className="mt-4 flex flex-wrap gap-2">
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
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-800/40"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
                {sending ? <p className="text-xs text-gray-500">Thinking...</p> : null}
              </div>

              <div className="border-t border-gray-200 p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => (e.key === "Enter" ? sendMessage() : null)}
                    placeholder="Ask about your spending..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="button"
                    disabled={sending}
                    onClick={sendMessage}
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <SendHorizonal className="h-4 w-4" />
                    Send
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
