import { RecallDecision, SearchHit } from "./types.js";
import { MeetingMemoryStore } from "./memoryStore.js";

export interface RealtimeConfig {
  surfaceThreshold?: number;
  interjectThreshold?: number;
  cooldownSeconds?: number;
  maxHits?: number;
}

export class RealtimeRecallOrchestrator {
  private store: MeetingMemoryStore;
  private surfaceThreshold: number;
  private interjectThreshold: number;
  private cooldownSeconds: number;
  private maxHits: number;
  private lastInterjectAt: Date | null;

  constructor(store: MeetingMemoryStore, config: RealtimeConfig = {}) {
    this.store = store;
    this.surfaceThreshold = config.surfaceThreshold ?? 0.35;
    this.interjectThreshold = config.interjectThreshold ?? 0.55;
    this.cooldownSeconds = config.cooldownSeconds ?? 30;
    this.maxHits = config.maxHits ?? 6;
    this.lastInterjectAt = null;
  }

  async processUtterance(input: {
    utterance: string;
    participants?: string[];
    topics?: string[];
    tags?: string[];
  }): Promise<RecallDecision> {
    const { utterance, participants, topics, tags } = input;
    const now = new Date();

    const hits = await this.store.search(utterance, {
      participants,
      topics,
      tags,
      limit: this.maxHits,
      minScore: Math.min(this.surfaceThreshold, this.interjectThreshold),
    });

    if (!hits.length) {
      return {
        shouldSurface: false,
        shouldInterject: false,
        reason: "no_hits",
        hits: [],
        decidedAt: now,
      };
    }

    const top: SearchHit = hits[0];
    const topScore = top.finalScore;
    const shouldSurface = topScore >= this.surfaceThreshold;

    const onCooldown =
      this.lastInterjectAt &&
      now.getTime() - this.lastInterjectAt.getTime() < this.cooldownSeconds * 1000;

    let shouldInterject = topScore >= this.interjectThreshold && !onCooldown;
    let reason: RecallDecision["reason"] = "surface_only";

    if (shouldInterject) {
      reason = "interject";
      this.lastInterjectAt = now;
    } else if (onCooldown) {
      shouldInterject = false;
      reason = "cooldown";
    }

    return {
      shouldSurface,
      shouldInterject,
      reason,
      hits,
      decidedAt: now,
    };
  }
}
