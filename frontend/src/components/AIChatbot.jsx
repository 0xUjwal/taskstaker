import { useState, useRef, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { chatWithAI, analyzeProof } from "../utils/api";

export default function AIChatbot({ task, onClose }) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialAnalysisDone, setInitialAnalysisDone] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Run initial analysis if proof exists
  useEffect(() => {
    if (task.proofUrl && !initialAnalysisDone) {
      runInitialAnalysis();
    }
  }, [task.proofUrl]);

  function runInitialAnalysis() {
    // The advisory proof report lives on the task card. The chat is for follow-up questions.
    setInitialAnalysisDone(true);
    setMessages([
      {
        role: "assistant",
        content:
          "The AI advisory report for this proof is shown on the task card. It scores how well the proof supports the task and never approves or rejects. Ask me anything about the proof or the task.",
      },
    ]);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() && !file) return;

    const userMsg = {
      role: "user",
      content: input || (file ? `[Attached: ${file.name}]` : ""),
      fileName: file?.name,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const token = await getToken();
      const chatMessages = newMessages
        .filter((m) => !m.isAnalysis)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await chatWithAI(token, {
        messages: chatMessages,
        taskDescription: task.name,
        file: file || undefined,
      });

      setMessages([
        ...newMessages,
        { role: "assistant", content: result.reply },
      ]);
      setFile(null);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md glass-strong border-l border-white/10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full crimson-gradient flex items-center justify-center">
              <span
                className="material-symbols-outlined text-on-primary-container text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
            </div>
            <div>
              <h3 className="text-sm font-headline font-bold text-on-surface">
                AI Analysis
              </h3>
              <p className="text-[10px] text-on-surface-variant truncate max-w-[230px] font-label">
                Task #{task.id}: {task.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-variant/50 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-lg">
              close
            </span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !loading && (
            <div className="text-center text-on-surface-variant text-sm py-8">
              <span className="material-symbols-outlined text-outline text-4xl block mb-3">
                auto_awesome
              </span>
              <p>Ask me about this task or attach proof for analysis</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span
                    className="material-symbols-outlined text-primary text-xs"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    auto_awesome
                  </span>
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "btn-primary"
                    : msg.isAnalysis
                    ? "bg-white/[0.05] text-on-surface border border-primary/15"
                    : "bg-white/[0.05] text-on-surface border border-white/[0.06]"
                }`}
              >
                {/* Analysis badge */}
                {msg.isAnalysis && msg.analysis && (
                  <div
                    className={`inline-flex items-center gap-1.5 text-[10px] font-label font-bold px-2 py-0.5 rounded-full mb-2 uppercase tracking-widest border ${
                      msg.analysis.passed
                        ? "text-tertiary bg-tertiary/10 border-tertiary/20"
                        : "text-error bg-error/10 border-error/20"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {msg.analysis.passed ? "Passed" : "Needs Review"}
                    <span className="opacity-60">
                      · {msg.analysis.confidence}%
                    </span>
                  </div>
                )}
                {msg.fileName && (
                  <div className="flex items-center gap-1 text-[10px] opacity-60 mb-1.5">
                    <span className="material-symbols-outlined text-xs">
                      attach_file
                    </span>
                    {msg.fileName}
                  </div>
                )}
                {/* Plain text rendering — strip any accidental markdown */}
                <div className="whitespace-pre-wrap leading-relaxed text-[13px]">
                  {msg.isAnalysis
                    ? msg.content.replace(
                        /^(PASSED|NEEDS REVIEW) — Confidence: \d+%\n\n/,
                        "",
                      )
                    : msg.content}
                </div>
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-on-surface-variant text-xs">
                    person
                  </span>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span
                  className="material-symbols-outlined text-primary text-xs"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_awesome
                </span>
              </div>
              <div className="bg-surface-container-high rounded-xl px-3.5 py-2.5">
                <span className="material-symbols-outlined text-primary text-lg animate-spin">
                  progress_activity
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* File preview */}
        {file && (
          <div className="px-4 py-2 border-t border-white/[0.07] bg-white/[0.03] flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">
              {file.type.startsWith("image/") ? "image" : "description"}
            </span>
            <span className="text-xs text-on-surface-variant truncate flex-1 font-label">
              {file.name}
            </span>
            <button
              onClick={() => setFile(null)}
              className="text-xs text-error hover:text-error-dim font-label font-bold"
            >
              Remove
            </button>
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="p-3 border-t border-white/[0.07] bg-white/[0.03] flex gap-2"
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-surface-variant/50 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-lg">
              attach_file
            </span>
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this task..."
            className="flex-1 glass-input px-3.5 py-2 text-sm font-body"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && !file)}
            className="p-2 btn-primary rounded-lg"
          >
            <span className="material-symbols-outlined text-on-primary-container text-lg">
              send
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
