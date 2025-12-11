# Voice Conversation Assistant - PRD

## Product Overview

A Next.js web app that enables users to have voice conversations with an AI assistant while **real-time insights, dates, and actionables are surfaced live during the conversation** with one-click execution buttons. Users can review past conversations and query their conversation history.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Voice**: Eleven Labs (text-to-speech & speech-to-text)
- **AI**: Vercel AI SDK with Claude/GPT-4
- **Database**: PostgreSQL/Supabase
- **Real-time**: WebSockets or Eleven Labs Conversational AI API + Server-Sent Events
- **Integrations**: Google Calendar API, Gmail API (optional)
- **Deployment**: Vercel

## Core Features

### 1. Live Voice Conversations

- Click-to-talk interface with microphone access
- Real-time voice streaming to Eleven Labs
- AI responses via text-to-speech
- Live transcript display showing conversation as it happens
- Visual indicator during active listening/speaking
- Pause/resume/end conversation controls

### 2. **Live Insights & Actions (Right Sidebar - Active During Conversation)**

**Real-time extraction while speaking:**

- **Dates/Times**: Automatically detected ("let's meet next Tuesday at 3pm")
- **Action Items**: Tasks mentioned ("I need to follow up with Sarah")
- **Key Topics**: Important subjects being discussed
- **People Mentioned**: Names extracted from conversation
- **Decisions Made**: Commitments or conclusions

**One-click action buttons:**

- 📅 **"Add to Calendar"** → Opens pre-filled Google Calendar event
- ✅ **"Create Task"** → Adds to task list with context
- 📧 **"Draft Email"** → Pre-fills email to mentioned person
- 📋 **"Save Note"** → Saves insight with timestamp link

**Visual Design:**

- Cards that appear in real-time as items are detected
- Green glow/animation when new item surfaces
- Grouped by type (Dates, Actions, People, etc.)
- Click card to jump to that moment in transcript

### 3. Conversation History (Left Sidebar)

- Chronological list of past conversations
- Display: title (auto-generated), date, duration
- Badge showing number of actionables per conversation
- Search/filter by date or keywords
- Infinite scroll for older conversations

### 4. Insights Archive (Right Sidebar - When No Active Conversation)

- AI-extracted key points across all conversations
- Pending action items with "mark complete" buttons
- Upcoming dates/meetings from past conversations
- Recurring themes/topics
- Quick stats (total conversations, topics discussed)

### 5. Conversation Deep Dive

- Click any conversation to open detail view
- Tabs: Transcript | Summary | Actions | Ask
- **Transcript**: Full text with timestamps, highlights where actionables were mentioned
- **Summary**: AI-generated TLDR with key points
- **Actions**: List of all extracted actionables with completion status
- **Ask**: Text or voice queries about that conversation

### 6. Global Chat (Bonus)

- Chat interface with context from all conversations
- "Ask me anything about our previous talks"
- References specific conversations in responses
- Can trigger actions: "Schedule that meeting we discussed yesterday"

## User Flows

**Primary Flow (Live Conversation)**:

1. User lands on home → sees previous conversations (left) + insights archive (right)
2. Clicks microphone → starts new conversation
3. Speaks: "Let's schedule a meeting with John next Tuesday at 2pm to discuss the project budget"
4. **Real-time during conversation:**
   - Right sidebar immediately shows:
     - 📅 Date card: "Next Tuesday, 2pm" with [Add to Calendar] button
     - 👤 People card: "John"
     - 💡 Topic card: "Project budget"
5. User clicks [Add to Calendar] → Modal opens with pre-filled:
   - Title: "Meeting with John"
   - Date: [Next Tuesday's date]
   - Time: 2:00 PM
   - Description: "Discuss the project budget" (from conversation context)
   - Guests: john@company.com (if email detected or in contacts)
6. User confirms → Event created in Google Calendar → Card shows ✓ "Added to calendar"
7. Conversation continues → more insights surface in real-time
8. Ends conversation → auto-saved to history with all actionables preserved

**Secondary Flow (Review & Act)**:

1. User opens previous conversation from sidebar
2. Views Actions tab → sees all extracted actionables
3. Clicks incomplete action → Executes with one click
4. Marks task as complete → Updates across all views

## Technical Architecture

### App Structure (Next.js App Router)

```
/app
  /api
    /conversations (GET, POST)
    /conversations/[id] (GET, DELETE)
    /conversations/[id]/transcript (GET)
    /conversations/[id]/summary (GET)
    /conversations/[id]/query (POST)
    /conversations/[id]/actionables (GET, POST)
    /actionables/[id]/complete (POST)
    /insights (GET)
    /insights/stream (SSE for live updates)
    /audio/stream (WebSocket route)
    /integrations
      /google/calendar/create (POST)
      /google/calendar/auth (GET)
      /google/tasks/create (POST)
  /(dashboard)
    /page.tsx (main interface)
    /conversations/[id]/page.tsx (detail view)
  /components
    /VoiceRecorder.tsx
    /ConversationList.tsx
    /LiveInsightsPanel.tsx (active during conversation)
    /InsightsArchive.tsx (when idle)
    /TranscriptViewer.tsx
    /ActionableCard.tsx
    /QuickActionButtons.tsx
```

### Data Models

**Conversation**

```typescript
{
  id: string;
  userId: string;
  title: string(auto - generated);
  createdAt: Date;
  duration: number(seconds);
  status: "active" | "completed";
  actionableCount: number;
}
```

**Message**

```typescript
{
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string (transcript)
  audioUrl?: string
  timestamp: Date
}
```

**Actionable**

```typescript
{
  id: string
  conversationId: string
  userId: string
  type: 'calendar' | 'task' | 'email' | 'note'
  status: 'pending' | 'completed' | 'dismissed'
  extractedAt: Date (timestamp in conversation)
  data: {
    // For calendar events
    title?: string
    date?: Date
    time?: string
    duration?: number
    attendees?: string[]
    location?: string

    // For tasks
    task?: string
    priority?: 'low' | 'medium' | 'high'
    dueDate?: Date

    // For emails
    recipient?: string
    subject?: string
    body?: string

    // Common
    context: string (surrounding conversation text)
    confidence: number (0-1)
  }
  externalId?: string (Google Calendar event ID, etc.)
  createdAt: Date
  completedAt?: Date
}
```

**Insight**

```typescript
{
  id: string
  userId: string
  content: string
  type: 'person' | 'topic' | 'decision' | 'highlight'
  conversationIds: string[]
  mentions: number (how many times surfaced)
  createdAt: Date
}
```

## Key Integrations

### Real-time Processing Pipeline

```typescript
// Stream conversation → Extract actionables in real-time
useEffect(() => {
  const eventSource = new EventSource(
    `/api/insights/stream?conversationId=${id}`
  );

  eventSource.onmessage = (event) => {
    const actionable = JSON.parse(event.data);
    // Add to UI immediately with animation
    addActionableToPanel(actionable);
  };
}, []);
```

### Eleven Labs + AI Processing

1. User speaks → Eleven Labs transcribes
2. Transcript chunk sent to Claude via Vercel AI SDK
3. Claude analyzes with structured output for actionables:

```typescript
const extraction = await generateObject({
  model: anthropic('claude-sonnet-4'),
  schema: z.object({
    actionables: z.array(z.object({
      type: z.enum(['calendar', 'task', 'email', 'note']),
      confidence: z.number(),
      data: z.object({...})
    }))
  }),
  prompt: `Extract actionables from: "${transcriptChunk}"`
})
```

4. Stream results to frontend via SSE
5. Display in right sidebar with action buttons

### Google Calendar Integration

```typescript
// /api/integrations/google/calendar/create
export async function POST(req: Request) {
  const { actionableId } = await req.json();
  const actionable = await db.actionable.findUnique({
    where: { id: actionableId },
  });

  const event = await googleCalendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: actionable.data.title,
      start: { dateTime: actionable.data.date },
      end: {
        dateTime: addMinutes(actionable.data.date, actionable.data.duration),
      },
      attendees: actionable.data.attendees?.map((email) => ({ email })),
      description: `From conversation: ${actionable.data.context}`,
    },
  });

  await db.actionable.update({
    where: { id: actionableId },
    data: {
      status: "completed",
      externalId: event.id,
    },
  });

  return Response.json({ success: true, eventId: event.id });
}
```

### Action Button Components

```typescript
<ActionableCard actionable={item}>
  {item.type === "calendar" && (
    <Button onClick={() => createCalendarEvent(item.id)}>
      📅 Add to Calendar
    </Button>
  )}
  {item.type === "task" && (
    <Button onClick={() => createTask(item.id)}>✅ Create Task</Button>
  )}
  {item.type === "email" && (
    <Button onClick={() => draftEmail(item.id)}>📧 Draft Email</Button>
  )}
</ActionableCard>
```

## Success Metrics

- Average conversation duration > 2 minutes
- **Actionables detected per conversation > 2**
- **Action button click-through rate > 60%**
- **Calendar events created within 5 seconds of surfacing > 40%**
- Users return to query past conversations > 30%
- Real-time insight accuracy > 85%
- Conversation completion rate > 85%

## Privacy & Permissions

- Request microphone permission on first use
- Request Google Calendar/Gmail OAuth on first action
- Store OAuth tokens securely
- Allow users to disconnect integrations
- Clear data retention policy (30/90 days)

## Future Enhancements

- Slack integration (send messages, create channels)
- Notion/Linear integration for task management
- CRM integration (Salesforce, HubSpot)
- Smart suggestions: "You mentioned calling Sarah 3 times but haven't scheduled it"
- Voice commands: "Add this to my calendar" during conversation
- Share conversations via link
- Export transcripts (PDF, TXT)
- Voice customization (choose Eleven Labs voice)
- Multi-language support
- Mobile app (React Native)
- Meeting prep: "Summarize my last 3 conversations with John"
