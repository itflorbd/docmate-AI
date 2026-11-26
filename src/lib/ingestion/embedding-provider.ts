import OpenAI from 'openai';
import { Pool } from 'pg';
import { getRawAiCredentials } from '@/lib/ai-credentials';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  modelName(): string;
  dimension(): number;
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  private model: string;
  private dim: number;

  constructor(model = 'text-embedding-3-small', dimension = 1536) {
    this.model = model;
    this.dim = dimension;
  }

  modelName(): string {
    return this.model;
  }

  dimension(): number {
    return this.dim;
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Generate deterministic normalized unit vectors based on text hash
    return texts.map((t) => {
      let hash = 0;
      for (let i = 0; i < t.length; i++) {
        hash = (hash << 5) - hash + t.charCodeAt(i);
        hash |= 0;
      }
      const vec: number[] = new Array(this.dim);
      let norm = 0;
      for (let j = 0; j < this.dim; j++) {
        const val = Math.sin(hash + j);
        vec[j] = val;
        norm += val * val;
      }
      norm = Math.sqrt(norm);
      return vec.map((v) => v / norm);
    });
  }
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private model: string;

  constructor(model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small') {
    this.model = model;
  }

  modelName(): string {
    return this.model;
  }

  dimension(): number {
    return 1536;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const creds = await getRawAiCredentials();
    const apiKey = creds?.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Fallback to mock provider if no API key is configured
      const mock = new MockEmbeddingProvider(this.model);
      return mock.embed(texts);
    }

    const client = new OpenAI({
      apiKey,
      baseURL: creds?.baseUrl || undefined,
    });

    const results: number[][] = [];
    const batchSize = 100;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map((t) => t.replace(/\n+/g, ' ').slice(0, 8000));
      let attempts = 0;
      let success = false;
      let lastErr: unknown;

      while (attempts < 3 && !success) {
        try {
          attempts++;
          const resp = await client.embeddings.create({
            model: this.model,
            input: batch,
            dimensions: 1536,
          });
          for (const item of resp.data) {
            results.push(item.embedding);
          }
          success = true;
        } catch (err: unknown) {
          lastErr = err;
          const delay = Math.pow(2, attempts) * 500;
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      if (!success) {
        throw new Error(`Embedding API failed after 3 attempts: ${lastErr instanceof Error ? lastErr.message : 'Unknown error'}`);
      }
    }

    return results;
  }
}

export class CachedEmbeddingService {
  private provider: EmbeddingProvider;

  constructor(provider?: EmbeddingProvider) {
    this.provider = provider || (process.env.OPENAI_API_KEY ? new OpenAiEmbeddingProvider() : new MockEmbeddingProvider());
  }

  async getOrComputeEmbeddings(
    items: { contentHash: string; text: string }[]
  ): Promise<Map<string, number[]>> {
    const resultMap = new Map<string, number[]>();
    if (items.length === 0) return resultMap;

    const model = this.provider.modelName();
    const uniqueHashes = Array.from(new Set(items.map((i) => i.contentHash)));

    // Step 1: Query embedding_cache in bulk
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ content_hash: string; embedding: string }>(
        `SELECT content_hash, embedding::text AS embedding
         FROM embedding_cache
         WHERE content_hash = ANY($1) AND model = $2;`,
        [uniqueHashes, model]
      );

      for (const row of rows) {
        try {
          const parsed = typeof row.embedding === 'string'
            ? JSON.parse(row.embedding.replace('[', '[').replace(']', ']'))
            : row.embedding;
          resultMap.set(row.content_hash, parsed);
        } catch {
          // ignore corrupted cache rows
        }
      }

      // Step 2: Determine missing hashes
      const missingItems = items.filter((item) => !resultMap.has(item.contentHash));
      if (missingItems.length === 0) {
        return resultMap;
      }

      // De-duplicate missing by hash
      const missingMap = new Map<string, string>();
      for (const m of missingItems) {
        if (!missingMap.has(m.contentHash)) {
          missingMap.set(m.contentHash, m.text);
        }
      }

      const missingHashes = Array.from(missingMap.keys());
      const missingTexts = Array.from(missingMap.values());

      // Step 3: Embed only missing items
      const newVectors = await this.provider.embed(missingTexts);

      // Step 4: Batch save into embedding_cache
      for (let i = 0; i < missingHashes.length; i++) {
        const hash = missingHashes[i];
        const vec = newVectors[i];
        resultMap.set(hash, vec);

        const id = `${hash}:${model}`;
        const vecStr = `[${vec.join(',')}]`;
        await client.query(
          `INSERT INTO embedding_cache (id, content_hash, model, embedding, created_at)
           VALUES ($1, $2, $3, $4::vector, NOW())
           ON CONFLICT (id) DO NOTHING;`,
          [id, hash, model, vecStr]
        );
      }

      return resultMap;
    } finally {
      client.release();
    }
  }
}
