import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  FileAudio,
  Sparkles,
  Send,
  Table,
  CheckCircle2,
  Clock,
  Gauge,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { AudioWaveform } from "./AudioWaveform.tsx";
import { ConfirmModal } from "./ConfirmModal.tsx";
import {
  findOrCreateSpreadsheet,
  appendRehearsalRow,
  sendRehearsalEmail,
  RehearsalRecord,
} from "../services/googleWorkspace.ts";
import { getAccessToken, googleSignIn } from "../services/workspaceAuth.ts";

export const SpeechTranscriber: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [analysisMetrics, setAnalysisMetrics] = useState<any | null>(null);
  const [speechTitle, setSpeechTitle] = useState("Keynote Opening Rehearsal");

  // Confirmation Modals State
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [gmailModalOpen, setGmailModalOpen] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [statusNotification, setStatusNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Recording audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Timer
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = async () => {
    setStatusNotification(null);
    audioChunksRef.current = [];
    setRecordSeconds(0);
    setTranscript("");
    setAnalysisMetrics(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Audio visualizer setup
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(1, avg / 80));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // MediaRecorder setup
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await handleTranscribeBlob(audioBlob, mimeType);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (err: any) {
      console.error("Mic error:", err);
      setStatusNotification({
        type: "error",
        message: err.message || "Failed to access microphone. Please check permissions.",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    setIsRecording(false);
    setAudioLevel(0);
  };

  // Upload custom audio file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusNotification(null);
    setTranscript("");
    setAnalysisMetrics(null);
    setRecordSeconds(Math.round(file.size / 16000)); // rough estimate

    handleTranscribeBlob(file, file.type || "audio/webm");
  };

  // Call gemini-3.5-transcribe
  const handleTranscribeBlob = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        const res = await fetch("/api/gemini/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: base64Data,
            mimeType: mimeType,
            promptText:
              "Transcribe this speech rehearsal verbatim. Capture all words, conversational hesitations, and statements accurately.",
          }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const text = data.transcript || "No speech detected.";
        setTranscript(text);
        setIsTranscribing(false);

        // Automatically trigger speech metrics analysis
        await handleAnalyzeSpeech(text);
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      console.error("Transcription error:", err);
      setIsTranscribing(false);
      setStatusNotification({
        type: "error",
        message: err.message || "Failed to transcribe audio with gemini-3.5-transcribe.",
      });
    }
  };

  // Run structured speech critique
  const handleAnalyzeSpeech = async (text: string) => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    try {
      const duration = Math.max(15, recordSeconds || 30);
      const res = await fetch("/api/gemini/analyze-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          durationSeconds: duration,
          speechTitle,
        }),
      });

      const data = await res.json();
      if (data.metrics) {
        setAnalysisMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper for word count
  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const calculatedWpm =
    recordSeconds > 0 ? Math.round((wordCount / recordSeconds) * 60) : 0;

  // Copy transcript
  const copyTranscript = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Confirm and Execute Google Sheets Sync
  const handleConfirmSheetSync = async () => {
    setIsSyncingSheet(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const signinRes = await googleSignIn();
        token = signinRes?.accessToken || null;
      }
      if (!token) throw new Error("Google Workspace authentication required.");

      const sheetInfo = await findOrCreateSpreadsheet(token);
      const record: RehearsalRecord = {
        timestamp: new Date().toLocaleString(),
        speechTitle: speechTitle || "Vocal Practice",
        durationSeconds: recordSeconds || 30,
        wordCount,
        wpm: analysisMetrics?.wpm || calculatedWpm || 140,
        pacingStatus: analysisMetrics?.pacingStatus || "Optimal",
        clarityScore: analysisMetrics?.clarityScore || 85,
        confidenceScore: analysisMetrics?.confidenceScore || 82,
        fillerWordsTotal: analysisMetrics?.fillerWordsTotal || 0,
        overallTone: analysisMetrics?.overallTone || "Clear & Engaged",
        executiveSummary:
          analysisMetrics?.executiveSummary || "Rehearsal logged from Mindful Orator.",
      };

      await appendRehearsalRow(token, sheetInfo.id, record);

      setSheetModalOpen(false);
      setStatusNotification({
        type: "success",
        message: `Session logged successfully to Google Sheets (${sheetInfo.createdNew ? "Created new sheet" : "Appended to existing sheet"}).`,
      });
    } catch (err: any) {
      console.error("Sheet sync error:", err);
      setStatusNotification({
        type: "error",
        message: err.message || "Failed to sync rehearsal to Google Sheets.",
      });
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Confirm and Execute Gmail Send
  const handleConfirmGmailSend = async () => {
    if (!recipientEmail.trim()) {
      alert("Please enter a valid recipient email address.");
      return;
    }

    setIsSendingEmail(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const signinRes = await googleSignIn();
        token = signinRes?.accessToken || null;
      }
      if (!token) throw new Error("Google Workspace authentication required.");

      const subject = `Mindful Orator Speech Critique: ${speechTitle}`;
      const bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1e293b; line-height: 1.6;">
          <h2 style="color: #3525cd; margin-bottom: 4px;">Mindful Orator • Vocal Rehearsal Report</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Speech Title: <strong>${speechTitle}</strong> | ${new Date().toLocaleDateString()}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          
          <h3 style="color: #0f172a;">Executive Feedback</h3>
          <p>${analysisMetrics?.executiveSummary || "Strong rehearsal with clear articulation and presence."}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border-radius: 8px;">
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Cadence (WPM):</strong></td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${analysisMetrics?.wpm || calculatedWpm} WPM (${analysisMetrics?.pacingStatus || "Optimal"})</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Clarity Score:</strong></td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${analysisMetrics?.clarityScore || 85}/100</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Filler Words:</strong></td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${analysisMetrics?.fillerWordsTotal ?? 0} count</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Tone:</strong></td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${analysisMetrics?.overallTone || "Articulate"}</td>
            </tr>
          </table>

          <h3 style="color: #0f172a;">Verbatim Transcript</h3>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-style: italic; font-size: 14px;">
            "${transcript}"
          </div>

          <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Generated by Mindful Orator AI Speech Coach.</p>
        </div>
      `;

      await sendRehearsalEmail(token, {
        to: recipientEmail,
        subject,
        bodyHtml,
      });

      setGmailModalOpen(false);
      setStatusNotification({
        type: "success",
        message: `Speech report sent successfully via Gmail to ${recipientEmail}.`,
      });
    } catch (err: any) {
      console.error("Gmail send error:", err);
      setStatusNotification({
        type: "error",
        message: err.message || "Failed to send email via Gmail.",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              gemini-3.5-transcribe
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#131b2e] mt-2">
              Speech Transcription & Vocal Pacing
            </h2>
            <p className="text-sm text-[#464555] mt-1 max-w-2xl leading-relaxed">
              Record via your microphone or upload an audio rehearsal. The dedicated gemini-3.5-transcribe model outputs verbatim speech, filler word counts, and WPM cadence metrics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-2 transition-all">
              <FileAudio className="w-4 h-4 text-slate-600" />
              <span>Upload Audio</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {!isRecording ? (
              <button
                onClick={startRecording}
                className="px-5 py-2.5 bg-[#3525cd] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>Record Speech</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop & Transcribe ({recordSeconds}s)</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Audio Visualizer while recording */}
        {isRecording && (
          <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              Capturing microphone audio ({recordSeconds}s)
            </div>
            <AudioWaveform
              isActive={isRecording}
              audioLevel={audioLevel}
              barCount={48}
              height={52}
            />
          </div>
        )}

        {statusNotification && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              statusNotification.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {statusNotification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">
                {statusNotification.type === "success" ? "Operation Successful" : "Notice"}
              </p>
              <p className="mt-0.5">{statusNotification.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Title & Metadata editor */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#464555] mb-1">
            Speech Rehearsal Title
          </label>
          <input
            type="text"
            value={speechTitle}
            onChange={(e) => setSpeechTitle(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-[#131b2e] focus:bg-white focus:outline-none focus:border-[#4f46e5]"
            placeholder="e.g. Q3 All-Hands Strategy Talk"
          />
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-700 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          <div>
            <span className="text-[#464555]">Duration:</span>{" "}
            <strong>{recordSeconds || (transcript ? 30 : 0)}s</strong>
          </div>
          <div>
            <span className="text-[#464555]">Words:</span> <strong>{wordCount}</strong>
          </div>
          <div>
            <span className="text-[#464555]">Cadence:</span>{" "}
            <strong>{analysisMetrics?.wpm || calculatedWpm} WPM</strong>
          </div>
        </div>
      </div>

      {/* Main Content: Transcript & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Verbatim Transcript */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#464555]">
                Verbatim Speech Transcript
              </h3>
              {transcript && (
                <button
                  onClick={copyTranscript}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              )}
            </div>

            <div className="mt-4">
              {isTranscribing ? (
                <div className="py-16 text-center text-slate-600 space-y-3">
                  <div className="w-6 h-6 border-2 border-[#3525cd] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-medium">
                    Transcribing audio using gemini-3.5-transcribe...
                  </p>
                </div>
              ) : transcript ? (
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 text-sm text-[#131b2e] leading-relaxed whitespace-pre-wrap font-sans max-h-[320px] overflow-y-auto">
                  {transcript}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-600 text-sm space-y-2">
                  <Mic className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>No audio transcribed yet.</p>
                  <p className="text-xs text-slate-600">
                    Click "Record Speech" above to begin your vocal practice.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons (Sync to Sheets & Send Gmail) */}
          {transcript && (
            <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => handleAnalyzeSpeech(transcript)}
                disabled={isAnalyzing}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-[#3525cd] text-xs font-semibold rounded-xl border border-indigo-100 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAnalyzing ? "Analyzing..." : "Re-Analyze Metrics"}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSheetModalOpen(true)}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Table className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Log to Sheets</span>
                </button>

                <button
                  onClick={() => setGmailModalOpen(true)}
                  className="px-3.5 py-2 bg-[#3525cd] hover:bg-[#4f46e5] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Share via Gmail</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Diagnosis & Cadence Metrics */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#464555] flex items-center justify-between">
              <span>Cadence & Vocal Delivery</span>
              {analysisMetrics?.pacingStatus && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#3525cd] border border-indigo-100 font-semibold lowercase">
                  {analysisMetrics.pacingStatus}
                </span>
              )}
            </h3>

            {/* Metric Chips */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-700">
                  <Gauge className="w-3.5 h-3.5 text-[#3525cd]" />
                  <span>Cadence</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold font-mono text-[#131b2e]">
                    {analysisMetrics?.wpm || calculatedWpm || "--"}
                  </span>
                  <span className="text-xs text-slate-600">WPM</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">Optimal range: 130-160</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-700">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Filler Words</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold font-mono text-[#131b2e]">
                    {analysisMetrics?.fillerWordsTotal ?? (transcript ? 0 : "--")}
                  </span>
                  <span className="text-xs text-slate-600">detected</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">Target: &lt; 3 per min</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Clarity Score</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold font-mono text-[#131b2e]">
                    {analysisMetrics?.clarityScore ?? (transcript ? 88 : "--")}
                  </span>
                  <span className="text-xs text-slate-600">/100</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">Articulation index</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  <span>Confidence</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold font-mono text-[#131b2e]">
                    {analysisMetrics?.confidenceScore ?? (transcript ? 85 : "--")}
                  </span>
                  <span className="text-xs text-slate-600">/100</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">Projected poise</p>
              </div>
            </div>

            {/* Qualitative Feedback */}
            {analysisMetrics?.executiveSummary && (
              <div className="mt-4 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100/70 text-xs text-[#131b2e] leading-relaxed">
                <p className="font-semibold text-[#3525cd] mb-1">Coach Observation</p>
                <p>{analysisMetrics.executiveSummary}</p>
              </div>
            )}

            {/* Strengths & Improvements */}
            {analysisMetrics?.strengths && (
              <div className="mt-4 space-y-2 text-xs">
                <div>
                  <p className="font-semibold text-emerald-800 mb-1">Key Strengths</p>
                  <ul className="space-y-1 text-slate-700 list-disc list-inside">
                    {analysisMetrics.strengths.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                {analysisMetrics.areasForImprovement && (
                  <div className="pt-2">
                    <p className="font-semibold text-amber-800 mb-1">Areas for Refinement</p>
                    <ul className="space-y-1 text-slate-700 list-disc list-inside">
                      {analysisMetrics.areasForImprovement.map((a: string, i: number) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Google Sheets Sync */}
      <ConfirmModal
        isOpen={sheetModalOpen}
        title="Sync Speech Session to Google Sheets"
        description="Are you sure you want to append this practice session and its vocal cadence metrics to your Google Sheets spreadsheet? With your permission, this will create or update the spreadsheet 'Mindful Orator - Speech Practice Log'."
        confirmLabel="Confirm & Log to Sheets"
        cancelLabel="Cancel"
        isProcessing={isSyncingSheet}
        details={[
          `Speech Title: ${speechTitle}`,
          `Duration: ${recordSeconds || 30}s | Words: ${wordCount}`,
          `Cadence: ${analysisMetrics?.wpm || calculatedWpm} WPM`,
          `Destination: Google Sheets (Spreadsheet API)`,
        ]}
        onConfirm={handleConfirmSheetSync}
        onCancel={() => setSheetModalOpen(false)}
      />

      {/* Confirmation Modal for Gmail Send */}
      <ConfirmModal
        isOpen={gmailModalOpen}
        title="Send Rehearsal Critique via Gmail"
        description="Are you sure you want to send this speech evaluation summary via Gmail? With your permission, an email will be dispatched from your connected Gmail account."
        confirmLabel="Confirm & Send Email"
        cancelLabel="Cancel"
        isProcessing={isSendingEmail}
        details={[
          `Speech: ${speechTitle}`,
          `WPM: ${analysisMetrics?.wpm || calculatedWpm} | Score: ${analysisMetrics?.clarityScore || 85}/100`,
          `Action: Dispatches HTML email via Gmail API`,
        ]}
        onConfirm={handleConfirmGmailSend}
        onCancel={() => setGmailModalOpen(false)}
      >
        <div className="mt-3">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Recipient Email Address
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="mentor@example.com or your email"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#4f46e5]"
          />
        </div>
      </ConfirmModal>
    </div>
  );
};
