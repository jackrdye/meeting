# Voice Conversation Assistant

A Next.js web application that enables users to have voice conversations with an AI assistant, review past conversations, and query their conversation history through text or voice.

## Features

- 🎤 **Live Voice Conversations**: Real-time voice recording with ElevenLabs integration
- 📝 **Automatic Transcription**: Speech-to-text powered by ElevenLabs Scribe
- 🤖 **AI Summarization**: Generate summaries, key points, and action items with OpenAI
- 💬 **Conversation Queries**: Ask questions about your conversations using AI
- 📊 **Insights Dashboard**: Track conversation statistics and themes
- 🎨 **Modern UI**: Beautiful dark-themed interface with audio visualizations

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Voice**: ElevenLabs (speech-to-text)
- **AI**: OpenAI GPT-4 + Vercel AI SDK
- **Real-time**: WebSockets
- **Database**: File-based JSON (easily replaceable with PostgreSQL/Supabase)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- ElevenLabs API key ([Get one here](https://elevenlabs.io))
- OpenAI API key ([Get one here](https://platform.openai.com))

### Installation

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd meeting
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```env
# ElevenLabs API Key
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# OpenAI API Key (for AI features)
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Anthropic API Key (alternative to OpenAI)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

4. **Run the development server**

```bash
npm run dev:custom
```

This starts the custom server with WebSocket support on [http://localhost:3000](http://localhost:3000)

### Alternative: Run without WebSocket (limited functionality)

```bash
npm run dev
```

Note: Real-time voice recording requires the custom server with WebSocket support.

## Project Structure

```
/
├── app/
│   ├── api/                    # API routes
│   │   ├── conversations/      # Conversation CRUD
│   │   ├── summarize/          # AI summarization
│   │   ├── insights/           # Analytics
│   │   └── audio/              # WebSocket info
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Main dashboard
├── components/
│   ├── VoiceRecorder.tsx       # Voice recording & visualizer
│   ├── ConversationList.tsx    # Conversation history sidebar
│   ├── ConversationDetail.tsx  # Conversation detail view
│   ├── AskPanel.tsx            # AI query interface
│   └── InsightsPanel.tsx       # Insights sidebar
├── lib/
│   └── db.ts                   # Database layer
├── types/
│   └── index.ts                # TypeScript types
├── data/
│   └── conversations.json      # Stored conversations
├── server.ts                   # Custom server with WebSocket
├── package.json
├── tsconfig.json
└── next.config.mjs
```

## API Routes

### Conversations

- `GET /api/conversations` - List all conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/[id]` - Get specific conversation
- `DELETE /api/conversations/[id]` - Delete conversation
- `GET /api/conversations/[id]/transcript` - Get conversation transcript
- `GET /api/conversations/[id]/summary` - Get conversation summary
- `POST /api/conversations/[id]/query` - Query a conversation with AI

### Other

- `POST /api/summarize` - Generate AI summary for a conversation
- `GET /api/insights` - Get global insights and statistics

## How It Works

### Voice Recording Flow

1. User clicks "Start Conversation"
2. Browser requests microphone access
3. Audio is captured and streamed via WebSocket
4. ElevenLabs Scribe transcribes audio in real-time
5. Transcripts are displayed live and saved to database
6. User clicks "End" to stop recording
7. AI automatically generates summary, key points, and action items

### Conversation Query Flow

1. User navigates to a past conversation
2. Clicks "Ask" tab
3. Types or speaks a question
4. Question is sent to OpenAI with full transcript context
5. AI response is streamed back in real-time

## Customization

### Database

Currently uses file-based JSON storage. To use PostgreSQL/Supabase:

1. Update `lib/db.ts` with your database client
2. Create tables matching the TypeScript types in `types/index.ts`
3. Update CRUD operations in `lib/db.ts`

### AI Models

- **Summarization**: Change model in `app/api/summarize/route.ts` (currently GPT-4)
- **Queries**: Change model in `app/api/conversations/[id]/query/route.ts`
- **Alternative**: Use Anthropic Claude by switching imports

### Voice Settings

Modify ElevenLabs settings in `server.ts`:

```typescript
voice_settings: { 
  stability: 0.5,        // 0-1
  similarity_boost: 0.8  // 0-1
}
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

**Note**: WebSocket support on Vercel requires:
- Next.js 14+
- Custom server configuration
- Or use Vercel's WebSocket support (in beta)

### Alternative: Self-hosted

```bash
npm run build
npm start
```

## Troubleshooting

### WebSocket connection fails

- Ensure you're running `npm run dev:custom` (not `npm run dev`)
- Check that port 3000 is not in use
- Verify browser allows WebSocket connections

### No transcription appearing

- Verify `ELEVENLABS_API_KEY` is set correctly
- Check browser console for errors
- Ensure microphone permissions are granted

### AI features not working

- Verify `OPENAI_API_KEY` is set correctly
- Check API key has sufficient credits
- Review server logs for error messages

## Contributing

Contributions are welcome! Please open an issue or PR.

## License

MIT

## Support

For issues and questions:
- Check existing GitHub issues
- Create a new issue with detailed description
- Include browser console logs if applicable

---

Built with ❤️ using Next.js, ElevenLabs, and OpenAI

