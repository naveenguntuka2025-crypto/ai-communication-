import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Zap,
  Flame,
  Brain,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  modelUsed?: string;
  timestamp: string;
}

export const CoachChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-1",
      role: "model",
      content:
        "Greetings! I am your Mindful Orator AI Speech Coach. Whether you are fine-tuning a keynote, preparing for spontaneous boardroom Q&A, or looking to master vocal pacing, I am here to guide you. What speech or speaking challenge would you like to explore today?",
      modelUsed: "gemini-3.5-flash",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Model & Role selection
  // Rules from user prompt:
  // "Use gemini-3.1-pro-preview for particularly complex tasks, gemini-3.5-flash for general tasks, and gemini-3.1-flash-lite for tasks that should happen fast."
  const [selectedModel, setSelectedModel] = useState<
    "gemini-3.1-pro-preview" | "gemini-3.5-flash" | "gemini-3.1-flash-lite"
  >("gemini-3.5-flash");

  const [coachRole, setCoachRole] = useState<"general" | "executive" | "impromptu" | "calm">("general");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Sync role with recommended model
  const handleSelectRole = (role: "general" | "executive" | "impromptu" | "calm") => {
    setCoachRole(role);
    if (role === "executive") {
      setSelectedModel("gemini-3.1-pro-preview");
    } else if (role === "impromptu") {
      setSelectedModel("gemini-3.1-flash-lite");
    } else {
      setSelectedModel("gemini-3.5-flash");
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput("");

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Map history for API
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          model: selectedModel,
          role: coachRole,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const botReply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        content: data.reply || "I understand. Please tell me more.",
        modelUsed: data.modelUsed || selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botReply]);
    } catch (err: any) {
      console.error("Chat error:", err);
      const errorReply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        content: `Error connecting to coach: ${err.message || "Failed to generate response."}`,
        modelUsed: selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        id: "fresh-1",
        role: "model",
        content:
          "Thread refreshed. I am ready for your next practice rehearsal or communication question.",
        modelUsed: selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const quickPrompts = [
    {
      label: "Evaluate my elevator pitch",
      prompt:
        "Please critique my 30-second elevator pitch: 'We help high-growth founders speak with calm conviction during keynotes and board pitches by providing AI-driven pacing and vocal coaching.' How can I make it punchier?",
    },
    {
      label: "Impromptu table topic",
      prompt:
        "Give me a spontaneous impromptu speaking challenge. Ask me an unexpected question and challenge me to use the PREP (Point, Reason, Example, Point) framework in 60 seconds.",
    },
    {
      label: "Vocal pacing drill",
      prompt:
        "I tend to speak at 180+ WPM when I get nervous in presentations. What specific pausing cues and breath resets can I practice to stay locked in the 135-150 WPM pocket?",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-[#3525cd] border border-indigo-100">
                <Bot className="w-3.5 h-3.5" />
                Multi-Turn Gemini Coach
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#131b2e] mt-2">
              Conversational Speech & Rhetoric Coach
            </h2>
            <p className="text-sm text-[#464555] mt-1 max-w-2xl leading-relaxed">
              Iterative, multi-turn coaching thread. Choose model tiers matched to task complexity: Pro for complex rhetoric, Flash for general practice, and Flash Lite for instantaneous drills.
            </p>
          </div>

          <button
            onClick={clearChat}
            className="self-start sm:self-auto px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Thread</span>
          </button>
        </div>

        {/* Coach Role Selector & Model Tier Indicators */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#464555] mr-1">
              Coaching Persona:
            </span>
            <button
              onClick={() => handleSelectRole("general")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                coachRole === "general"
                  ? "bg-[#3525cd] text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>General Vocal Coach</span>
            </button>

            <button
              onClick={() => handleSelectRole("executive")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                coachRole === "executive"
                  ? "bg-[#3525cd] text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Executive & TED Keynote (Pro)</span>
            </button>

            <button
              onClick={() => handleSelectRole("impromptu")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                coachRole === "impromptu"
                  ? "bg-[#3525cd] text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Rapid Impromptu Drills (Lite)</span>
            </button>
          </div>

          {/* Model Selector Pill */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">Model Engine:</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as any)}
              className="text-xs font-mono font-medium bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-[#4f46e5]"
            >
              <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex Tasks)</option>
              <option value="gemini-3.5-flash">gemini-3.5-flash (General Tasks)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast Tasks)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Chat Thread Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col h-[540px] overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-semibold ${
                    isUser
                      ? "bg-[#3525cd] text-white"
                      : "bg-indigo-50 border border-indigo-100 text-[#3525cd]"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-medium text-slate-600">
                      {isUser ? "You" : "Mindful Coach"}
                    </span>
                    <span>•</span>
                    <span>{m.timestamp}</span>
                    {m.modelUsed && !isUser && (
                      <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded font-mono text-[10px]">
                        {m.modelUsed}
                      </span>
                    )}
                  </div>

                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? "bg-[#3525cd] text-white rounded-tr-xs"
                        : "bg-slate-50/80 border border-slate-100 text-[#131b2e] rounded-tl-xs"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>

                  {!isUser && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        onClick={() => copyMessage(m.id, m.content)}
                        className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy critique</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 max-w-xl mr-auto">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-[#3525cd] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3525cd] animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-[#3525cd] animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-[#3525cd] animate-bounce [animation-delay:0.4s]" />
                <span className="text-xs font-mono ml-2 text-slate-400">
                  Formulating feedback via {selectedModel}...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Prompts */}
        <div className="px-6 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
            Prompt Starters:
          </span>
          {quickPrompts.map((q, i) => (
            <button
              key={i}
              onClick={() => {
                setInput(q.prompt);
              }}
              className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-lg whitespace-nowrap shadow-2xs transition-all cursor-pointer"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask the coach or paste a draft speech (${selectedModel})...`}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#131b2e] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#4f46e5] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-5 py-3 bg-[#3525cd] hover:bg-[#4f46e5] text-white rounded-xl font-semibold text-sm shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
