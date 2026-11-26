import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export const DEFAULT_PRICE_PER_1K_TOKENS = 0.00002; // $0.02 per 1M tokens (OpenAI text-embedding-3-small)
export const DEFAULT_DAILY_BUDGET_USD = 25.0;
export const DEFAULT_APPROVAL_THRESHOLD_USD = 2.0;

export class IngestionBudgetManager {
  private async getSetting(key: string, defaultValue: number): Promise<number> {
    try {
      const { rows } = await pool.query<{ value: unknown }>(
        `SELECT value FROM system_settings WHERE key = $1;`,
        [key]
      );
      if (rows.length > 0 && rows[0].value) {
        const val = typeof rows[0].value === 'number' ? rows[0].value : parseFloat(String(rows[0].value));
        if (!isNaN(val)) return val;
      }
      return defaultValue;
    } catch {
      return defaultValue;
    }
  }

  estimateCost(tokenCount: number, customThreshold = DEFAULT_APPROVAL_THRESHOLD_USD): {
    estimatedCost: number;
    estimatedTokens: number;
    requiresApproval: boolean;
  } {
    const cost = Math.round((tokenCount / 1000) * DEFAULT_PRICE_PER_1K_TOKENS * 10000) / 10000;
    const requiresApproval = cost >= customThreshold;

    return {
      estimatedCost: cost,
      estimatedTokens: tokenCount,
      requiresApproval,
    };
  }

  async checkDailyBudget(additionalCost: number): Promise<{
    withinBudget: boolean;
    remainingBudget: number;
    currentSpent: number;
  }> {
    const dailyLimit = await this.getSetting('ingest.daily_budget_usd', DEFAULT_DAILY_BUDGET_USD);

    // Sum today's ingestion spending from ingest_jobs
    const { rows } = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(estimated_cost), 0) AS total
       FROM ingest_jobs
       WHERE status = 'completed'
         AND created_at >= CURRENT_DATE;`
    );

    const currentSpent = parseFloat(rows[0]?.total || '0');
    const remainingBudget = Math.max(0, dailyLimit - currentSpent);
    const withinBudget = currentSpent + additionalCost <= dailyLimit;

    return {
      withinBudget,
      remainingBudget: Math.round(remainingBudget * 100) / 100,
      currentSpent: Math.round(currentSpent * 100) / 100,
    };
  }
}

export const ingestionBudgetManager = new IngestionBudgetManager();
