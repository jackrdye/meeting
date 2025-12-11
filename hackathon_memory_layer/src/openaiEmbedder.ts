import OpenAI from "openai";
import type { Embedder } from "./types.js";

export function makeOpenAIEmbedder(opts: { apiKey?: string; model?: string } = {}): Embedder {
  const client = new OpenAI({ apiKey: opts.apiKey || process.env.OPENAI_API_KEY });
  const model = opts.model ?? "text-embedding-3-small";

  return async (text: string) => {
    const resp = await client.embeddings.create({
      model,
      input: text,
    });
    return resp.data[0].embedding;
  };
}
