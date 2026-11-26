import { describe, expect, it } from 'vitest';
import {
  dedupeObservations,
  evaluateAssessment,
  observationsFromLabValues,
  parseObservations,
  renderAssessment,
  runEvidenceAssessment,
  verifyProposal,
  type AssessmentProposal,
} from '@/lib/assistant/evidence-assessment';
import { selectExcerpts } from '@/lib/assistant/excerpts';
import type { ScoredChunk } from '@/lib/retrieval';

// Text of the synthetic judges' reference PDF as the ingester stores it (one chunk, page 1).
const REFERENCE = `DOCMATE AI / JUDGES DEMO LIBRARY
Diabetes diagnostic
reference
Laboratory thresholds in nonpregnant adults
LABORATORY HbA1c (A1C) FASTING PLASMA GLUCOSE (FPG)
6.5% or higher 126 mg/dL or higher
Each threshold falls in the diabetes range. Laboratory fasting plasma glucose is measured after a fast
of at least 8 hours. [1, 2]
Confirm with a second result
A second test is generally used to confirm diabetes. Repeated fasting plasma glucose in the diabetes
range on separate draws supports confirmation. [1, 2]
Use symptoms as clinical context
Frequent urination (polyuria), increased thirst (polydipsia), and fatigue can occur with diabetes.
Keep the diagnosis and its subtype separate
These glucose tests can establish diabetes mellitus. Classifying the subtype requires additional clinical
assessment. If A1C and glucose disagree, review test reliability and possible factors affecting A1C.`;
const OTHER = 'Community-acquired pneumonia is treated with Amoxicillin 500 mg. Fever of 38 C or higher with cough suggests infection.';

const chunk = (id: string, text: string, title: string): ScoredChunk => ({
  id,
  source_id: `src-${id}`,
  source_title: title,
  source_year: 2026,
  section: title,
  page: 1,
  text,
  evidence_level: 'IV',
  created_at: new Date().toISOString(),
  rrfScore: 1,
});
const excerpts = selectExcerpts([chunk('ref', REFERENCE, 'Diabetes Diagnostic Reference'), chunk('other', OTHER, 'Respiratory Guideline')]);
const E = (id: string) => excerpts.find((excerpt) => excerpt.chunk.id === id)!.ref;

const good = (): AssessmentProposal => ({
  condition: 'diabetes mellitus',
  condition_support: { excerpt: E('ref'), quote: 'These glucose tests can establish diabetes mellitus.' },
  criteria: [
    { analyte: 'hba1c', comparator: '>=', threshold: 6.5, unit: '%', excerpt: E('ref'), quote: '6.5% or higher' },
    { analyte: 'fasting_glucose', comparator: '>=', threshold: 126, unit: 'mg/dL', excerpt: E('ref'), quote: '126 mg/dL or higher' },
  ],
  confirmation: { excerpt: E('ref'), quote: 'A second test is generally used to confirm diabetes.' },
  limitation: { excerpt: E('ref'), quote: 'Classifying the subtype requires additional clinical assessment.' },
});

const BN_LABS =
  'নতুন ল্যাব ফল। Day 1 laboratory HbA1c 7.4% এবং ৮ ঘণ্টা fasting-এর পর laboratory fasting plasma glucose 154 mg/dL। Day 8-এ ৮ ঘণ্টা fasting-এর পর repeat laboratory fasting plasma glucose 151 mg/dL।';

describe('patient observations', () => {
  it('reads values and units from a Bangla clinician message', () => {
    const observations = parseObservations(BN_LABS, 'clinician_message');
    expect(observations.map((o) => [o.analyte, o.value, o.unit])).toEqual([
      ['hba1c', 7.4, '%'],
      ['fasting_glucose', 154, 'mg/dL'],
      ['fasting_glucose', 151, 'mg/dL'],
    ]);
    expect(observations[2].when?.toLowerCase()).toBe('repeat');
  });

  it('reads structured lab fields and ignores values without a valid unit', () => {
    const observations = observationsFromLabValues([
      { name: 'HbA1c', value: 7.4, unit: '%' },
      { name: 'Fasting plasma glucose (Day 1)', value: '154', unit: 'mg/dL' },
      { name: 'Repeat fasting plasma glucose (Day 8)', value: 151, unit: 'mg/dL' },
      { name: 'HbA1c', value: 7.4, unit: 'mg/dL' },
    ]);
    expect(observations).toHaveLength(3);
    expect(observations.every((o) => o.source === 'case_record')).toBe(true);
  });

  it('does not invent values from symptoms-only text', () => {
    expect(parseObservations('ছয় সপ্তাহ ধরে বেশি পিপাসা ও ঘন ঘন প্রস্রাব, HbA1c ও fasting plasma glucose দরকার', 'clinician_message')).toEqual([]);
  });
});

describe('evidence assessment', () => {
  const observations = parseObservations(BN_LABS, 'clinician_message');

  it('supports diabetes mellitus, shows each value with its unit and leaves the subtype undetermined', () => {
    const verified = verifyProposal(good(), excerpts);
    expect(verified.rejections).toEqual([]);
    const assessment = evaluateAssessment(verified, observations);
    expect(assessment.status).toBe('supported');
    const en = renderAssessment(assessment, 'en');
    expect(en.text).toContain('**diabetes mellitus**');
    for (const value of ['7.4%', '154 mg/dL', '151 mg/dL', '≥ 6.5%', '≥ 126 mg/dL']) expect(en.text).toContain(value);
    expect(en.text).toContain('Subtype not determined');
    expect(en.text).not.toMatch(/type\s*2/i);
    expect(en.claims.every((claim) => claim.chunk_id === 'ref')).toBe(true);
    const bn = renderAssessment(assessment, 'bn');
    expect(bn.text).toContain('7.4%');
    expect(bn.text).toContain('ধরন (subtype) নির্ধারিত হয়নি');
  });

  it('asks for case data, not library evidence, when labs are missing', () => {
    const assessment = evaluateAssessment(verifyProposal(good(), excerpts), []);
    expect(assessment.status).toBe('needs_case_data');
    expect(assessment.missingCaseData).toEqual(['hba1c', 'fasting_glucose']);
    expect(renderAssessment(assessment, 'en').text).toContain('Still needed for this patient');
    expect(renderAssessment(assessment, 'en').text).not.toMatch(/not in the library/i);
  });

  it('abstains when results conflict', () => {
    const conflicting = parseObservations('HbA1c 5.9% and fasting plasma glucose 154 mg/dL', 'clinician_message');
    expect(evaluateAssessment(verifyProposal(good(), excerpts), conflicting).status).toBe('conflicting');
  });

  it('needs confirmation when only one result meets the criteria', () => {
    const single = parseObservations('fasting plasma glucose 154 mg/dL', 'clinician_message');
    expect(evaluateAssessment(verifyProposal(good(), excerpts), single).status).toBe('needs_confirmation');
  });

  it('a changed patient value changes the result; it is never taken from the model', () => {
    const changed = parseObservations('HbA1c 6.1% and fasting plasma glucose 110 mg/dL and repeat fasting plasma glucose 112 mg/dL', 'clinician_message');
    const assessment = evaluateAssessment(verifyProposal(good(), excerpts), changed);
    expect(assessment.status).not.toBe('supported');
    expect(assessment.results.every((result) => !result.meets)).toBe(true);
  });

  it('converts mmol/L glucose before comparing', () => {
    const mmol = parseObservations('fasting plasma glucose 8.5 mmol/L and repeat fasting plasma glucose 8.4 mmol/L', 'clinician_message');
    expect(evaluateAssessment(verifyProposal(good(), excerpts), mmol).results.every((result) => result.meets)).toBe(true);
  });
});

describe('a rejected criterion never hides a recorded value', () => {
  const observations = parseObservations(BN_LABS, 'clinician_message');
  // The quote the model produced in a live run: two table cells joined, so not verbatim.
  const merged = (): AssessmentProposal => {
    const proposal = good();
    proposal.criteria[0].quote = 'LABORATORY HbA1c (A1C) 6.5% or higher';
    return proposal;
  };

  it('shows the HbA1c value as not compared when its criterion fails verification', () => {
    const verified = verifyProposal(merged(), excerpts);
    expect(verified.rejections.map((r) => r.reason)).toEqual(['altered_quote']);
    const assessment = evaluateAssessment(verified, observations);
    expect(assessment.unassessed.map((o) => o.analyte)).toEqual(['hba1c']);
    const en = renderAssessment(assessment, 'en');
    expect(en.text).toContain('**7.4%**');
    expect(en.text).toContain('not compared');
    expect(en.text).not.toContain('meets ≥ 6.5%');
    expect(renderAssessment(assessment, 'bn').text).toContain('তুলনা করা হয়নি');
  });

  it('retries once with the rejection reasons; the retry passes the same verifier', async () => {
    const outputs = [JSON.stringify(merged()), JSON.stringify(good())];
    const prompts: string[] = [];
    const llm = {
      model: 'fake-model',
      stream: async function* (messages: { content: string }[]) {
        prompts.push(messages[messages.length - 1].content);
        yield outputs.shift() ?? '';
      },
    };
    const run = await runEvidenceAssessment({ excerpts, observations, llm });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('altered_quote');
    expect(run.assessment?.verified.criteria.map((c) => c.analyte)).toEqual(['hba1c', 'fasting_glucose']);
    expect(run.assessment?.unassessed).toEqual([]);
    expect(run.rejections.map((r) => r.part)).toEqual(['attempt 1: criterion 1 (hba1c)']);
  });

  it('retries once after a model stream error', async () => {
    let calls = 0;
    const llm = {
      model: 'fake-model',
      stream: async function* () {
        calls += 1;
        if (calls === 1) throw new Error('stream error');
        yield JSON.stringify(good());
      },
    };
    const run = await runEvidenceAssessment({ excerpts, observations, llm });
    expect(calls).toBe(2);
    expect(run.assessment?.status).toBe('supported');
  });

  it('keeps the first proposal when the retry is no better', async () => {
    const llm = {
      model: 'fake-model',
      stream: async function* () {
        yield JSON.stringify(merged());
      },
    };
    const run = await runEvidenceAssessment({ excerpts, observations, llm });
    expect(run.assessment?.status).toBe('supported');
    expect(run.assessment?.unassessed.map((o) => o.analyte)).toEqual(['hba1c']);
    expect(run.rejections).toHaveLength(2);
  });
});

describe('negative controls: each bad proposal part is rejected with its reason', () => {
  const reasons = (proposal: AssessmentProposal) => verifyProposal(proposal, excerpts).rejections.map((r) => r.reason);

  it('wrong chunk id', () => {
    const proposal = good();
    proposal.criteria[0].excerpt = E('other');
    expect(reasons(proposal)).toContain('wrong_chunk');
  });

  it('altered quote', () => {
    const proposal = good();
    proposal.criteria[0].quote = 'HbA1c of 6.5% or higher';
    expect(reasons(proposal)).toContain('altered_quote');
  });

  it('altered threshold or unit', () => {
    const proposal = good();
    proposal.criteria[0].threshold = 6.0;
    proposal.criteria[1].unit = 'mmol/L';
    expect(reasons(proposal).filter((reason) => reason === 'unsupported_inference')).toHaveLength(2);
  });

  it('irrelevant but verbatim quote', () => {
    const proposal = good();
    proposal.criteria = [{ analyte: 'fasting_glucose', comparator: '>=', threshold: 38, unit: 'mg/dL', excerpt: E('other'), quote: 'Fever of 38 C or higher with cough suggests infection.' }];
    expect(reasons(proposal)).toEqual(expect.arrayContaining(['unsupported_inference']));
    const irrelevant = good();
    irrelevant.condition_support = { excerpt: E('ref'), quote: 'Frequent urination (polyuria), increased thirst (polydipsia), and fatigue can occur with diabetes.' };
    expect(reasons(irrelevant)).toContain('irrelevant_quote');
  });

  it('unsupported subtype', () => {
    const proposal = good();
    proposal.condition = 'type 2 diabetes mellitus';
    expect(reasons(proposal)).toContain('unsupported_subtype');
    expect(evaluateAssessment(verifyProposal(proposal, excerpts), parseObservations(BN_LABS, 'clinician_message')).status).toBe('no_criteria');
  });

  it('a threshold quote without its analyte nearby is irrelevant', () => {
    const proposal = good();
    proposal.criteria = [{ analyte: 'hba1c', comparator: '>=', threshold: 500, unit: '%', excerpt: E('other'), quote: 'Amoxicillin 500 mg' }];
    expect(reasons(proposal)).toContain('unsupported_inference');
  });

  it('dedupes the same value reported in the record and a message', () => {
    const both = dedupeObservations([...observationsFromLabValues([{ name: 'HbA1c', value: 7.4, unit: '%' }]), ...parseObservations('HbA1c 7.4%', 'clinician_message')]);
    expect(both).toHaveLength(1);
  });
});

describe('doctor chat uses the same evidence rules', async () => {
  const { runAssistantTurn } = await import('@/lib/assistant/engine');
  const { buildConversationContext } = await import('@/lib/assistant/context');
  const { verifyModelAnswer } = await import('@/lib/assistant/verify');
  const fakeLlm = (output: string) => ({
    model: 'fake-model',
    stream: async function* () {
      yield output;
    },
  });
  const patient = { age: 47, gender: 'male' as const, chief_complaint: 'Thirst and frequent urination', symptoms: [], past_medical_history: [], current_medicines: [], allergies: [], vitals: {}, lab_values: [] };
  const turn = (text: string, output: string) =>
    runAssistantTurn(
      { sessionId: 't', text, kind: 'observation', patient, context: buildConversationContext([]), replyLanguagePref: 'en', doctorTitle: 'Doctor', tone: 'friendly', verbosity: 'normal', signal: new AbortController().signal },
      { retrieve: async () => [chunk('ref', REFERENCE, 'Diabetes Diagnostic Reference')], llm: fakeLlm(output) },
      () => {},
    );
  const labs = 'HbA1c 7.4%, fasting plasma glucose 154 mg/dL, repeat fasting plasma glucose 151 mg/dL. What is the best-supported diagnosis?';

  it('answers with the verified assessment and links each criterion to its quote', async () => {
    const proposal = { ...good() };
    proposal.criteria = proposal.criteria.map((c) => ({ ...c, excerpt: 'E1' }));
    proposal.condition_support = { excerpt: 'E1', quote: 'These glucose tests can establish diabetes mellitus.' };
    proposal.confirmation = { excerpt: 'E1', quote: 'A second test is generally used to confirm diabetes.' };
    proposal.limitation = { excerpt: 'E1', quote: 'Classifying the subtype requires additional clinical assessment.' };
    const reply = await turn(labs, JSON.stringify(proposal));
    expect(reply.status).toBe('answered');
    expect(reply.assessment).toEqual({ status: 'supported', condition: 'diabetes mellitus' });
    expect(reply.text).toContain('7.4%');
    expect(reply.claims.map((claim) => claim.quote)).toContain('126 mg/dL or higher');
  });

  it('does not run the lab assessment for an unrelated question on a case with recorded labs', async () => {
    const withLabs = { ...patient, lab_values: [{ name: 'HbA1c', value: 7.9, unit: '%' }] };
    const reply = await runAssistantTurn(
      { sessionId: 't', text: 'quantum entanglement', kind: 'observation', patient: withLabs, context: buildConversationContext([]), replyLanguagePref: 'en', doctorTitle: 'Doctor', tone: 'friendly', verbosity: 'normal', signal: new AbortController().signal },
      { retrieve: async () => [chunk('ref', REFERENCE, 'Diabetes Diagnostic Reference')], llm: fakeLlm(JSON.stringify(good())) },
      () => {},
    );
    expect(reply.assessment).toBeUndefined();
    expect(reply.text).not.toContain('7.9%');
  });

  it('does not show a diagnosis when the proposal cites the wrong chunk', async () => {
    const proposal = { ...good(), criteria: good().criteria.map((c) => ({ ...c, excerpt: 'E9' })), condition_support: { excerpt: 'E9', quote: 'These glucose tests can establish diabetes mellitus.' } };
    const reply = await turn(labs, JSON.stringify(proposal));
    expect(reply.assessment).toBeUndefined();
    expect(reply.text).not.toContain('meets');
  });

  it('drops a free-text sentence that cites a library quote for a patient value', () => {
    const answer = 'HbA1c 7.4% confirms diabetes [1].';
    const meta = { claims: [{ id: 1, excerpt: 'E1', quote: 'LABORATORY HbA1c (A1C) FASTING PLASMA GLUCOSE (FPG)' }] };
    const result = verifyModelAnswer(answer, meta, selectExcerpts([chunk('ref', REFERENCE, 'Ref')]), { question: labs, patientValues: ['7.4', '154', '151'] });
    expect(result.text).toBe('');
    expect(result.rejections[0].reason).toBe('patient_value_cited_to_library');
  });

  it('reports an altered quote with its reason', () => {
    const meta = { claims: [{ id: 1, excerpt: 'E1', quote: 'HbA1c of 6.5% or more establishes type 2 diabetes' }] };
    const result = verifyModelAnswer('Type 2 diabetes is established [1].', meta, selectExcerpts([chunk('ref', REFERENCE, 'Ref')]));
    expect(result.rejections.map((r) => r.reason)).toContain('altered_quote');
    expect(result.text).not.toMatch(/type 2/i);
  });
});
