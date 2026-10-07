import { LiveServerMessage, Modality } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import { ai } from "./geminiService.ts";

export function setupLiveWebSocket(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/live" });

  wss.on("connection", async (clientWs: WebSocket) => {
    let session: any = null;
    let isConnected = false;

    try {
      session = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction:
            "You are Mindful Orator, an encouraging, articulate, and mindful speech and executive communication coach. You converse with the user in real-time, helping them rehearse speeches, practice vocal cadence, conquer verbal fillers, and speak with calm executive presence. Keep your spoken responses concise, conversational, and direct so the dialogue flows naturally.",
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onclose: () => {
            isConnected = false;
          },
          onerror: (err: any) => {
            console.error("Live session callback error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ error: "Live session error: " + (err?.message || err) }));
            }
          },
        },
      });

      isConnected = true;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ status: "connected", model: "gemini-3.8-live" }));
      }
    } catch (err: any) {
      console.error("Failed to connect to Live API:", err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: "Failed to initialize Live API session with gemini-3.8-live: " + err.message,
          })
        );
      }
      return;
    }

    clientWs.on("message", (data: any) => {
      if (!session || !isConnected) return;
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
          });
        } else if (parsed.text) {
          session.sendRealtimeInput({
            text: parsed.text,
          });
        }
      } catch (e) {
        console.error("Error processing client audio packet:", e);
      }
    });

    clientWs.on("close", () => {
      isConnected = false;
      if (session) {
        try {
          session.close();
        } catch {
          // ignore
        }
      }
    });
  });

  return wss;
}
