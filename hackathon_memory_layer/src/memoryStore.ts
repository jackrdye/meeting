import { randomUUID } from "crypto";
import { hashEmbed } from "./hashEmbedder.js";
import type {
  Embedder,
  MemoryFact,
  SearchHit,
  SearchOptions,
} from "./types.js";

const DEFAULT_LIMIT = 8;
const DEFAULT_MIN_SCORE = 0.25;
const DEFAULT_SINCE_DAYS = 120;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface StoreConfig {
  embedder?: Embedder;
  hashEmbeddingDim?: number;
  recencyHalfLifeDays?: number;
}

export class MeetingMemoryStore {
  private embedder: Embedder;
  private recencyHalfLifeDays: number;
  private facts: Map<string, MemoryFact>;

  constructor(config: StoreConfig = {}) {
    this.embedder =
      config.embedder ??
      (async (text: string) => hashEmbed(text, config.hashEmbeddingDim ?? 256));
    this.recencyHalfLifeDays = Math.max(1, config.recencyHalfLifeDays ?? 30);
    this.facts = new Map();
  }

  async addFact(input: {
    meetingId: string;
    factText: string;
    factType?: string;
    meetingDate?: Date;
    participants?: string[];
    topics?: string[];
    tags?: string[];
    sourceTurn?: number;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const {
      meetingId,
      factText,
      factType = "fact",
      meetingDate = new Date(),
      participants = [],
      topics = [],
      tags = [],
      sourceTurn,
      metadata = {},
    } = input;

    const embedding = await this.embedder(factText);
    const factId = `mtg::${meetingId}::${randomUUID()}`;
    const fact: MemoryFact = {
      factId,
      meetingId,
      factText,
      factType,
      meetingDate: meetingDate.toISOString(),
      participants,
      topics,
      tags,
      sourceTurn,
      metadata,
      embedding,
      createdAt: new Date().toISOString(),
    };
    this.facts.set(factId, fact);
    return factId;
  }

  async bulkAdd(facts: Array<Parameters<MeetingMemoryStore["addFact"]>[0]>): Promise<string[]> {
    const ids: string[] = [];
    for (const f of facts) {
      ids.push(await this.addFact(f));
    }
    return ids;
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
    if (this.facts.size === 0) return [];

    const {
      participants,
      topics,
      tags,
      sinceDays = DEFAULT_SINCE_DAYS,
      limit = DEFAULT_LIMIT,
      minScore = DEFAULT_MIN_SCORE,
    } = opts;

    const qvec = await this.embedder(query);
    const now = new Date();
    const hits: SearchHit[] = [];

    for (const fact of this.facts.values()) {
      if (!this.passesFilters(fact, { participants, topics, tags, sinceDays, now })) {
        continue;
      }

      const base = cosine(qvec, fact.embedding);
      if (base <= 0) continue;
      const recency = this.recencyBoost(fact.meetingDate, now);
      const finalScore = base * (0.5 + 0.5 * recency);
      if (finalScore < minScore) continue;

      hits.push({
        factId: fact.factId,
        meetingId: fact.meetingId,
        factType: fact.factType,
        factText: fact.factText,
        participants: fact.participants,
        topics: fact.topics,
        tags: fact.tags,
        meetingDate: fact.meetingDate,
        sourceTurn: fact.sourceTurn,
        score: base,
        recencyBoost: recency,
        finalScore,
      });
    }

    hits.sort((a, b) => b.finalScore - a.finalScore);
    return hits.slice(0, limit);
  }

  private passesFilters(
    fact: MemoryFact,
    opts: {
      participants?: string[];
      topics?: string[];
      tags?: string[];
      sinceDays?: number | null;
      now: Date;
    }
  ): boolean {
    const { participants, topics, tags, sinceDays, now } = opts;
    if (sinceDays !== null && sinceDays !== undefined) {
      const cutoff = new Date(now.getTime() - sinceDays * 24 * 60 * 60 * 1000);
      try {
        const fDate = new Date(fact.meetingDate);
        if (fDate < cutoff) return false;
      } catch {
        /* ignore parse issues */
      }
    }
    if (participants?.length) {
      const match = participants.some((p) => fact.participants.includes(p));
      if (!match) return false;
    }
    if (topics?.length) {
      const match = topics.some((t) => fact.topics.includes(t));
      if (!match) return false;
    }
    if (tags?.length) {
      const match = tags.some((t) => fact.tags.includes(t));
      if (!match) return false;
    }
    return true;
  }

  private recencyBoost(meetingDate: string, now: Date): number {
    try {
      const dt = new Date(meetingDate);
      const ageMs = now.getTime() - dt.getTime();
      const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
      return Math.exp((-Math.log(2) * ageDays) / this.recencyHalfLifeDays);
    } catch {
      return 1;
    }
  }
}
