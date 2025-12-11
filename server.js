
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db');
const fs = require('fs');

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// API ROUTES

// 1. Get All Conversations (History)
app.get('/api/conversations', (req, res) => {
    const history = db.getConversations();
    res.json(history);
});

// 2. Get Single Conversation
app.get('/api/conversations/:id', (req, res) => {
    const conv = db.getConversationById(req.params.id);
    if (conv) {
        res.json(conv);
    } else {
        res.status(404).json({ error: "Conversation not found" });
    }
});

// 3. Summarize (Triggered manually or on end)
app.post('/api/summarize', async (req, res) => {
    const { conversationId } = req.body;
    const conv = db.getConversationById(conversationId);

    // For Hackathon/Demo: If no transcript, use a placeholder so the UI shows something
    let fullText = "";
    if (conv && conv.transcripts.length) {
        fullText = conv.transcripts.map(t => `${t.speaker || 'Speaker'}: ${t.text}`).join('\n');
    } else {
        console.log("No transcript found, using mock for demo.");
        fullText = "[Mock Transcript] User: We need to fix the persistence layer. AI: Agreed, checking the database module. User: Also add action items.";
    }

    console.log('Generating summary for:', conversationId);

    // Real Summarization with OpenAI
    if (!process.env.OPENAI_API_KEY) {
        console.warn("Missing OPENAI_API_KEY, using mock.");
        // Fallback to Mock if no key
        const summary = {
            summary: "Mock Summary (No OpenAI Key): The meeting discussed the new architecture.",
            keyPoints: ["Data persistence", "UI Layout", "Missing API Key"],
            actionItems: ["Add OPENAI_API_KEY to .env"]
        };
        db.endConversation(conversationId, summary);
        return res.json(summary);
    }

    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const systemPrompt = `
        You are an expert Minute Taker.
        Analyze the following transcript and return a JSON object with:
        - summary: A concise paragraph summary (2-3 sentences).
        - keyPoints: Array of strings (max 5) highlighting key discussion topics.
        - actionItems: Array of strings (max 5) listing clear, actionable tasks derived from the conversation.
        
        Transcript:
        ${fullText}
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a helpful assistant that outputs JSON." },
                { role: "user", content: systemPrompt }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);

        const summaryData = {
            summary: result.summary,
            keyPoints: result.keyPoints || [],
            actionItems: result.actionItems || []
        };

        db.endConversation(conversationId, summaryData);
        res.json(summaryData);

    } catch (error) {
        console.error("OpenAI Error:", error);
        res.status(500).json({ error: "Summarization failed" });
    }
});

// 4. Chat / Ask (Mock)
app.post('/api/chat', (req, res) => {
    const { message, conversationId } = req.body;
    // Mock response
    res.json({
        response: `[AI Analysis of ${conversationId || 'Global'}]: That is an interesting point about "${message}".Based on the transcript...`
    });
});


// WEBSOCKET SERVER
wss.on('connection', (ws) => {
    console.log('Client connected');
    let elevenLabsWs = null;
    let currentConversationId = null;

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);

            // START A NEW CONVERSATION
            if (parsed.type === 'start_session') {
                const newConv = db.createConversation({ title: `Conversation ${new Date().toLocaleString()} ` });
                currentConversationId = newConv.id;

                // Initialize ElevenLabs
                try {
                    const elevenLabsUrl = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
                    console.log(`Connecting to ElevenLabs: ${elevenLabsUrl}`);
                    console.log(`API Key Loaded: ${ELEVENLABS_API_KEY ? 'Yes (' + ELEVENLABS_API_KEY.substring(0, 4) + '...)' : 'No'}`);

                    elevenLabsWs = new WebSocket(elevenLabsUrl, {
                        headers: {
                            'xi-api-key': ELEVENLABS_API_KEY
                        }
                    });

                    elevenLabsWs.on('open', () => {
                        console.log('Connected to ElevenLabs WebSocket');
                        const initMessage = {
                            text: " ",
                            voice_settings: { stability: 0.5, similarity_boost: 0.8 },
                            // xi_api_key might not be needed here if in header, but keeping for safety unless it causes error
                            // xi_api_key: ELEVENLABS_API_KEY,
                            model_id: "scribe_v2"
                        };
                        // Note: Scribe v2 init payload might differ, relying on user provided example for now but logging send
                        console.log('Sending Init Message');
                        elevenLabsWs.send(JSON.stringify(initMessage));
                        ws.send(JSON.stringify({ type: 'session_started', conversationId: currentConversationId }));
                    });

                    elevenLabsWs.on('message', (data) => {
                        try {
                            const msg = JSON.parse(data);
                            console.log('Received from ElevenLabs:', msg.type || 'Unknown Type', msg); // Log everything for debug

                            if (msg.type === 'transcript' || msg.is_final) {
                                if (msg.text) {
                                    console.log('Transcript Text:', msg.text);
                                    const transcriptObj = {
                                        speaker: msg.speaker_id || "Unknown",
                                        text: msg.text,
                                        timestamp: new Date().toISOString(),
                                        isFinal: msg.is_final
                                    };

                                    // Forward to client
                                    ws.send(JSON.stringify({ type: 'transcript', data: msg }));

                                    // Save final to DB
                                    if (msg.is_final) {
                                        db.addTranscript(currentConversationId, transcriptObj);
                                    }
                                }
                            } else {
                                ws.send(JSON.stringify({ type: 'event', data: msg }));
                            }
                        } catch (e) {
                            console.error("Error parsing ElevenLabs message:", e);
                        }
                    });

                    elevenLabsWs.on('error', (err) => {
                        console.error('ElevenLabs socket error:', err);
                        // Check for authentication errors specifically
                        if (err.message && err.message.includes('401')) {
                            console.error("Authentication Failed. Check API Key.");
                        }
                        ws.send(JSON.stringify({ type: 'error', message: 'ElevenLabs Error: ' + err.message }));
                    });

                    elevenLabsWs.on('close', (code, reason) => {
                        console.log(`ElevenLabs socket closed. Code: ${code}, Reason: ${reason}`);
                    });

                } catch (e) {
                    console.error('Connection failed:', e);
                }
            }

            // STOP SESSION
            else if (parsed.type === 'stop_session') {
                if (currentConversationId) {
                    db.endConversation(currentConversationId); // Mark end time
                }
                if (elevenLabsWs) {
                    elevenLabsWs.close();
                }
            }

            // AUDIO DATA
            else if (parsed.audio_data) {
                if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
                    const audioChunk = {
                        "audio_event": {
                            "audio_base_64": parsed.audio_data,
                            "event_status": "ongoing",
                            "sample_rate": 16000
                        }
                    };
                    const inputAudioChunk = {
                        "message_type": "input_audio_chunk",
                        "audio_base_64": parsed.audio_data,
                        "sample_rate": 16000
                    };
                    // We will try `input_audio_chunk` as it matches the error "valid protocol message"
                    elevenLabsWs.send(JSON.stringify(inputAudioChunk));
                }
            }

        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (elevenLabsWs) {
            elevenLabsWs.close();
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} `);
});
