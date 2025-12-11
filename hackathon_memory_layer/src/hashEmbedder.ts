import crypto from "crypto";

// Deterministic, cheap embedding for local/dev use.
export function hashEmbed(text: string, dim = 256): number[] {
  const vec = new Float32Array(dim);
  const hash = crypto.createHash("sha256").update(text, "utf8").digest();
  for (let i = 0; i < hash.length; i++) {
    vec[i % dim] += hash[i] / 255;
  }
  // normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return Array.from(vec);
}
