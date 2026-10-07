import React, { useState } from "react";
import {
  Brain,
  Sparkles,
  Send,
  Zap,
  CheckCircle2,
  Copy,
  Check,
  ShieldAlert,
  Compass,
  Layers,
  ArrowRight,
} from "lucide-react";

export const HighThinkingAnalysis: React.FC = () => {
  const [prompt, setPrompt] = useState(
    "Conduct an exhaustive rhetorical stress-test of our high-stakes keynote opening. Evaluate ethos credibility, pathos emotional stakes, logos causal arguments, and identify blind spots where skeptical audience members might reject the core thesis."
  );
  const [speechContext, setSpeechContext] = useState(
    `"Over the past decade, our industry celebrated speed over substance. We launched products before we understood their human toll. Today, we are announcing a fundamental pivot: we are stepping back from vanity velocity to engineer systems of enduring cognitive depth. This will reduce short-term margin by 18%, but it creates an impenetrable competitive moat over the next ten years."`
  );
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunHighThinking = async () => {
    if (!prompt.trim() || isThinking) return;
    setIsThinking(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/gemini/thinking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          speechContext,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAnalysisResult(data.analysis);
    } catch (err: any) {
      console.error("High thinking error:", err);
      setErrorMsg(err.message || "Failed to complete High Thinking analysis.");
    } finally {
      setIsThinking(false);
    }
  };

  const copyAnalysis = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const presetDilemmas = [
    {
      title: "Hostile Board / Restructuring Defense",
      prompt:
        "Analyze the rhetorical defensibility of announcing an 18% margin compression to fund long-term R&D. Address cynical investor pushback and show how to anchor executive conviction without sounding defensive.",
      context:
        "Speech excerpt: 'We are deliberately moderating near-term EBITDA to build proprietary infrastructure that competitors cannot replicate in 5 years.'",
    },
    {
      title: "TED-Style Paradoxical Hook",
      prompt:
        "Deconstruct how to open a 15-minute speech with an unexpected paradox that disarms confirmation bias and establishes instant intellectual curiosity (Kairos & Logos).",
      context:
        "Topic: Why greater vocal confidence actually comes from embracing intentional silence rather than eliminating every pause.",
    },
    {
      title: "Classical 4-Pillar Audit (Ethos, Pathos, Logos, Kairos)",
      prompt:
        "Audit this speech draft across classical rhetorical taxonomy: Grade Ethos (1-10), Pathos (1-10), Logos (1-10), and Kairos (1-10). Pinpoint logical fallacies and provide an elevated, verbatim paragraph rewrite.",
      context:
        "Draft speech: 'Everyone knows the old way of communicating is dead. If you don't adapt immediately, your team will lose trust. We have the only platform that solves this.'",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                <Brain className="w-3.5 h-3.5 text-purple-600" />
                gemini-3.1-pro-preview • High Thinking Mode
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px] font-medium">
                thinkingLevel: HIGH
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#131b2e] mt-2">
              Deep Rhetoric & Keynote Architecture Studio
            </h2>
            <p className="text-sm text-[#464555] mt-1 max-w-2xl leading-relaxed">
              When surface-level pacing advice is not enough. Harness unconstrained reasoning depth to deconstruct argument logic, preempt skeptical audience resistance, audit rhetorical appeals, and elevate high-stakes speeches.
            </p>
          </div>

          <button
            onClick={handleRunHighThinking}
            disabled={isThinking || !prompt.trim()}
            className="px-6 py-3 bg-[#3525cd] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isThinking ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Deep Reasoning in Progress...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>Engage High Thinking</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Reasoning Process Error</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Preset Strategic Dilemmas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {presetDilemmas.map((d, i) => (
          <button
            key={i}
            onClick={() => {
              setPrompt(d.prompt);
              setSpeechContext(d.context);
            }}
            className="text-left p-4 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl shadow-2xs transition-all active:scale-[0.99] cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#3525cd]">
              <span>Scenario {i + 1}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-[#131b2e] mt-1">{d.title}</h4>
            <p className="text-xs text-[#464555] mt-1 line-clamp-2">{d.prompt}</p>
          </button>
        ))}
      </div>

      {/* Input Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#464555] mb-1.5 flex items-center justify-between">
              <span>Speech Excerpt or Narrative Draft</span>
              <span className="text-[11px] font-normal text-slate-400">Context</span>
            </label>
            <textarea
              rows={5}
              value={speechContext}
              onChange={(e) => setSpeechContext(e.target.value)}
              placeholder="Paste draft paragraph, keynote intro, or difficult talking point..."
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-[#131b2e] focus:bg-white focus:outline-none focus:border-[#4f46e5] leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#464555] mb-1.5 flex items-center justify-between">
              <span>Deep Rhetorical Inquiry / Goal</span>
              <span className="text-[11px] font-normal text-slate-400">Prompt</span>
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What complex challenge should the model think through?"
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#131b2e] focus:bg-white focus:outline-none focus:border-[#4f46e5] leading-relaxed"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-100 text-xs text-purple-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              Thinking Mode Specifications
            </p>
            <p className="text-[11px] text-purple-800 leading-relaxed">
              Powered by <strong>gemini-3.1-pro-preview</strong> with high-budget thinking enabled. Evaluates logic, epistemic tone, audience skepticism models, and psychological framing.
            </p>
          </div>
        </div>

        {/* Right: Exhaustive Analysis Output */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[460px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#3525cd]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#464555]">
                  High Thinking Output
                </h3>
              </div>

              {analysisResult && (
                <button
                  onClick={copyAnalysis}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Analysis</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="mt-4">
              {isThinking ? (
                <div className="py-24 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-[#131b2e]">
                    Synthesizing Classical Rhetoric & Logic...
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    gemini-3.1-pro-preview is evaluating argument warrants, anticipating skepticism, and calibrating cadence impact with ThinkingLevel.HIGH.
                  </p>
                </div>
              ) : analysisResult ? (
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 text-xs text-[#131b2e] leading-relaxed whitespace-pre-wrap font-sans max-h-[480px] overflow-y-auto">
                  {analysisResult}
                </div>
              ) : (
                <div className="py-24 text-center text-slate-400 text-sm space-y-2">
                  <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>No high-thinking analysis run yet.</p>
                  <p className="text-xs text-slate-400">
                    Select a preset scenario above or enter your keynote dilemma, then click "Engage High Thinking".
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
