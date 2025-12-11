Hackathon Meeting Memory Layer (TypeScript)
===========================================

Self-contained memory + realtime gating, ready for Next.js monoliths. Lives entirely in `hackathon_memory_layer/`.

What it does
------------
- Stores concise meeting facts (decisions, actions, blockers) with metadata.
- Semantic-ish similarity (cosine) with recency decay and metadata filters (participants/topics/tags/date).
- Real-time policy: surface vs interject with score thresholds + cooldown.

Stack
-----
- TypeScript/ESM, Node 18+.
- Embeddings are pluggable: default hash embedder for offline/dev; OpenAI embedder for production.

Install
-------
```bash
cd hackathon_memory_layer
npm install
```

Core usage (OpenAI embeddings)
------------------------------
```ts
import { MeetingMemoryStore } from "./src/memoryStore";
import { RealtimeRecallOrchestrator } from "./src/realtime";
import { makeOpenAIEmbedder } from "./src/openaiEmbedder";

const embedder = makeOpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY });
const store = new MeetingMemoryStore({ embedder });

await store.addFact({
  meetingId: "mtg_001",
  factText: "Bob owns the API cutoff for March 5.",
  factType: "action",
  meetingDate: new Date("2025-03-01"),
  participants: ["bob@example.com", "alice@example.com"],
  topics: ["api", "cutoff"],
  tags: ["deadline"],
});

const orchestrator = new RealtimeRecallOrchestrator(store, {
  surfaceThreshold: 0.35,
  interjectThreshold: 0.55,
  cooldownSeconds: 30,
});

const decision = await orchestrator.processUtterance({
  utterance: "Can we confirm the API cutoff date?",
  participants: ["bob@example.com"],
  topics: ["api"],
});

if (decision.shouldSurface) {
  // render HUD with decision.hits
}
if (decision.shouldInterject) {
  // trigger TTS using decision.hits[0].factText
}
```

Hash embedder (no external calls)
---------------------------------
```ts
import { MeetingMemoryStore } from "./src/memoryStore";

const store = new MeetingMemoryStore(); // default hash embedder
```

Realtime wiring notes
---------------------
- Call `processUtterance` on ASR finals or high-quality partials.
- Pass `participants/topics/tags` to tighten precision.
- `cooldownSeconds` avoids spammy interjections.

Demo
----
```bash
cd hackathon_memory_layer
npm run demo   # runs src/demo.ts with seeded facts
```

Exports
-------
- `MeetingMemoryStore` (add/search)
- `makeOpenAIEmbedder`, `hashEmbed`
- `RealtimeRecallOrchestrator`
- Types in `src/types.ts`
