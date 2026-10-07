/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Radio,
  Mic,
  MessageSquare,
  Brain,
  FileSpreadsheet,
  Sparkles,
  Volume2,
  Activity,
  CheckCircle2,
  Shield,
  Layers,
} from "lucide-react";
import { LiveAudioCoach } from "./components/LiveAudioCoach.tsx";
import { SpeechTranscriber } from "./components/SpeechTranscriber.tsx";
import { CoachChat } from "./components/CoachChat.tsx";
import { HighThinkingAnalysis } from "./components/HighThinkingAnalysis.tsx";
import { WorkspaceHub } from "./components/WorkspaceHub.tsx";
import { initAuth } from "./services/workspaceAuth.ts";

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "live" | "transcribe" | "chat" | "thinking" | "workspace"
  >("live");

  const [workspaceConnected, setWorkspaceConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    initAuth(
      (user) => {
        setWorkspaceConnected(true);
        setUserEmail(user.email || null);
      },
      () => {
        setWorkspaceConnected(false);
        setUserEmail(null);
      }
    );
  }, []);

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col font-sans selection:bg-[#4f46e5]/10 selection:text-[#3525cd]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3525cd] flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5 fill-white/80" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-[#131b2e] font-heading">
                  Mindful Orator
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-[#3525cd] border border-indigo-100">
                  AI Speech Coach
                </span>
              </div>
              <p className="text-[11px] text-[#464555] hidden md:block">
                Quiet Modernism • Vocal Cadence & Executive Rhetoric
              </p>
            </div>
          </div>

          {/* Quick Stats & Workspace Status */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs font-mono text-slate-600">
              <Activity className="w-3.5 h-3.5 text-[#3525cd]" />
              <span>Target: 135–155 WPM</span>
            </div>

            <button
              onClick={() => setActiveTab("workspace")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                workspaceConnected
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden xs:inline">
                {workspaceConnected ? "Sheets & Gmail Active" : "Connect Workspace"}
              </span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 border-t border-slate-100">
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 -mb-px no-scrollbar">
            <button
              onClick={() => setActiveTab("live")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "live"
                  ? "bg-[#3525cd] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${activeTab === "live" ? "animate-pulse" : ""}`} />
              <span>Voice Live Coach</span>
              <span className="text-[10px] opacity-75 font-mono">3.8-live</span>
            </button>

            <button
              onClick={() => setActiveTab("transcribe")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "transcribe"
                  ? "bg-[#3525cd] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Transcribe & Drill</span>
              <span className="text-[10px] opacity-75 font-mono">3.5-transcribe</span>
            </button>

            <button
              onClick={() => setActiveTab("chat")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "chat"
                  ? "bg-[#3525cd] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Multi-Turn Coach Chat</span>
            </button>

            <button
              onClick={() => setActiveTab("thinking")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "thinking"
                  ? "bg-[#3525cd] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>High Thinking Studio</span>
              <span className="text-[10px] opacity-75 font-mono">3.1-pro</span>
            </button>

            <button
              onClick={() => setActiveTab("workspace")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "workspace"
                  ? "bg-[#3525cd] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sheets & Gmail Hub</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main App Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {activeTab === "live" && <LiveAudioCoach />}
        {activeTab === "transcribe" && <SpeechTranscriber />}
        {activeTab === "chat" && <CoachChat />}
        {activeTab === "thinking" && <HighThinkingAnalysis />}
        {activeTab === "workspace" && <WorkspaceHub />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/70 bg-white/70 py-6 text-center text-xs text-[#464555]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium text-[#131b2e]">
            Mindful Orator • Personal Communication & Speech Coach
          </p>
          <div className="flex items-center gap-4 text-slate-500 text-[11px]">
            <span>Google Workspace • Sheets & Gmail</span>
            <span>•</span>
            <span>Gemini Live & Transcribe</span>
            <span>•</span>
            <span>High Thinking Mode</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
