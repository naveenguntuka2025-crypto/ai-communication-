import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Radio,
  Volume2,
  StopCircle,
  Play,
  Sparkles,
  Info,
  Clock,
  VolumeX,
} from "lucide-react";
import { AudioWaveform } from "./AudioWaveform.tsx";
import { float32ToPcm16Base64, LiveAudioPlayer } from "../utils/audioUtils.ts";

export const LiveAudioCoach: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Model is speaking
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveNotes, setLiveNotes] = useState<string[]>([
    "Ready to begin. Tap 'Start Voice Session' to converse directly with Gemini Live.",
    "Practice your keynote pitch, spontaneous interview answers, or difficult boardroom questions.",
  ]);

  // Audio refs
  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isMicMutedRef = useRef(false);

  // Sync isMicMuted ref to prevent stale closures in processor
  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  // Session timer
  useEffect(() => {
    let interval: any;
    if (isConnected) {
      interval = setInterval(() => {
        setSessionSeconds((s) => s + 1);
      }, 1000);
    } else {
      setSessionSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const startSession = async () => {
    setErrorMsg(null);
    setIsConnecting(true);

    try {
      // 1. Initialize player
      playerRef.current = new LiveAudioPlayer();

      // 2. Request mic permission and setup 16kHz capture AudioContext
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = inputAudioCtx;

      const sourceNode = inputAudioCtx.createMediaStreamSource(stream);
      // Buffer size 4096 = ~256ms chunk at 16kHz
      const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // 3. Connect WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to Live WebSocket bridge");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.status === "connected") {
            setIsConnected(true);
            setIsConnecting(false);
            setLiveNotes((prev) => [
              `Session active with model ${msg.model}. Say "Hello coach" to begin your vocal practice.`,
              ...prev.slice(0, 4),
            ]);
          }

          if (msg.audio) {
            setIsSpeaking(true);
            playerRef.current?.playChunk(msg.audio);
          }

          if (msg.interrupted) {
            setIsSpeaking(false);
            playerRef.current?.stop();
          }

          if (msg.error) {
            setErrorMsg(msg.error);
          }
        } catch (e) {
          console.error("Error parsing Live WS message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("Live WebSocket error:", e);
        setErrorMsg("WebSocket connection to Live API failed. Check server status.");
        setIsConnecting(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setIsSpeaking(false);
      };

      // 4. Pipe mic input
      processor.onaudioprocess = (e) => {
        if (isMicMutedRef.current || ws.readyState !== WebSocket.OPEN) {
          setAudioLevel(0);
          return;
        }

        const channelData = e.inputBuffer.getChannelData(0);
        // Compute volume RMS
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / channelData.length);
        setAudioLevel(Math.min(1, rms * 4));

        // Encode to 16-bit PCM Base64 and send
        const pcm16Base64 = float32ToPcm16Base64(channelData);
        ws.send(JSON.stringify({ audio: pcm16Base64 }));
      };

      sourceNode.connect(processor);
      processor.connect(inputAudioCtx.destination);
    } catch (err: any) {
      console.error("Failed to start Live session:", err);
      setErrorMsg(err.message || "Microphone access denied or audio initialization failed.");
      setIsConnecting(false);
      stopSession();
    }
  };

  const stopSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.close().catch(() => {});
      playerRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setAudioLevel(0);
  };

  // Interrupt coach speaking
  const handleInterrupt = () => {
    playerRef.current?.stop();
    setIsSpeaking(false);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ interrupted: true }));
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-[#3525cd] border border-indigo-100">
                <Radio className="w-3.5 h-3.5 animate-pulse text-[#3525cd]" />
                Live API • gemini-3.8-live
              </span>
              {isConnected && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Live Rehearsal
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#131b2e] mt-2">
              Voice Conversations with Gemini Live
            </h2>
            <p className="text-sm text-[#464555] mt-1 max-w-2xl leading-relaxed">
              Experience zero-friction, bi-directional spoken coaching in real-time. Speak naturally; the model responds instantly with vocal critique, cadence nudges, and conversational answers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isConnected && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/70 rounded-xl text-sm font-mono text-slate-700">
                <Clock className="w-4 h-4 text-[#3525cd]" />
                <span>{formatTime(sessionSeconds)}</span>
              </div>
            )}

            {!isConnected ? (
              <button
                onClick={startSession}
                disabled={isConnecting}
                className="px-5 py-2.5 bg-[#3525cd] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Connecting Live...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Start Voice Session</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-sm font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <StopCircle className="w-4 h-4 text-rose-600" />
                <span>End Session</span>
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Live Connection Notice</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Interactive Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Monitor & Controls */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center min-h-[380px] relative">
          {/* Status Indicator */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              {isSpeaking ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-[#3525cd] animate-bounce" />
                  <span className="text-[#3525cd] font-semibold">Coach is speaking...</span>
                </>
              ) : isConnected ? (
                isMicMuted ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-700 font-semibold">Mic Muted</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    <span className="text-emerald-700 font-semibold">Listening to your voice...</span>
                  </>
                )
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5 text-slate-400" />
                  <span>Microphone Standby</span>
                </>
              )}
            </div>
          </div>

          {/* Central Waveform Stage */}
          <div className="w-full max-w-md py-6 px-4 bg-slate-50/70 border border-slate-100 rounded-2xl flex flex-col items-center justify-center shadow-inner">
            <AudioWaveform
              isActive={isConnected && (!isMicMuted || isSpeaking)}
              audioLevel={isSpeaking ? 0.75 : audioLevel}
              barCount={42}
              height={64}
            />
            <p className="text-xs text-slate-600 mt-4 font-mono text-center">
              {isConnected
                ? isSpeaking
                  ? "Streaming 24kHz audio from gemini-3.8-live"
                  : isMicMuted
                  ? "Microphone paused"
                  : "Streaming 16kHz PCM audio to server"
                : "Awaiting Live connection"}
            </p>
          </div>

          {/* Control Floating Tray */}
          {isConnected && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setIsMicMuted(!isMicMuted)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                  isMicMuted
                    ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMicMuted ? "Unmute Microphone" : "Mute Microphone"}</span>
              </button>

              {isSpeaking && (
                <button
                  onClick={handleInterrupt}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <VolumeX className="w-4 h-4 text-slate-600" />
                  <span>Interrupt & Speak</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Coach Notes & Practice Prompts */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#464555] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#3525cd]" />
              Live Coach Session Notes
            </h3>
            <div className="mt-4 space-y-2.5">
              {liveNotes.map((note, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-[#131b2e] leading-relaxed flex items-start gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3525cd] mt-1.5 shrink-0" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/40 rounded-2xl p-5 border border-indigo-100/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#3525cd]">
              Suggested Vocal Drills
            </h4>
            <div className="mt-3 space-y-2">
              {[
                `"Coach, listen to my 60-second pitch for Mindful Orator."`,
                `"Challenge me with an impromptu question about AI leadership."`,
                `"How was my cadence in that last sentence? Was I speaking too fast?"`,
              ].map((prompt, i) => (
                <button
                  key={i}
                  disabled={!isConnected}
                  onClick={() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(
                        JSON.stringify({ text: prompt.replace(/"/g, "") })
                      );
                    }
                  }}
                  className="w-full text-left p-2.5 bg-white/80 hover:bg-white text-xs text-slate-700 rounded-xl border border-indigo-100 shadow-2xs transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
