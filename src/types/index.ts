export type UserRole = 'super_admin' | 'doctor' | 'student' | 'researcher' | 'patient' | 'medicine_controller';

export type FeatureKey =
  | 'patients.manage'
  | 'ai.analyze'
  | 'ai.treatment'
  | 'prescription.create'
  | 'library.ask'
  | 'library.browse'
  | 'library.manage'
  | 'library.ingest'
  | 'library.review'
  | 'library.retire'
  | 'medicine.search'
  | 'medicine.interactions'
  | 'medicine.manage'
  | 'medicine.notices'
  | 'study.tools'
  | 'research.tools'
  | 'patient.portal'
  | 'feedback.send'
  | 'feedback.review'
  | 'users.manage'
  | 'access.manage'
  | 'plans.billing'
  | 'ai.settings'
  | 'audit.read'
  | 'system.manage'
  | 'patient.search'
  | 'patient.create'
  | 'history.request'
  | 'history.view'
  | 'portal.profiles'
  | 'portal.prescriptions'
  | 'portal.reports'
  | 'portal.medicine_schedule'
  | 'portal.permissions'
  | 'portal.access_log'
  | 'voice.assistant'
  | 'voice.dictation'
  | 'voice.avatar'
  | 'voice.readaloud'
  | 'language.prefs'
  | 'language.aliases.manage'
  | 'language.phonetic_typing'
  | 'assistant.personalize'
  | 'assistant.phrasebank.manage';

export type DetectedLanguage = 'bn' | 'en' | 'banglish' | 'mixed';

export type LanguageIntent =
  | 'ask_library'
  | 'medicine_lookup'
  | 'dictate_intake'
  | 'answer_followup'
  | 'navigate'
  | 'ask_capabilities'
  | 'patient_history'
  | 'other';

export type TermCategory =
  | 'symptom'
  | 'sign'
  | 'disease'
  | 'medicine_generic'
  | 'medicine_brand'
  | 'body_part'
  | 'unit'
  | 'duration'
  | 'number'
  | 'negation';

export interface UserLanguagePreferences {
  replyLanguage: 'auto' | 'bn' | 'en';
  banglishReply: boolean;
  sttMode: 'auto' | 'bn' | 'en';
  showUnderstanding: boolean;
  phoneticTyping: boolean;
}

export type UserStatus = 'active' | 'pending_verification' | 'suspended';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  status?: UserStatus;
  phone?: string;
  bmdc_number?: string;
  org_id?: string;
  mfa_enabled?: boolean;
  created_at: string;
}

export interface FeatureRecord {
  key: FeatureKey;
  description: string;
  category: 'clinical' | 'library' | 'medicine' | 'study' | 'research' | 'patient' | 'feedback' | 'admin';
  created_at: string;
}

export interface RoleFeature {
  id: string;
  role: UserRole;
  feature_key: FeatureKey;
  enabled: boolean;
  daily_limit?: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserFeatureOverride {
  id: string;
  user_id: string;
  feature_key: FeatureKey;
  enabled: boolean;
  daily_limit?: number | null;
  expires_at?: string | null;
  reason?: string | null;
  created_by?: string | null;
  created_at: string;
}

export type SourceType = 'textbook' | 'guideline' | 'journal' | 'drug' | 'journal_article' | 'review' | 'case_report' | 'other';

export interface Source {
  id: string;
  title: string;
  type: SourceType;
  year: number;
  authors?: string[];
  journal_or_publisher?: string | null;
  doi?: string | null;
  pmid?: string | null;
  canonical_url?: string | null;
  language?: 'bn' | 'en' | 'mixed';
  source_type?: SourceType;
  evidence_level?: 'Ia' | 'Ib' | 'IIa' | 'IIb' | 'III' | 'IV';
  license: string;
  copyright_holder?: string | null;
  rights_confirmed_by?: string | null;
  rights_confirmed_at?: string | null;
  lifecycle?: SourceLifecycle;
  current_version_id?: string | null;
  url?: string;
  status: 'active' | 'archived';
  created_at: string;
}

export interface Chunk {
  id: string;
  source_id: string;
  source_version_id?: string | null;
  source_title?: string;
  source_year?: number;
  ordinal?: number;
  heading_path?: string | null;
  page_start?: number;
  page_end?: number;
  page?: number;
  section: string;
  kind?: ChunkKind;
  text: string;
  embedding_text?: string | null;
  content_hash?: string | null;
  token_count?: number;
  language?: string;
  embedding?: number[];
  evidence_level: 'Ia' | 'Ib' | 'IIa' | 'IIb' | 'III' | 'IV';
  hash?: string;
  status?: 'active' | 'retired';
  created_at: string;
}

export interface PatientVitals {
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature_celsius?: number;
  spo2_percent?: number;
}

export interface LabValue {
  name: string;
  value: number | string;
  unit: string;
  reference_range?: string;
}

export interface StructuredPatientInput {
  age: number;
  gender: 'male' | 'female' | 'other';
  weight_kg?: number;
  chief_complaint: string;
  symptoms: string[];
  history_of_present_illness?: string;
  past_medical_history: string[];
  current_medicines: string[];
  allergies: string[];
  vitals: PatientVitals;
  lab_values: LabValue[];
  is_pregnant?: boolean;
  pregnancy_trimester?: 1 | 2 | 3;
  egfr?: number;
  /** Where the patient is treated today. Guideline advice can differ by setting. */
  care_setting?: 'outpatient' | 'inpatient' | 'intensive_care';
  /** Documented illness severity, when explicitly recorded. Never guessed. */
  severity?: 'mild' | 'moderate' | 'severe';
  /** Documented local epidemiological / resistance region context, when recorded. */
  region?: string;
  /** Follow-up visit: labelled measurements and labs from the earlier visit. Never read as today's values. */
  prior_visit?: { case_id: string; historical: { label: string; value: string | null; visit_date: string; case_id: string }[] };
  examination_findings?: string;
  clinical_notes?: string;
}

export type CaseStatus = 
  | 'draft' 
  | 'analyzed' 
  | 'insufficient_evidence' 
  | 'red_flag' 
  | 'confirmed' 
  | 'treated' 
  | 'closed';

export interface PatientCase {
  id: string;
  doctor_id: string;
  patient_code: string;
  status: CaseStatus;
  structured_input: StructuredPatientInput;
  confirmed_diagnosis?: string;
  created_at: string;
  updated_at: string;
}

export interface CaseTurn {
  id: string;
  case_id: string;
  role: 'doctor' | 'system';
  content: {
    type: 'question_answer' | 'doctor_note' | 'status_change';
    question_id?: string;
    question?: string;
    answer?: string;
    note?: string;
  };
  created_at: string;
}

export interface VerifiedClaim {
  text: string;
  claim_text?: string;
  chunk_id: string;
  quote: string;
  source_title?: string;
  source_year?: number;
  page?: number;
  verified: boolean;
  verification_status?: 'verified' | 'unverified';
}

export interface DifferentialDiagnosis {
  condition: string;
  condition_bn?: string;
  likelihood_label: 'high' | 'moderate' | 'low';
  supporting_claims: VerifiedClaim[];
  opposing_claims: VerifiedClaim[];
  clinical_rationale: string;
}

export interface MissingInformation {
  id: string;
  type: 'question' | 'exam' | 'test';
  text: string;
  why_it_helps: string;
  which_diagnoses_it_separates: string[];
  quick_answers?: string[];
}

export type ConfidenceScoreLabel = 'high' | 'moderate' | 'low' | 'insufficient';

export interface AnalysisOutput {
  status: 'ok' | 'insufficient_evidence' | 'red_flag';
  confidence: {
    label: ConfidenceScoreLabel;
    score: number; // 0 to 1
    reasoning: string;
  };
  differentials: DifferentialDiagnosis[];
  missing_information: MissingInformation[];
  red_flags: string[];
  summary: string;
}

export interface AnalysisRecord {
  id: string;
  case_id: string;
  round: number;
  output: AnalysisOutput;
  model: string;
  tokens?: number;
  created_at: string;
}

export interface DoseRules {
  standard_adult: string;
  route: 'oral' | 'iv' | 'im' | 'topical' | 'inhalation' | 'sublingual';
  frequency: string;
  duration_days: number;
  max_daily_dose?: string;
  pediatric?: string;
  notes?: string;
}

export interface Contraindications {
  conditions: string[];
  allergies: string[];
  age_min?: number;
  age_max?: number;
}

export interface RenalAdjustment {
  egfr_threshold: number;
  action: 'reduce_dose' | 'avoid' | 'extend_interval';
  adjusted_dose?: string;
  note: string;
}

export interface DrugRecord {
  id: string;
  generic_name: string;
  brand_names?: string[];
  drug_class: string;
  indications: string[];
  dose_rules: DoseRules;
  contraindications: Contraindications;
  pregnancy_category: 'A' | 'B' | 'C' | 'D' | 'X';
  renal_adjustment?: RenalAdjustment;
  source_chunk_id?: string;
  source_title?: string;
}

export interface DrugInteractionRecord {
  id: string;
  drug_a: string;
  drug_b: string;
  severity: 'info' | 'warning' | 'critical';
  note: string;
  source_chunk_id?: string;
}

export type SafetyAlertSeverity = 'info' | 'warning' | 'critical';

export interface SafetyAlert {
  id: string;
  drug_id: string;
  drug_name: string;
  severity: SafetyAlertSeverity;
  type: 'allergy' | 'drug_interaction' | 'contraindication' | 'pregnancy' | 'renal' | 'age' | 'duplicate_therapy';
  title: string;
  description: string;
  acknowledged?: boolean;
}

export interface TreatmentSuggestion {
  drug_id: string;
  generic_name: string;
  drug_class: string;
  rationale: string;
  claim: VerifiedClaim;
  dose_text: string;
  route: string;
  frequency: string;
  duration_days: number;
  monitoring: string[];
  follow_up: string;
}

export interface TreatmentPlan {
  confirmed_diagnosis: string;
  first_line: TreatmentSuggestion[];
  alternatives: TreatmentSuggestion[];
  safety_alerts: SafetyAlert[];
  non_pharmacological: string[];
  doctor_decision?: {
    approved_drug_ids: string[];
    doctor_notes: string;
    finalized: boolean;
    acknowledged_alert_ids: string[];
    signature: string;
    finalized_at: string;
  };
}

export interface AuditLogRecord {
  id: string;
  case_id?: string;
  user_id?: string;
  event: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export type SourceLifecycle = 'draft' | 'in_review' | 'approved' | 'published' | 'retired' | 'retracted';
export type ChunkKind = 'body' | 'table' | 'list' | 'skip' | 'references';
export type IngestJobStatus = 'pending' | 'processing' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
export type IngestJobStage =
  | 'queued'
  | 'receiving'
  | 'deduping_file'
  | 'extracting'
  | 'ocring'
  | 'cleaning'
  | 'quality_check'
  | 'extracting_metadata'
  | 'deduping_metadata'
  | 'chunking'
  | 'deduping_chunks'
  | 'cost_estimation'
  | 'embedding'
  | 'indexing'
  | 'safety_scanning'
  | 'completed';
export type DuplicateLevel = 'file_hash' | 'doi_url' | 'metadata' | 'fingerprint';
export type DuplicateDecision = 'skip' | 'new_version' | 'keep_both';

// --- Next-Level Clinical AI Co-Pilot Types ---

export type LabAcuity = 'critical' | 'abnormal' | 'normal';

export interface LabItemInterpretation {
  key: string;
  nameBn: string;
  nameEn: string;
  value: number | string;
  unit: string;
  referenceRange: string;
  acuity: LabAcuity;
  clinicalMeaningBn: string;
  clinicalMeaningEn: string;
  physiologicalRoleBn?: string;
  physiologicalRoleEn?: string;
}

export interface LabInterpretationResult {
  hasLabData: boolean;
  overallAcuity: LabAcuity;
  items: LabItemInterpretation[];
  clinicalSummaryBn: string;
  clinicalSummaryEn: string;
  differentialImpactBn: string[];
  differentialImpactEn: string[];
  actionableNextStepsBn: string[];
  actionableNextStepsEn: string[];
}

export interface ClinicalScoreVariable {
  name: string;
  value: string | number | boolean;
  points: number;
}

export interface ClinicalScoreResult {
  calculatorId: 'curb65' | 'crb65' | 'dengue_warning' | 'gcs';
  nameBn: string;
  nameEn: string;
  score: number;
  maxScore: number;
  riskTier: 'low' | 'moderate' | 'high' | 'critical';
  riskDescriptionBn: string;
  riskDescriptionEn: string;
  recommendationBn: string;
  recommendationEn: string;
  variables: ClinicalScoreVariable[];
  sourceGuideline?: string;
}

export interface GuidelineConsensusItem {
  sourceTitle: string;
  sourceYear?: number;
  chunkId: string;
  verbatimQuote: string;
  recommendationType: 'diagnosis' | 'treatment' | 'investigation' | 'red_flag';
  recommendationBn: string;
  recommendationEn: string;
}

export interface ConsensusSummary {
  topic: string;
  consensusStatus: 'strong_consensus' | 'guideline_supported' | 'single_source' | 'insufficient';
  agreementsBn: string[];
  agreementsEn: string[];
  sourceItems: GuidelineConsensusItem[];
  discrepanciesBn?: string[];
  discrepanciesEn?: string[];
}

export interface DecisionChip {
  id: string;
  type: 'action' | 'investigation' | 'prescription' | 'question';
  labelBn: string;
  labelEn: string;
  payload?: Record<string, unknown>;
}

