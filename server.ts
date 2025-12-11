import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { createConversation, addTranscript, endConversation } from "./lib/db";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // WebSocket Server
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected to WebSocket");
    let elevenLabsWs: WebSocket | null = null;
    let currentConversationId: string | null = null;

    ws.on("message", (message: Buffer) => {
      try {
        const parsed = JSON.parse(message.toString());

        // START A NEW CONVERSATION
        if (parsed.type === "start_session") {
          const newConv = createConversation({
            title: `Conversation ${new Date().toLocaleString()}`,
          });
          currentConversationId = newConv.id;

          // Initialize ElevenLabs WebSocket
          try {
            const elevenLabsUrl = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";
            const apiKey = process.env.ELEVENLABS_API_KEY;

            if (!apiKey) {
              console.error("ELEVENLABS_API_KEY not found");
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "ElevenLabs API key not configured",
                })
              );
              return;
            }

            console.log(`Connecting to ElevenLabs: ${elevenLabsUrl}`);

            elevenLabsWs = new WebSocket(elevenLabsUrl, {
              headers: {
                "xi-api-key": apiKey,
              },
            });

            elevenLabsWs.on("open", () => {
              console.log("Connected to ElevenLabs WebSocket");
              const initMessage = {
                text: " ",
                voice_settings: { stability: 0.5, similarity_boost: 0.8 },
                model_id: "scribe_v2",
              };
              elevenLabsWs?.send(JSON.stringify(initMessage));
              ws.send(
                JSON.stringify({
                  type: "session_started",
                  conversationId: currentConversationId,
                })
              );
            });

            elevenLabsWs.on("message", (data: Buffer) => {
              try {
                const msg = JSON.parse(data.toString());
                console.log("Received from ElevenLabs:", msg.type || "Unknown Type");

                if (msg.type === "transcript" || msg.is_final) {
                  if (msg.text && currentConversationId) {
                    console.log("Transcript Text:", msg.text);

                    // Forward to client
                    ws.send(JSON.stringify({ type: "transcript", data: msg }));

                    // Save final transcripts to DB
                    if (msg.is_final) {
                      const transcriptObj: any = {
                        id: Date.now().toString(),
                        conversationId: currentConversationId,
                        role: "user",
                        content: msg.text,
                        timestamp: new Date().toISOString(),
                        isFinal: true,
                        speaker: msg.speaker_id || "Unknown",
                      };
                      addTranscript(currentConversationId, transcriptObj);
                    }
                  }
                } else {
                  ws.send(JSON.stringify({ type: "event", data: msg }));
                }
              } catch (e) {
                console.error("Error parsing ElevenLabs message:", e);
              }
            });

            elevenLabsWs.on("error", (err) => {
              console.error("ElevenLabs socket error:", err);
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "ElevenLabs Error: " + err.message,
                })
              );
            });

            elevenLabsWs.on("close", (code, reason) => {
              console.log(`ElevenLabs socket closed. Code: ${code}, Reason: ${reason}`);
            });
          } catch (e) {
            console.error("Connection failed:", e);
          }
        }

        // STOP SESSION
        else if (parsed.type === "stop_session") {
          if (currentConversationId) {
            endConversation(currentConversationId);
          }
          if (elevenLabsWs) {
            elevenLabsWs.close();
          }
        }

        // AUDIO DATA
        else if (parsed.audio_data) {
          if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
            const inputAudioChunk = {
              message_type: "input_audio_chunk",
              audio_base_64: parsed.audio_data,
              sample_rate: 16000,
            };
            elevenLabsWs.send(JSON.stringify(inputAudioChunk));
          }
        }
      } catch (e) {
        console.error("Error parsing message:", e);
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      if (elevenLabsWs) {
        elevenLabsWs.close();
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server running`);
  });
});
