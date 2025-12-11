/**
 * Minimal wiring example for Next.js/Node:
 * - seeds memory
 * - runs realtime orchestrator
 * - logs HUD/TTS actions
 */
import { MeetingMemoryStore } from "./memoryStore.js";
import { RealtimeRecallOrchestrator } from "./realtime.js";
import { makeOpenAIEmbedder } from "./openaiEmbedder.js";

async function main() {
  const embedder = makeOpenAIEmbedder(); // uses OPENAI_API_KEY env var
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

  await store.addFact({
    meetingId: "mtg_002",
    factText: "We agreed to ship the mobile beta by April 10.",
    factType: "decision",
    meetingDate: new Date("2025-03-05"),
    participants: ["alice@example.com"],
    topics: ["mobile", "beta"],
    tags: ["shipdate"],
  });

  const orchestrator = new RealtimeRecallOrchestrator(store, {
    surfaceThreshold: 0.35,
    interjectThreshold: 0.55,
    cooldownSeconds: 20,
  });

  const utterances = [
    "Can we confirm the API cutoff date?",
    "Also what is the mobile beta ship date?",
    "Random small talk unrelated to work.",
    "Remind me who owns the API workstream?",
  ];

  for (const utterance of utterances) {
    const decision = await orchestrator.processUtterance({
      utterance,
      participants: ["bob@example.com"],
      topics: ["api", "mobile"],
    });

    if (decision.shouldSurface) {
      const top = decision.hits[0];
      console.log("[HUD]", top.factText, `(from ${top.meetingDate})`);
    }
    if (decision.shouldInterject) {
      const top = decision.hits[0];
      console.log("[TTS]", top.factText);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
