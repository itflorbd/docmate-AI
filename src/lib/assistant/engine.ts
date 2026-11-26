import { extractClinicalFacts } from '@/lib/clinical-extractor';
import { understandText, type LanguageUnderstandingResult } from '@/lib/language';
import { checkRedFlags } from '@/lib/red-flags';
import { detectSystemQuery } from '@/lib/system-query';
import { analyzeDoctorInput } from '@/lib/persona/humanize/session-adaptive';
import { selectPhrase, type TonePreset } from '@/lib/persona/phrasebank';
import { verifyQuoteInChunk } from '@/lib/verifier';
import { bestSentences, keyTerms, selectExcerpts, type Excerpt } from './excerpts';
import { acceptModelFollowUp, deterministicFollowUp } from './followups';
import { buildMessages, META_DELIMITER } from './prompt';
import { buildWeightedRetrievalQueries } from './retrieval-queries';
import { mentionsDose, parseModelOutput, verifyModelAnswer } from './verify';
import {
  ANALYTES,
  dedupeObservations,
  observationsFromLabValues,
  parseObservations,
  renderAssessment,
  runEvidenceAssessment,
  type Observation,
} from './evidence-assessment';
import type {
  AssistantReply,
  CitedClaim,
  EngineDeps,
  EngineEvent,
  EngineInput,
  ReplyLocale,
} from './types';

// Five-letter stems that mean the same thing in clinical text, for the relevance gate.
const SYNONYM_GROUPS = [
  ['admit', 'admis', 'hospi', 'inpat', 'ward'],
  ['treat', 'thera', 'manag', 'regim', 'presc'],
  ['medic', 'drug', 'antib', 'dose'],
  ['test', 'inves', 'labor', 'ecg', 'troponin', 'count'],
  ['sign', 'sympt', 'featu', 'findi', 'prese'],
  ['dange', 'warni', 'red-f', 'sever', 'emerg'],
  ['disch', 'recov'],
  ['fluid', 'drink', 'hydra', 'ors'],
];
const SYNONYMS: Record<string, string[]> = Object.fromEntries(
  SYNONYM_GROUPS.flatMap((group) => group.map((stem) => [stem, group])),
);

const QUESTION_CUE =
  /[?？]|\b(?:what|which|how|when|why|where|should|can|could|is|are|does|do|dose|guideline|protocol|recommend|differential|treatment|manage|test)\b|কী|কি\b|কোন|কখন|কত|কেন|কীভাবে|কিভাবে|উচিত|চিকিৎসা|পরীক্ষা|ki\b|koto|keno|kivabe/iu;

// Questions that refer to the recorded case rather than a named condition.
const CASE_QUESTION = /\b(?:recorded|documented|this case|the case|this patient|concluded?|conclusion)\b|নথিভুক্ত|রেকর্ড|এই কেস|এই রোগী|সিদ্ধান্ত/iu;

function localized(locale: ReplyLocale, bnText: string, enText: string): string {
  return locale === 'bn' ? bnText : enText;
}

function noEvidenceText(locale: ReplyLocale, tone: string, sessionId: string): string {
  return selectPhrase('no_evidence', locale, { preset: tone as TonePreset, sessionId });
}

function understandingMeta(result: LanguageUnderstandingResult | null): Record<string, unknown> | undefined {
  if (!result) return undefined;
  return {
    detected_lang: result.detectedLang,
    dominant_lang: result.dominantLang,
    canonical_query: result.canonicalEnglishQuery,
    intent: result.intent,
    entities: result.entities,
    ambiguity: result.ambiguity,
  };
}

/** Deterministic library-excerpt answer used when no model is available or the model fails. */
export function excerptAnswer(
  excerpts: Excerpt[],
  queries: string[],
  locale: ReplyLocale,
): { text: string; claims: CitedClaim[] } {
  const terms = keyTerms(queries);
  const claims: CitedClaim[] = [];
  const lines: string[] = [];

  for (const excerpt of excerpts.slice(0, 2)) {
    const sentences = bestSentences(excerpt.chunk.text, terms, 2);
    if (sentences.length === 0) continue;
    const quote = sentences.join(' ');
    if (!verifyQuoteInChunk(quote, excerpt.chunk.text) && !sentences.every((s) => verifyQuoteInChunk(s, excerpt.chunk.text))) {
      continue;
    }
    for (const sentence of sentences) {
      const ref = claims.length + 1;
      claims.push({
        ref,
        text: sentence,
        claim_text: sentence,
        quote: sentence,
        chunk_id: excerpt.chunk.id,
        source_title: excerpt.chunk.source_title,
        source_year: excerpt.chunk.source_year,
        page: excerpt.chunk.page,
        section: excerpt.chunk.section,
        verified: true,
        verification_status: 'verified',
      });
      lines.push(`> ${sentence} [${ref}]`);
    }
    lines.push('');
  }

  if (claims.length === 0) return { text: '', claims };
  const intro = localized(
    locale,
    'পূর্ণ উত্তর তৈরি করা যায়নি। লাইব্রেরির সবচেয়ে কাছের অংশগুলো হুবহু দিচ্ছি, যাচাই করে দেখুন:',
    "I couldn't write a full answer, so here are the closest library passages, quoted word for word:",
  );
  return { text: [intro, '', ...lines].join('\n').trim(), claims };
}

/**
 * App note appended (by code, not the model) to any answer that states a dose.
 * AGENTS.md rule 6: the prescribed dose comes from the formulary, not the chat.
 */
export function doseNoteLine(locale: ReplyLocale): string {
  return `_${localized(locale, 'চূড়ান্ত ডোজ ট্রিটমেন্ট (Treatment) ট্যাবে ফর্মুলারি থেকে ঠিক করুন।', 'Set the final dose in the Treatment tab from the formulary.')}_`;
}

/** Patient data the doctor still needs to record. This is never a library gap. */
export function caseDataNoteLine(locale: ReplyLocale, items: string[]): string {
  return `_${localized(locale, 'এই রোগীর জন্য এখনও দরকার', 'Still needed for this patient')}: ${items.join('; ')}._`;
}

/** App note listing the parts of a question the library does not cover. */
export function missingNoteLine(locale: ReplyLocale, items: string[]): string {
  return `_${localized(locale, 'লাইব্রেরিতে নেই', 'Not covered by the library')}: ${items.join('; ')}._`;
}

/** Plain-English description of the case, used to search the library for a case review. */
export function describeCaseForSearch(patient: EngineInput['patient']): string {
  const vitals = patient?.vitals ?? {};
  const findings: string[] = [];
  if (vitals.temperature_celsius && vitals.temperature_celsius >= 38) findings.push('fever');
  if (vitals.blood_pressure_systolic && vitals.blood_pressure_systolic < 90) findings.push('hypotension low blood pressure');
  if (vitals.blood_pressure_systolic && vitals.blood_pressure_systolic >= 140) findings.push('high blood pressure hypertension');
  if (vitals.heart_rate && vitals.heart_rate > 100) findings.push('tachycardia');
  if (vitals.spo2_percent && vitals.spo2_percent < 94) findings.push('low oxygen saturation');
  if (vitals.respiratory_rate && vitals.respiratory_rate >= 30) findings.push('respiratory rate 30');
  return [patient?.chief_complaint, ...(patient?.symptoms ?? []), patient?.history_of_present_illness, ...findings]
    .filter(Boolean)
    .join(', ');
}

/** One-line case summary built from the record (never from the model). */
export function caseSummaryLine(patient: EngineInput['patient'], locale: ReplyLocale): string {
  const isBn = locale === 'bn';
  const sex = { male: isBn ? 'পুরুষ' : 'male', female: isBn ? 'নারী' : 'female', other: isBn ? 'অন্যান্য' : 'other' }[patient?.gender ?? 'other'] ?? '';
  const who = patient?.age !== undefined ? (isBn ? `${patient.age} বছর, ${sex}` : `${patient.age}-year-old ${sex}`) : sex;
  const v = patient?.vitals ?? {};
  const vitals = [
    v.blood_pressure_systolic && v.blood_pressure_diastolic ? `BP ${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}` : null,
    v.heart_rate ? `HR ${v.heart_rate}` : null,
    v.temperature_celsius ? `${isBn ? 'তাপমাত্রা' : 'Temp'} ${v.temperature_celsius}°C` : null,
    v.spo2_percent ? `SpO2 ${v.spo2_percent}%` : null,
    v.respiratory_rate ? `RR ${v.respiratory_rate}` : null,
  ].filter(Boolean);
  const parts = [who, patient?.chief_complaint].filter(Boolean).join(isBn ? ', ' : ' with ');
  const vitalsText = vitals.length ? vitals.join(', ') : isBn ? 'ভাইটালস এখনও রেকর্ড হয়নি' : 'no vitals recorded yet';
  const stop = isBn ? '।' : '.';
  return `**${isBn ? 'কেস' : 'Case'}:** ${parts}${stop} ${vitalsText}${stop}`;
}

/**
 * Spoken version of a reply: the opening sentence plus up to four list items
 * read as one natural sentence, about 60 words at most. Citation markers,
 * Markdown and parenthetical English glosses are removed.
 */
export function speechFrom(text: string, locale: ReplyLocale): string {
  const isBn = locale === 'bn';
  const clean = (line: string) =>
    line
      .replace(/\s?\[\d+\]/g, '')
      .replace(/[*_`#>]/g, '')
      .replace(/^\s*(?:[-•]|\d+[.)])\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  const lines = text.split('\n').map((line) => ({ bullet: /^\s*(?:[-*•]|\d+[.)])\s+/.test(line), text: clean(line) })).filter((line) => line.text);
  if (!lines.length) return '';

  const opening = lines.find((line) => !line.bullet)?.text ?? '';
  const bullets = lines.filter((line) => line.bullet).map((line) => line.text.replace(/[.।:]+$/, ''));
  // Read only the term before a colon or parenthesis: "Persistent vomiting (≥ 3 ...)" → "Persistent vomiting".
  const shortBullets = bullets.map((item) => item.split(/[:(]/)[0].trim()).filter(Boolean).slice(0, 4);
  const sentences = opening.split(/(?<=[.!?।:])\s+/u);
  // Keep the list intro ("The warning signs are:") so the list makes sense when heard.
  const firstSentence = sentences.length > 1 && opening.endsWith(':')
    ? `${sentences[0]} ${sentences[sentences.length - 1]}`
    : sentences[0] ?? '';
  const joiner = isBn ? ', ' : ', ';
  const list = shortBullets.length
    ? shortBullets.length > 1
      ? `${shortBullets.slice(0, -1).join(joiner)}${isBn ? ' এবং ' : ' and '}${shortBullets.at(-1)}`
      : shortBullets[0]
    : '';
  let spoken = [firstSentence, list ? `${list}${isBn ? '।' : '.'}` : ''].filter(Boolean).join(' ');
  const words = spoken.split(' ');
  if (words.length > 60) spoken = `${words.slice(0, 60).join(' ')}…`;
  const more = bullets.length > shortBullets.length || lines.length > 1 + bullets.length;
  const cue = more ? localized(locale, 'বাকিটা স্ক্রিনে আছে।', 'The rest is on screen.') : '';
  return [spoken, cue].filter(Boolean).join(' ');
}

/**
 * Runs one assistant turn: understand → safety → retrieve → generate → verify.
 * Emits progress events and returns the final, verified reply. Never throws for
 * model failures; it falls back to deterministic library excerpts instead.
 */
export async function runAssistantTurn(
  input: EngineInput,
  deps: EngineDeps,
  emit: (event: EngineEvent) => void,
): Promise<AssistantReply> {
  const sessionId = input.sessionId;
  emit({ type: 'trace', step: 'understand', status: 'running' });

  let understanding: LanguageUnderstandingResult | null = null;
  try {
    understanding = await understandText(input.text, {
      userPrefs: { replyLanguage: input.replyLanguagePref, banglishReply: input.banglishReply ?? false },
    });
  } catch {
    understanding = null;
  }
  const locale: ReplyLocale = understanding
    ? understanding.replyLanguage === 'en'
      ? 'en'
      : 'bn'
    : input.replyLanguagePref === 'en'
      ? 'en'
      : 'bn';

  const proposedUpdates = extractClinicalFacts(input.text, input.patient);
  const safetyAlerts = checkRedFlags(
    `${input.text} ${input.patient?.chief_complaint ?? ''} ${(input.patient?.symptoms ?? []).join(' ')}`,
    locale,
  );
  if (safetyAlerts.length) emit({ type: 'safety', alerts: safetyAlerts });
  emit({ type: 'trace', step: 'understand', status: 'done' });

  const base = {
    proposedUpdates,
    safetyAlerts,
    replyLanguage: locale,
    understanding: understandingMeta(understanding),
    droppedClaims: 0,
    missingInformation: [] as string[],
  };

  // 1. Deterministic utility questions (date, time, identity).
  const systemQuery = input.kind === 'question_answer' ? null : detectSystemQuery(input.text);
  if (systemQuery) {
    return {
      ...base,
      text: locale === 'bn' ? systemQuery.answerBn : systemQuery.answerEn,
      status: 'system',
      mode: 'deterministic',
      claims: [],
      followUp: null,
    };
  }

  const signals = analyzeDoctorInput(input.text, { sessionId, turnCount: input.context.turnCount }, safetyAlerts);
  const looksLikeQuestion = QUESTION_CUE.test(input.text);
  const isSocial =
    input.kind === 'observation' &&
    proposedUpdates.length === 0 &&
    safetyAlerts.length === 0 &&
    (signals.isThanks || understanding?.intent === 'greeting') &&
    input.text.length < 80;

  // 2. Pure dictation: confirm extracted facts without a model round-trip.
  const isDictation =
    proposedUpdates.length > 0 &&
    input.kind !== 'evidence_review' &&
    !looksLikeQuestion &&
    (understanding?.intent === 'dictate_intake' || understanding?.intent === 'answer_followup' || input.kind === 'question_answer');
  if (isDictation) {
    const names = proposedUpdates.map((update) => `${locale === 'bn' ? update.label_bn : update.label_en}: **${update.display_value}**`);
    const nextQuestion = deterministicFollowUp(input.patient, input.context.followUps, locale, input.text, proposedUpdates);
    const text = [
      localized(locale, 'নোট করলাম।', 'Noted.'),
      ...names.map((name) => `- ${name}`),
      '',
      localized(locale, 'রোগীর রেকর্ডে যোগ করতে নিচে নিশ্চিত করুন।', 'Confirm below to add these to the patient record.'),
    ].join('\n');
    return { ...base, text, status: 'recorded', mode: 'deterministic', claims: [], followUp: nextQuestion };
  }

  // Patient lab results from the record and the doctor's own messages. They are
  // case data: compared in code against library criteria, never cited to the library.
  const observations: Observation[] = isSocial
    ? []
    : dedupeObservations([
        ...observationsFromLabValues(input.patient?.lab_values ?? []),
        ...input.context.history.filter((message) => message.role === 'doctor').flatMap((message) => parseObservations(message.text, 'clinician_message')),
        ...parseObservations(input.text, 'clinician_message'),
      ]);
  const patientValues = [...new Set(observations.map((observation) => String(observation.value)))];
  // A diagnostic question about this case runs the assessment even before labs
  // are recorded, so the reply can name the results still needed.
  const DIAGNOSTIC_CUE = /\b(?:diagnos\w*|conclu\w*|confirm\w*)\b|রোগনির্ণয়|নির্ণয়|সিদ্ধান্ত|নিশ্চিত/iu;
  const assessCaseQuestion = !isSocial && observations.length === 0 && CASE_QUESTION.test(input.text) && DIAGNOSTIC_CUE.test(input.text);
  // Recorded labs are assessed only when this turn is about them: it reports new
  // results, names a test, or asks about the diagnosis or this case. An unrelated
  // question on a case with labs gets a normal answer.
  const aboutLabs =
    parseObservations(input.text, 'clinician_message').length > 0 ||
    DIAGNOSTIC_CUE.test(input.text) ||
    CASE_QUESTION.test(input.text) ||
    Object.values(ANALYTES).some((analyte) => new RegExp(analyte.names.source, 'iu').test(input.text));
  const runAssessment = !isSocial && ((observations.length > 0 && aboutLabs) || assessCaseQuestion);

  // 3. Retrieval for clinical turns.
  let excerpts: Excerpt[] = [];
  let queries: string[] = [];
  let english: string | null = null;
  // A case review searches with the patient's presentation, not the trigger text.
  const isCaseReview = input.kind === 'evidence_review';
  const caseDescription = isCaseReview ? describeCaseForSearch(input.patient) : '';
  const retrievalText = isCaseReview && caseDescription
    ? caseDescription
    : input.question
      ? `${input.question.text} ${input.text}`
      : input.text;
  if (!isSocial) {
    emit({ type: 'trace', step: 'retrieve', status: 'running' });
    const previousDoctor = [...input.context.history].reverse().find((message) => message.role === 'doctor')?.text;
    // Library sources are English: translate Bangla and Banglish questions first.
    const needsTranslation = /[\u0980-\u09FF]/.test(retrievalText) || understanding?.detectedLang === 'banglish';
    english = needsTranslation && deps.llm?.translate ? await deps.llm.translate(retrievalText) : null;
    const weighted = buildWeightedRetrievalQueries(retrievalText, understanding, input.patient, previousDoctor, english);
    queries = weighted.queries;
    const weights = weighted.weights;
    if (runAssessment) {
      // Also look for the diagnostic criteria for the tests that were recorded (or any known test).
      const tests = observations.length
        ? [...new Set(observations.map((observation) => ANALYTES[observation.analyte].label[0]))].join(' ')
        : Object.values(ANALYTES).map((analyte) => analyte.label[0]).join(' ');
      queries = [...queries, `${tests} diagnostic threshold criteria confirm diagnosis`];
      weights?.push(1);
    }
    try {
      excerpts = selectExcerpts(await deps.retrieve(queries, 8, weights), 6);
      emit({ type: 'trace', step: 'retrieve', status: 'done', count: excerpts.length });
    } catch {
      excerpts = [];
      emit({ type: 'trace', step: 'retrieve', status: 'error' });
    }
  }

  // 3b. Evidence assessment: do the recorded results meet library criteria?
  if (deps.llm && runAssessment && excerpts.length > 0 && !isCaseReview) {
    emit({ type: 'trace', step: 'generate', status: 'running' });
    const run = await runEvidenceAssessment({ excerpts, observations, llm: deps.llm, signal: input.signal });
    emit({ type: 'trace', step: 'generate', status: run.reason ? 'error' : 'done' });
    // Without recorded labs, use the assessment only when the library states
    // criteria; it then says which results to record. Otherwise answer normally.
    if (run.assessment && run.assessment.status !== 'no_criteria' && (observations.length > 0 || run.assessment.status === 'needs_case_data')) {
      emit({ type: 'trace', step: 'verify', status: 'done', count: run.assessment.verified.criteria.length });
      const rendered = renderAssessment(run.assessment, locale);
      const supported = run.assessment.status === 'supported';
      const missing = [
        ...run.assessment.missingCaseData.map((analyte) => ANALYTES[analyte].label[locale === 'bn' ? 1 : 0]),
        ...(run.assessment.status === 'needs_confirmation' ? [locale === 'bn' ? 'দ্বিতীয় ল্যাব ফল' : 'A second lab result'] : []),
      ];
      return {
        ...base,
        text: rendered.text,
        status: supported ? 'answered' : 'insufficient_evidence',
        mode: 'llm',
        claims: rendered.claims,
        followUp: null,
        missingInformation: missing,
        droppedClaims: run.rejections.length,
        rejections: run.rejections.map((rejection) => ({ reason: rejection.reason, detail: `${rejection.part}: ${rejection.detail}` })),
        assessment: { status: run.assessment.status, condition: run.assessment.verified.condition },
        model: deps.llm.model,
      };
    }
    // No verifiable criteria: fall through to the cited free-text answer below.
  }

  // 4. Generation with the model.
  if (deps.llm) {
    emit({ type: 'trace', step: 'generate', status: 'running' });
    const messages = buildMessages({
      locale,
      doctorTitle: input.doctorTitle,
      tone: input.tone,
      verbosity: input.verbosity,
      mode: isSocial ? 'social' : isCaseReview ? 'case_review' : 'clinical',
      patient: input.patient,
      context: input.context,
      excerpts,
      doctorText: input.text,
      questionBeingAnswered: input.question?.text,
      proposedUpdates,
    });

    let raw = '';
    let streamedLength = 0;
    let failed = false;
    try {
      for await (const token of deps.llm.stream(messages, input.signal)) {
        raw += token;
        const delimiterAt = raw.indexOf(META_DELIMITER);
        // Hold back enough characters to never leak a partial delimiter.
        const visibleEnd = delimiterAt === -1 ? Math.max(0, raw.length - META_DELIMITER.length) : delimiterAt;
        if (visibleEnd > streamedLength) {
          emit({ type: 'delta', text: raw.slice(streamedLength, visibleEnd) });
          streamedLength = visibleEnd;
        }
      }
    } catch {
      failed = true;
    }

    if (input.signal.aborted) {
      return { ...base, text: '', status: 'stopped', mode: 'llm', claims: [], followUp: null, model: deps.llm.model };
    }

    const parsed = parseModelOutput(raw);
    if (!failed && parsed.meta) {
      emit({ type: 'trace', step: 'generate', status: 'done' });
      emit({ type: 'trace', step: 'verify', status: 'running' });
      const verified = verifyModelAnswer(parsed.answer, parsed.meta, excerpts, {
        framingWordLimit: isSocial ? 40 : 18,
        allowUncitedProse: isSocial,
        question: input.question ? `${input.question.text} ${input.text}` : input.text,
        patientValues,
      });
      emit({ type: 'trace', step: 'verify', status: 'done', count: verified.claims.length });

      if (isSocial) {
        return {
          ...base,
          text: verified.text || parsed.answer.split('\n')[0].slice(0, 300),
          status: 'social',
          mode: 'llm',
          claims: [],
          followUp: null,
          model: deps.llm.model,
        };
      }

      // Relevance gate: the cited quotes must share at least one key term with
      // the question itself (not the patient context). This stops answers to a
      // different question, e.g. hypertension drugs for a physics question.
      // A question about the case itself ("what can be concluded from the
      // record?") is about the patient's presentation, so those terms count too.
      // A question unrelated to the case still gets no help here.
      let caseTerms = '';
      if (CASE_QUESTION.test(input.text)) {
        const description = describeCaseForSearch(input.patient);
        caseTerms = /[\u0980-\u09FF]/.test(description) && deps.llm.translate ? ((await deps.llm.translate(description)) ?? '') : description;
      }
      const questionSources = [english ?? '', understanding?.canonicalEnglishQuery ?? '', retrievalText, caseTerms];
      const acronyms = questionSources.join(' ').match(/\b[A-Z][A-Z0-9-]{1,6}\b/g)?.map((acronym) => acronym.toLowerCase()) ?? [];
      // Five-letter stems so "definition" matches "defined".
      const questionTerms = [...new Set([...keyTerms(questionSources).map((term) => term.slice(0, 5)), ...acronyms])];
      const citedChunks = excerpts.filter((excerpt) => verified.claims.some((claim) => claim.chunk_id === excerpt.chunk.id));
      const sourceText = citedChunks
        .map((excerpt) => `${excerpt.chunk.source_title ?? ''} ${excerpt.chunk.section ?? ''} ${excerpt.chunk.text}`)
        .join(' ')
        .toLowerCase();
      // One shared term is enough for short questions; longer questions need two,
      // so a single incidental word ("mechanisms") cannot pass the gate.
      const matched = questionTerms.filter((term) => (SYNONYMS[term] ?? [term]).some((variant) => sourceText.includes(variant))).length;
      const relevant = questionTerms.length === 0 || matched >= (questionTerms.length >= 4 ? 2 : 1);
      if (!relevant && process.env.DOCMATE_DEBUG_ASSISTANT === '1') {
        console.warn(`[assistant] relevance gate blocked answer; terms=${questionTerms.join(',')} matched=${matched}; cited=${citedChunks.map((e) => e.chunk.section).join(' | ')}; claims=${verified.claims.map((c) => c.chunk_id).join(',')}`);
      }
      if (!relevant) verified.claims.splice(0, verified.claims.length);
      // The model's own abstention stands even when a related sentence verified.
      const answered = verified.claims.length > 0 && parsed.meta.status !== 'insufficient_evidence';
      const summary = isCaseReview ? `${caseSummaryLine(input.patient, locale)}\n\n` : '';
      const doseNote = answered && mentionsDose(verified.text) ? `\n\n${doseNoteLine(locale)}` : '';
      // A test result, measurement or other patient fact is case data, even if the
      // model listed it as a library gap. Only true library gaps say "not in the library".
      const isCaseItem = (item: string) =>
        /\b(?:result|results|test|value|level|reading|measurement|history|examination|exam)\b|ফল|পরীক্ষা|মান|ইতিহাস/iu.test(item) ||
        Object.values(ANALYTES).some((analyte) => new RegExp(analyte.names.source, 'iu').test(item));
      const libraryGaps = parsed.meta.missing_information.filter((item) => !isCaseItem(item));
      const caseItems = [...new Set([...parsed.meta.missing_case_data, ...parsed.meta.missing_information.filter(isCaseItem)])];
      const missingItems = answered && parsed.meta.status === 'partial' ? libraryGaps.slice(0, 4) : [];
      const missingNote = missingItems.length ? `\n\n${missingNoteLine(locale, missingItems)}` : '';
      // Drop placeholders such as "patient data not recorded yet"; they name nothing to record.
      const caseData = caseItems.filter((item) => !/\b(?:not (?:yet )?(?:recorded|provided|available))\b|নথিভুক্ত (?:নয়|হয়নি)/iu.test(item)).slice(0, 4);
      const caseDataNote = answered && caseData.length ? `\n\n${caseDataNoteLine(locale, caseData)}` : '';
      const text = answered
        ? summary + verified.text + doseNote + missingNote + caseDataNote
        : summary + [noEvidenceText(locale, input.tone, sessionId), relevant ? verified.text : ''].filter(Boolean).join('\n\n');
      const followUp =
        acceptModelFollowUp(parsed.meta.follow_up, input.context.followUps) ??
        (answered && !isCaseReview ? null : deterministicFollowUp(input.patient, input.context.followUps, locale, input.text, proposedUpdates));

      return {
        ...base,
        text,
        status: answered ? 'answered' : 'insufficient_evidence',
        mode: 'llm',
        claims: verified.claims,
        followUp,
        droppedClaims: verified.droppedClaims,
        rejections: verified.rejections,
        missingInformation: answered ? [...caseData, ...missingItems] : [...caseItems, ...libraryGaps],
        model: deps.llm.model,
      };
    }

    // Model failed or returned no usable META block: discard the draft.
    if (process.env.DOCMATE_DEBUG_ASSISTANT === '1') {
      console.warn(`[assistant] model output unusable (${failed ? 'stream error' : 'no valid META'}), ${raw.length} chars; tail: ${raw.slice(-300)}`);
    }
    emit({ type: 'reset' });
    emit({ type: 'trace', step: 'generate', status: 'error' });
  }

  // 5. Deterministic fallback.
  if (isSocial) {
    const text = signals.isThanks
      ? selectPhrase('thanks_reply', locale, { preset: input.tone as TonePreset, doctorTitle: input.doctorTitle, sessionId })
      : selectPhrase('greeting', locale, { preset: input.tone as TonePreset, doctorTitle: input.doctorTitle, sessionId });
    return { ...base, text, status: 'social', mode: 'deterministic', claims: [], followUp: null };
  }

  // Match passages to the question itself; patient context alone must not
  // make a passage look relevant (a case review uses the case description).
  const fallback = excerptAnswer(excerpts, [retrievalText, english ?? ''], locale);
  const found = fallback.claims.length > 0;
  return {
    ...base,
    text: found ? fallback.text : noEvidenceText(locale, input.tone, sessionId),
    status: found ? 'excerpts' : 'insufficient_evidence',
    mode: 'library_excerpts',
    claims: fallback.claims,
    followUp: deterministicFollowUp(input.patient, input.context.followUps, locale, input.text, proposedUpdates),
  };
}
