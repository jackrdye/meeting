export type Embedder = (text: string) => Promise<number[]>;

export interface MemoryFact {
  factId: string;
  meetingId: string;
  factText: string;
  factType: string;
  meetingDate: string; // ISO
  participants: string[];
  topics: string[];
  tags: string[];
  sourceTurn?: number;
  metadata: Record<string, unknown>;
  embedding: number[];
  createdAt: string;
}

export interface SearchOptions {
  participants?: string[];
  topics?: string[];
  tags?: string[];
  sinceDays?: number | null;
  limit?: number;
  minScore?: number;
}

export interface SearchHit {
  factId: string;
  meetingId: string;
  factType: string;
  factText: string;
  participants: string[];
  topics: string[];
  tags: string[];
  meetingDate: string;
  sourceTurn?: number;
  score: number;
  recencyBoost: number;
  finalScore: number;
}

export interface RecallDecision {
  shouldSurface: boolean;
  shouldInterject: boolean;
  reason: "no_hits" | "surface_only" | "cooldown" | "interject";
  hits: SearchHit[];
  decidedAt: Date;
}
