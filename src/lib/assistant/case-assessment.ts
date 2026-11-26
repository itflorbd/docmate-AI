// Gated synthetic Analyze: the same evidence assessment as doctor chat, run on
// the case record's structured lab fields.

import { hybridRetrieve } from '@/lib/retrieval';
import type { AnalysisOutput, StructuredPatientInput, VerifiedClaim } from '@/types';
import { selectExcerpts } from './excerpts';
import { ANALYTES, observationsFromLabValues, renderAssessment, runEvidenceAssessment, type Rejection } from './evidence-assessment';
import { getChatModel } from './llm';

export interface CaseAssessmentResult {
  analysis: AnalysisOutput | null;
  model: string | null;
  /** live = a model proposed the criteria; fallback = no model, so no assessment. */
  mode: 'live' | 'fallback';
  rejections: Rejection[];
}

/** Distinct words from the complaint and symptoms (4+ letters), for matching passages. */
function presentationTerms(patient: StructuredPatientInput): string[] {
  const text = [patient.chief_complaint, ...(patient.symptoms ?? [])].filter(Boolean).join(' ').toLowerCase();
  const stop = new Set(['with', 'from', 'that', 'this', 'have', 'days', 'weeks', 'week', 'months', 'since', 'for', 'and', 'the', 'synthetic', 'testing', 'workflow', 'increased', 'frequent']);
  return [...new Set(text.split(/[^\p{L}]+/u).filter((word) => word.length >= 4 && !stop.has(word)))];
}

export async function assessCase(patient: StructuredPatientInput, locale: 'bn' | 'en'): Promise<CaseAssessmentResult> {
  const observations = observationsFromLabValues(patient.lab_values ?? []);
  const llm = await getChatModel();
  if (!llm) return { analysis: null, model: null, mode: 'fallback', rejections: [] };
  // With no recorded labs, still look for criteria so the doctor learns which
  // results to record. That is case data, never a library gap.
  const tests = observations.length
    ? [...new Set(observations.map((observation) => ANALYTES[observation.analyte].label[0]))].join(' ')
    : Object.values(ANALYTES).map((analyte) => analyte.label[0]).join(' ');
  const presentation = [patient.chief_complaint, ...(patient.symptoms ?? [])].filter(Boolean).join(', ');
  const excerpts = selectExcerpts(await hybridRetrieve([`${tests} diagnostic threshold criteria confirm diagnosis`, presentation].filter(Boolean), 8), 6);
  const run = await runEvidenceAssessment({ excerpts, observations, llm });
  if (!run.assessment || run.assessment.status === 'no_criteria') {
    return { analysis: null, model: llm.model, mode: 'live', rejections: run.rejections };
  }
  // Without recorded labs, the criteria must belong to this presentation: the
  // criteria passage is among the best matches for the complaint and symptoms
  // alone, and names at least two of them. Otherwise every unrelated case would
  // be asked for these tests.
  if (observations.length === 0) {
    const criteriaChunks = new Set(run.assessment.verified.criteria.map((criterion) => criterion.excerpt.chunk.id));
    const forPresentation = presentation ? await hybridRetrieve([presentation], 3) : [];
    const matched = forPresentation.find((chunk) => criteriaChunks.has(chunk.id));
    const terms = presentationTerms(patient);
    const named = matched ? terms.filter((term) => matched.text.toLowerCase().includes(term)).length : 0;
    if (!matched || named < 2) return { analysis: null, model: llm.model, mode: 'live', rejections: run.rejections };
  }

  const { assessment } = run;
  const rendered = renderAssessment(assessment, locale);
  // Analysis panels show plain text, not Markdown.
  const plain = rendered.text.replace(/\*\*/g, '').replace(/(^|\s)_|_(\s|$)/g, '$1$2').trim();
  const claims: VerifiedClaim[] = rendered.claims.map((claim) => ({ ...claim, text: claim.quote }));
  const supported = assessment.status === 'supported' && assessment.verified.condition;
  const bn = locale === 'bn';
  const missing = assessment.missingCaseData.map((analyte) => ({
    id: `lab-${analyte}`,
    type: 'test' as const,
    text: bn ? `${ANALYTES[analyte].label[1]} এর ফল রেকর্ড করুন` : `Record the ${ANALYTES[analyte].label[0]} result`,
    why_it_helps: bn ? 'লাইব্রেরির মানদণ্ডের সাথে মেলাতে' : 'Needed to compare with the library criteria',
    which_diagnoses_it_separates: assessment.verified.condition ? [assessment.verified.condition] : [],
  }));
  const analysis: AnalysisOutput = {
    status: supported ? 'ok' : 'insufficient_evidence',
    confidence: {
      label: supported ? 'moderate' : 'insufficient',
      score: supported ? 0.7 : 0,
      reasoning: plain,
    },
    differentials: supported
      ? [
          {
            condition: assessment.verified.condition!,
            likelihood_label: 'high',
            supporting_claims: claims,
            opposing_claims: [],
            clinical_rationale: plain,
          },
        ]
      : [],
    missing_information: missing,
    red_flags: [],
    summary: plain,
  };
  return { analysis, model: llm.model, mode: 'live', rejections: run.rejections };
}
