// DocMate AI - RAG accuracy benchmark.
//
// For every question in eval/rag/gold.jsonl we know which library section holds
// the answer and which facts a correct answer must state. The script measures:
//   1. Retrieval: rank of the gold chunk in what the assistant actually retrieves.
//   2. Answers:   status, whether the gold chunk is cited, and fact coverage.
//
//   pnpm run eval:rag                 # retrieval + answers with the configured model
//   pnpm run eval:rag -- --retrieval  # retrieval only (fast, no model calls)
//   pnpm run eval:rag -- --verbose    # print every answer

import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../src/db';
import { buildConversationContext } from '../src/lib/assistant/context';
import { runAssistantTurn } from '../src/lib/assistant/engine';
import { selectExcerpts } from '../src/lib/assistant/excerpts';
import { getChatModel } from '../src/lib/assistant/llm';
import { buildWeightedRetrievalQueries } from '../src/lib/assistant/retrieval-queries';
import { understandText } from '../src/lib/language/understand';
import { hybridRetrieve, type ScoredChunk } from '../src/lib/retrieval';
import type { StructuredPatientInput } from '../src/types';

interface Gold {
  id: string;
  lang: 'en' | 'bn' | 'banglish';
  question: string;
  source: string;
  section: number;
  facts: string[][];
}

const EMPTY_PATIENT: StructuredPatientInput = {
  age: 40,
  gender: 'other',
  chief_complaint: '',
  symptoms: [],
  past_medical_history: [],
  current_medicines: [],
  allergies: [],
  lab_values: [],
  vitals: {},
};

function isGold(chunk: Pick<ScoredChunk, 'source_title' | 'section'>, gold: Gold): boolean {
  return Boolean(chunk.source_title?.includes(gold.source) && chunk.section?.startsWith(`Section ${gold.section}:`));
}

function toAscii(text: string): string {
  return text.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
}

function factCoverage(text: string, facts: string[][]): { covered: number; missing: string[] } {
  const haystack = toAscii(text).toLowerCase();
  const missing = facts.filter((group) => !group.some((term) => haystack.includes(toAscii(term).toLowerCase())));
  return { covered: facts.length - missing.length, missing: missing.map((group) => group[0]) };
}

async function main() {
  const retrievalOnly = process.argv.includes('--retrieval');
  const verbose = process.argv.includes('--verbose');
  const gold: Gold[] = fs
    .readFileSync(path.join(process.cwd(), 'eval', 'rag', 'gold.jsonl'), 'utf-8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const translator = await getChatModel();
  const llm = retrievalOnly ? null : translator;

  const rows: string[] = [];
  const ranks: number[] = [];
  let answered = 0;
  let citedGold = 0;
  let factsCovered = 0;
  let factsTotal = 0;
  let fullyCorrect = 0;
  const byLang: Record<string, { n: number; hit3: number; correct: number }> = {};

  for (const item of gold) {
    const understanding = await understandText(item.question, { skipCache: true });
    const needsTranslation = /[\u0980-\u09FF]/.test(item.question) || understanding.detectedLang === 'banglish';
    const english = needsTranslation && translator ? await translator.translate(item.question) : null;
    const weighted = buildWeightedRetrievalQueries(item.question, understanding, EMPTY_PATIENT, undefined, english);
    const hits = selectExcerpts(await hybridRetrieve(weighted.queries, 8, weighted.weights), 6);
    const rank = hits.findIndex((excerpt) => isGold(excerpt.chunk, item)) + 1; // 0 = missed
    ranks.push(rank);
    const lang = (byLang[item.lang] ??= { n: 0, hit3: 0, correct: 0 });
    lang.n++;
    if (rank > 0 && rank <= 3) lang.hit3++;

    let answerCells = '';
    if (!retrievalOnly) {
      const reply = await runAssistantTurn(
        {
          sessionId: `rag-${item.id}`,
          text: item.question,
          kind: 'observation',
          patient: EMPTY_PATIENT,
          context: buildConversationContext([]),
          replyLanguagePref: 'auto',
          doctorTitle: 'Doctor',
          tone: 'friendly',
          verbosity: 'normal',
          signal: new AbortController().signal,
        },
        { retrieve: hybridRetrieve, llm },
        () => {},
      );
      const cites = reply.claims.some((claim) => hits.some((excerpt) => excerpt.chunk.id === claim.chunk_id && isGold(excerpt.chunk, item)));
      const coverage = factCoverage(reply.text, item.facts);
      if (reply.status === 'answered') answered++;
      if (cites) citedGold++;
      factsCovered += coverage.covered;
      factsTotal += item.facts.length;
      const correct = reply.status === 'answered' && cites && coverage.missing.length === 0;
      if (correct) {
        fullyCorrect++;
        lang.correct++;
      }
      answerCells = ` ${reply.status} | ${cites ? 'yes' : 'no'} | ${coverage.covered}/${item.facts.length}${coverage.missing.length ? ` (missing: ${coverage.missing.join(', ')})` : ''} |`;
      if (verbose) console.log(`\n--- ${item.id}: ${item.question}\n${reply.text}\n`);
    }

    const line = `| ${item.id} | ${item.lang} | ${item.question.replace(/\|/g, '/')} | ${rank || 'miss'} |${answerCells}`;
    rows.push(line);
    console.log(line);
  }

  const n = gold.length;
  const recallAt = (k: number) => ranks.filter((rank) => rank > 0 && rank <= k).length;
  const mrr = ranks.reduce((sum, rank) => sum + (rank ? 1 / rank : 0), 0) / n;
  const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(1)}% (${value}/${total})`;

  const summary = [
    ['Gold chunk ranked first', pct(recallAt(1), n)],
    ['Gold chunk in top 3', pct(recallAt(3), n)],
    ['Gold chunk in the 6 excerpts sent to the model', pct(recallAt(6), n)],
    ['Mean reciprocal rank', mrr.toFixed(3)],
    ...(retrievalOnly
      ? []
      : [
          ['Answered (not abstained)', pct(answered, n)],
          ['Cited the gold section', pct(citedGold, n)],
          ['Required facts stated in the answer', pct(factsCovered, factsTotal)],
          ['Fully correct (answered, gold cited, all facts)', pct(fullyCorrect, n)],
        ]),
  ];
  const langRows = Object.entries(byLang).map(
    ([lang, stats]) => `| ${lang} | ${stats.n} | ${pct(stats.hit3, stats.n)} | ${retrievalOnly ? '—' : pct(stats.correct, stats.n)} |`,
  );

  const report = [
    '# RAG accuracy benchmark',
    '',
    `Generated ${new Date().toISOString()} by \`pnpm run eval:rag${retrievalOnly ? ' -- --retrieval' : ''}\`. Model: ${llm ? llm.model : 'none'}. ${n} questions with a known answer section in the published library (eval/rag/gold.jsonl).`,
    '',
    '| Metric | Result |',
    '| :--- | :--- |',
    ...summary.map(([metric, value]) => `| ${metric} | ${value} |`),
    '',
    '| Language | Questions | Gold in top 3 | Fully correct |',
    '| :--- | :---: | :---: | :---: |',
    ...langRows,
    '',
    '## Per question',
    '',
    retrievalOnly ? '| ID | Lang | Question | Gold rank |' : '| ID | Lang | Question | Gold rank | Status | Cited gold | Facts |',
    retrievalOnly ? '| :--- | :--- | :--- | :---: |' : '| :--- | :--- | :--- | :---: | :--- | :---: | :--- |',
    ...rows,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(process.cwd(), 'eval', 'rag', 'RESULTS.md'), report, 'utf-8');
  console.log('\n' + summary.map(([metric, value]) => `${metric}: ${value}`).join('\n'));
  console.log(Object.entries(byLang).map(([lang, s]) => `${lang}: top3 ${s.hit3}/${s.n}, correct ${s.correct}/${s.n}`).join('\n'));
  await pool.end();
}

main().catch((err) => {
  console.error('RAG eval failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
