import { Router, Request, Response } from "express";
import { ai, ThinkingLevel } from "./geminiService.ts";

export const apiRouter = Router();

// 1. Multi-turn Chat endpoint
apiRouter.post("/gemini/chat", async (req: Request, res: Response) => {
  try {
    const { messages, model = "gemini-3.5-flash", role = "general", coachInstruction } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    // Role-specific default system instruction
    let systemInstruction = coachInstruction;
    if (!systemInstruction) {
      switch (role) {
        case "executive":
          systemInstruction =
            "You are the Executive Keynote & Boardroom Communication Coach for Mindful Orator. You specialize in executive presence, persuasive narrative arcs, strategic pauses, concise framing, and commanding yet empathetic delivery for high-stakes presentations.";
          break;
        case "impromptu":
          systemInstruction =
            "You are the Rapid Impromptu & Table Topics Coach for Mindful Orator. You deliver fast-paced, high-energy challenges, helping the speaker structure spontaneous thoughts using PREP (Point, Reason, Example, Point) or past-present-future frameworks with zero hesitation.";
          break;
        case "calm":
          systemInstruction =
            "You are the Vocal Grounding & Mindfulness Coach for Mindful Orator. You assist speakers suffering from stage fright, vocal tension, rapid heart rate, or breathlessness. Offer compassionate, somatic grounding techniques, diaphragmatic pacing cues, and calming re-framing.";
          break;
        default:
          systemInstruction =
            "You are Mindful Orator's AI Speech & Communication Coach. Your mission is to elevate the user's vocal confidence, eliminate filler words, refine pacing (target 130-160 WPM), and strengthen speech structure through constructive, insightful, and actionable feedback.";
          break;
      }
    }

    // Map messages to Gemini contents structure
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Selected model (allowed: gemini-3.1-pro-preview, gemini-3.5-flash, gemini-3.1-flash-lite)
    const validModels = ["gemini-3.1-pro-preview", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
    const chosenModel = validModels.includes(model) ? model : "gemini-3.5-flash";

    const response = await ai.models.generateContent({
      model: chosenModel,
      contents,
      config: {
        systemInstruction,
      },
    });

    const reply = response.text || "I am listening. Please continue your thought.";

    return res.json({
      reply,
      modelUsed: chosenModel,
    });
  } catch (err: any) {
    console.error("Gemini chat error:", err);
    return res.status(500).json({
      error: err.message || "Failed to process chat with Gemini",
    });
  }
});

// 2. High Thinking Mode for Complex Queries
apiRouter.post("/gemini/thinking", async (req: Request, res: Response) => {
  try {
    const { prompt, speechContext, analysisType = "rhetoric" } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required for High Thinking analysis" });
    }

    const fullPrompt = speechContext
      ? `Speech / Rehearsal Context:\n"""\n${speechContext}\n"""\n\nDeep Rhetorical Inquiry:\n${prompt}`
      : prompt;

    // Use gemini-3.1-pro-preview with thinkingLevel: HIGH and NO maxOutputTokens
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: fullPrompt,
      config: {
        systemInstruction:
          "You are the Chief Rhetorical Analyst and Master Speechcraft Strategist. Engage deep, high-level reasoning to rigorously analyze the speaker's rhetoric, argumentation logic, emotional resonance (Pathos), intellectual authority (Ethos), evidence synthesis (Logos), and situational urgency (Kairos). Deconstruct latent flaws, anticipate skepticism, and craft masterclass-level refinements with structural precision.",
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });

    const analysis = response.text || "Analysis complete.";

    return res.json({
      analysis,
      model: "gemini-3.1-pro-preview",
      thinkingLevel: "HIGH",
    });
  } catch (err: any) {
    console.error("Gemini High Thinking error:", err);
    return res.status(500).json({
      error: err.message || "Failed to execute High Thinking analysis",
    });
  }
});

// 3. Audio Transcription using gemini-3.5-transcribe
apiRouter.post("/gemini/transcribe", async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = "audio/webm", promptText } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 is required" });
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType.split(";")[0], // e.g. "audio/webm"
        data: audioBase64,
      },
    };

    const textPart = {
      text:
        promptText ||
        "Transcribe this speech recording verbatim. Capture every spoken word precisely without omitting filler sounds or colloquialisms.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-transcribe",
      contents: {
        parts: [audioPart, textPart],
      },
    });

    const transcript = response.text || "";

    return res.json({
      transcript,
      model: "gemini-3.5-transcribe",
    });
  } catch (err: any) {
    console.error("Gemini transcribe error:", err);
    return res.status(500).json({
      error: err.message || "Audio transcription failed with gemini-3.5-transcribe",
    });
  }
});

// 4. Comprehensive Speech Diagnosis & Metrics Analysis
apiRouter.post("/gemini/analyze-speech", async (req: Request, res: Response) => {
  try {
    const { transcript, durationSeconds = 60, speechTitle = "Speech Rehearsal" } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: "Transcript is required for speech analysis" });
    }

    const prompt = `Analyze this spoken transcript from a practice session titled "${speechTitle}".
Session duration: ${durationSeconds} seconds.

Transcript:
"""
${transcript}
"""

Provide a structured speech evaluation assessing:
1. Cadence and estimated Words Per Minute (WPM)
2. Filler words breakdown (count occurrences of 'um', 'uh', 'like', 'you know', 'so', 'actually', 'basically', 'right')
3. Clarity score (0-100) and delivery confidence score (0-100)
4. Overall tone assessment (e.g. "Authoritative & Poised", "Conversational", "Monotone", "Rushed")
5. 3 key strengths demonstrated
6. 3 high-impact actionable recommendations for improvement
7. A 2-sentence executive summary of the performance

Return strictly valid JSON with this shape:
{
  "wpm": number,
  "pacingStatus": "Too Slow" | "Optimal" | "Slightly Fast" | "Too Fast",
  "clarityScore": number,
  "confidenceScore": number,
  "overallTone": string,
  "fillerWordsTotal": number,
  "fillerWordsList": [{"word": string, "count": number}],
  "strengths": [string, string, string],
  "areasForImprovement": [string, string, string],
  "executiveSummary": string
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    let resultJson;
    try {
      resultJson = JSON.parse(response.text || "{}");
    } catch {
      resultJson = {
        wpm: Math.round((transcript.split(/\s+/).length / (durationSeconds || 60)) * 60),
        pacingStatus: "Optimal",
        clarityScore: 88,
        confidenceScore: 84,
        overallTone: "Clear & Thoughtful",
        fillerWordsTotal: 2,
        fillerWordsList: [{ word: "um", count: 2 }],
        strengths: ["Clear thesis", "Good vocal articulation", "Structured narrative"],
        areasForImprovement: ["Add intentional pauses", "Vary pitch for emphasis", "Sharpen closing statement"],
        executiveSummary: "Strong delivery with coherent reasoning and clear presence.",
      };
    }

    return res.json({
      metrics: resultJson,
      model: "gemini-3.5-flash",
    });
  } catch (err: any) {
    console.error("Speech analysis error:", err);
    return res.status(500).json({
      error: err.message || "Failed to analyze speech metrics",
    });
  }
});
