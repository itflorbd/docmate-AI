import { pgTable, text, varchar, integer, timestamp, jsonb, uuid, customType, index, boolean, numeric, unique, real } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';

export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 50 }).notNull().default('doctor'), // 'super_admin' | 'doctor' | 'student' | 'researcher' | 'patient' | 'medicine_controller'
  name: text('name').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'), // 'active' | 'pending_verification' | 'suspended'
  mfaSecret: text('mfa_secret'),
  mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until'),
  phone: varchar('phone', { length: 30 }),
  bmdcNumber: varchar('bmdc_number', { length: 50 }),
  orgId: uuid('org_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sourceFiles = pgTable('source_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  storageKey: text('storage_key').notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  mime: varchar('mime', { length: 100 }).notNull(),
  size: integer('size').notNull(),
  originalName: text('original_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('source_files_sha256_idx').on(table.sha256),
]);

export const sources = pgTable('sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  authors: jsonb('authors').default([]).notNull(), // string[]
  type: varchar('type', { length: 50 }).notNull(), // 'textbook' | 'guideline' | 'journal' | 'drug'
  year: integer('year').notNull(),
  yearVerified: boolean('year_verified').default(true).notNull(),
  journalOrPublisher: text('journal_or_publisher'),
  doi: text('doi'),
  pmid: text('pmid'),
  canonicalUrl: text('canonical_url'),
  language: varchar('language', { length: 20 }).default('mixed').notNull(), // 'bn' | 'en' | 'mixed'
  sourceType: varchar('source_type', { length: 50 }).default('guideline').notNull(), // 'textbook' | 'guideline' | 'journal_article' | 'review' | 'case_report' | 'other'
  evidenceLevel: varchar('evidence_level', { length: 10 }).default('Ia').notNull(),
  license: text('license').notNull().default('Open Access / Academic Demo'),
  copyrightHolder: text('copyright_holder'),
  rightsConfirmedBy: uuid('rights_confirmed_by').references(() => users.id, { onDelete: 'set null' }),
  rightsConfirmedAt: timestamp('rights_confirmed_at', { withTimezone: true }),
  lifecycle: varchar('lifecycle', { length: 30 }).default('published').notNull(), // 'draft' | 'in_review' | 'approved' | 'published' | 'retired' | 'retracted'
  currentVersionId: uuid('current_version_id'),
  url: text('url'),
  status: varchar('status', { length: 50 }).notNull().default('active'), // 'active' | 'archived'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('sources_doi_idx').on(table.doi),
  index('sources_canonical_url_idx').on(table.canonicalUrl),
  index('sources_lifecycle_idx').on(table.lifecycle),
]);

export const sourceVersions = pgTable('source_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'cascade' }).notNull(),
  versionNo: integer('version_no').default(1).notNull(),
  changeNote: text('change_note'),
  fileId: uuid('file_id').references(() => sourceFiles.id, { onDelete: 'set null' }),
  textFingerprint: text('text_fingerprint'), // 64-bit simhash hex
  extractionQuality: integer('extraction_quality').default(100).notNull(), // 0 to 100
  pageCount: integer('page_count').default(1).notNull(),
  tokenCount: integer('token_count').default(0).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('source_versions_source_id_idx').on(table.sourceId),
  unique('source_versions_source_version_unique').on(table.sourceId, table.versionNo),
]);

export const ingestJobs = pgTable('ingest_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'cascade' }),
  sourceVersionId: uuid('source_version_id').references(() => sourceVersions.id, { onDelete: 'cascade' }),
  inputType: varchar('input_type', { length: 30 }).notNull(), // 'file' | 'url' | 'doi' | 'json' | 'zip'
  status: varchar('status', { length: 30 }).default('pending').notNull(), // 'pending' | 'processing' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled'
  stage: varchar('stage', { length: 50 }).default('queued').notNull(),
  progress: integer('progress').default(0).notNull(), // 0 to 100
  error: text('error'),
  attempts: integer('attempts').default(0).notNull(),
  estimatedTokens: integer('estimated_tokens').default(0).notNull(),
  estimatedCost: numeric('estimated_cost', { precision: 10, scale: 4 }).default('0').notNull(),
  tokensUsed: integer('tokens_used').default(0).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ingest_jobs_status_idx').on(table.status),
  index('ingest_jobs_source_id_idx').on(table.sourceId),
]);

export const embeddingCache = pgTable('embedding_cache', {
  id: text('id').primaryKey(), // `${contentHash}:${model}`
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('embedding_cache_hash_idx').on(table.contentHash),
]);

export const duplicateCandidates = pgTable('duplicate_candidates', {
  id: uuid('id').defaultRandom().primaryKey(),
  newSourceId: uuid('new_source_id').references(() => sources.id, { onDelete: 'cascade' }).notNull(),
  existingSourceId: uuid('existing_source_id').references(() => sources.id, { onDelete: 'cascade' }).notNull(),
  level: varchar('level', { length: 30 }).notNull(), // 'file_hash' | 'doi_url' | 'metadata' | 'fingerprint'
  score: numeric('score', { precision: 5, scale: 2 }).notNull(),
  decision: varchar('decision', { length: 30 }), // 'skip' | 'new_version' | 'keep_both'
  decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('dup_cand_new_source_idx').on(table.newSourceId),
  index('dup_cand_existing_source_idx').on(table.existingSourceId),
]);

export const chunks = pgTable('chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'cascade' }).notNull(),
  sourceVersionId: uuid('source_version_id').references(() => sourceVersions.id, { onDelete: 'set null' }),
  ordinal: integer('ordinal').default(0).notNull(),
  headingPath: text('heading_path'),
  pageStart: integer('page_start').default(1).notNull(),
  pageEnd: integer('page_end').default(1).notNull(),
  page: integer('page').default(1),
  section: text('section').notNull(),
  kind: varchar('kind', { length: 30 }).default('body').notNull(), // 'body' | 'table' | 'list' | 'skip' | 'references'
  text: text('text').notNull(),
  embeddingText: text('embedding_text'),
  contentHash: text('content_hash'),
  tokenCount: integer('token_count').default(0).notNull(),
  language: varchar('language', { length: 20 }).default('en').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  tsv: tsvector('tsv'),
  evidenceLevel: varchar('evidence_level', { length: 10 }).notNull().default('Ia'), // 'Ia' | 'Ib' | 'IIa' | 'IIb' | 'III' | 'IV'
  hash: text('hash'),
  status: varchar('status', { length: 30 }).default('active').notNull(), // 'active' | 'retired'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('chunks_tsv_idx').using('gin', table.tsv),
  index('chunks_content_hash_idx').on(table.contentHash),
  index('chunks_source_version_idx').on(table.sourceVersionId),
  index('chunks_status_idx').on(table.status),
]);

export const patientAccounts = pgTable('patient_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: varchar('phone', { length: 30 }).notNull().unique(), // E.164 +8801XXXXXXXXX
  phoneNormalized: varchar('phone_normalized', { length: 30 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('patient_accounts_phone_idx').on(table.phoneNormalized),
]);

export const patientProfiles = pgTable('patient_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => patientAccounts.id, { onDelete: 'cascade' }).notNull(),
  relation: varchar('relation', { length: 30 }).default('self').notNull(), // 'self' | 'child' | 'spouse' | 'parent' | 'other'
  name: text('name').notNull(),
  nameEncrypted: text('name_encrypted'),
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
  age: integer('age').notNull(),
  gender: varchar('gender', { length: 20 }).notNull(),
  sex: varchar('sex', { length: 20 }),
  bloodGroup: varchar('blood_group', { length: 10 }),
  addressEncrypted: text('address_encrypted'),
  nidEncrypted: text('nid_encrypted'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  claimed: boolean('claimed').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const profileHealthSummary = pgTable('profile_health_summary', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'cascade' }).notNull(),
  version: integer('version').default(1).notNull(),
  allergies: jsonb('allergies').default([]).notNull(), // string[]
  chronicConditions: jsonb('chronic_conditions').default([]).notNull(), // string[]
  currentMedicines: jsonb('current_medicines').default([]).notNull(), // { brand: string; generic: string; dose?: string }[]
  bloodGroup: varchar('blood_group', { length: 10 }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  changeReason: text('change_reason'),
}, (table) => [
  unique('profile_health_summary_profile_version_key').on(table.profileId, table.version),
]);

export const accessGrants = pgTable('access_grants', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'cascade' }).notNull(),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  scope: varchar('scope', { length: 30 }).default('this_doctor_only').notNull(), // 'this_doctor_only' | 'full_history'
  status: varchar('status', { length: 30 }).default('active').notNull(), // 'requested' | 'active' | 'expired' | 'revoked'
  grantedVia: varchar('granted_via', { length: 30 }).default('created_profile').notNull(), // 'otp' | 'created_profile' | 'patient_portal'
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const otpRequests = pgTable('otp_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: varchar('phone', { length: 30 }).notNull(),
  purpose: varchar('purpose', { length: 30 }).default('login').notNull(), // 'login' | 'grant_access'
  codeHash: varchar('code_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').default(0).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accessLogs = pgTable('access_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'cascade' }).notNull(),
  userRole: varchar('user_role', { length: 50 }),
  action: varchar('action', { length: 50 }).notNull(),
  recordType: varchar('record_type', { length: 50 }),
  recordId: uuid('record_id'),
  reason: text('reason'),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
export const accessLog = accessLogs;

export const cases = pgTable('cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'set null' }),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'set null' }),
  patientCode: varchar('patient_code', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('draft'), // 'draft' | 'analyzed' | 'insufficient_evidence' | 'red_flag' | 'confirmed' | 'treated' | 'closed'
  structuredInput: jsonb('structured_input').notNull(),
  confirmedDiagnosis: text('confirmed_diagnosis'),
  enteredByVoice: boolean('entered_by_voice').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** A follow-up visit (case_id) continuing an earlier visit (previous_case_id). */
export const caseFollowUps = pgTable('case_follow_ups', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }).notNull().unique(),
  previousCaseId: uuid('previous_case_id').references(() => cases.id, { onDelete: 'restrict' }).notNull(),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'set null' }),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'set null' }),
  requestKey: varchar('request_key', { length: 64 }).notNull(),
  carried: jsonb('carried').notNull(),
  reconciliation: jsonb('reconciliation'),
  status: varchar('status', { length: 30 }).notNull().default('pending'), // 'pending' | 'reconciled'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reconciledAt: timestamp('reconciled_at'),
}, (table) => [
  unique('case_follow_ups_request_unique').on(table.previousCaseId, table.doctorId, table.requestKey),
  index('case_follow_ups_previous_idx').on(table.previousCaseId),
]);

export const caseTurns = pgTable('case_turns', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // 'doctor' | 'system'
  content: jsonb('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const analyses = pgTable('analyses', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }).notNull(),
  round: integer('round').notNull().default(1),
  output: jsonb('output').notNull(),
  model: text('model').notNull().default('gpt-4o-mini'),
  tokens: integer('tokens').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const drugs = pgTable('drugs', {
  id: uuid('id').defaultRandom().primaryKey(),
  genericName: text('generic_name').notNull().unique(),
  drugClass: text('drug_class').notNull(),
  indications: jsonb('indications').notNull(), // string[]
  doseRules: jsonb('dose_rules').notNull(), // DoseRules
  contraindications: jsonb('contraindications').notNull(), // Contraindications
  pregnancyCategory: varchar('pregnancy_category', { length: 5 }).notNull().default('C'),
  renalAdjustment: jsonb('renal_adjustment'), // RenalAdjustment
  sourceChunkId: uuid('source_chunk_id').references(() => chunks.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const drugInteractions = pgTable('drug_interactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  drugA: text('drug_a').notNull(),
  drugB: text('drug_b').notNull(),
  severity: varchar('severity', { length: 20 }).notNull(), // 'info' | 'warning' | 'critical'
  note: text('note').notNull(),
  sourceChunkId: uuid('source_chunk_id').references(() => chunks.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  event: text('event').notNull(),
  payload: jsonb('payload').notNull(),
  prevHash: varchar('prev_hash', { length: 64 }),
  hash: varchar('hash', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const features = pgTable('features', {
  key: varchar('key', { length: 100 }).primaryKey(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const roleFeatures = pgTable('role_features', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: varchar('role', { length: 50 }).notNull(),
  featureKey: varchar('feature_key', { length: 100 }).references(() => features.key, { onDelete: 'cascade' }).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  dailyLimit: integer('daily_limit'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userFeatureOverrides = pgTable('user_feature_overrides', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  featureKey: varchar('feature_key', { length: 100 }).references(() => features.key, { onDelete: 'cascade' }).notNull(),
  enabled: boolean('enabled').notNull(),
  dailyLimit: integer('daily_limit'),
  expiresAt: timestamp('expires_at'),
  reason: text('reason'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const doctorVerifications = pgTable('doctor_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  bmdcNumber: varchar('bmdc_number', { length: 50 }).notNull(),
  documentUrl: text('document_url').notNull(),
  status: varchar('status', { length: 30 }).default('pending').notNull(), // 'pending' | 'approved' | 'rejected'
  rejectionReason: text('rejection_reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const studentVerifications = pgTable('student_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentId: uuid('student_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  instituteName: text('institute_name').notNull(),
  studentIdNumber: varchar('student_id_number', { length: 50 }).notNull(),
  instituteEmail: varchar('institute_email', { length: 255 }),
  documentUrl: text('document_url'),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  rejectionReason: text('rejection_reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const researcherVerifications = pgTable('researcher_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  researcherId: uuid('researcher_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  instituteName: text('institute_name').notNull(),
  orcid: varchar('orcid', { length: 50 }),
  instituteEmail: varchar('institute_email', { length: 255 }),
  documentUrl: text('document_url'),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  rejectionReason: text('rejection_reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 64 }),
  expiresAt: timestamp('expires_at').notNull(),
  revoked: boolean('revoked').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'set null' }),
  patientCode: varchar('patient_code', { length: 50 }).notNull(),
  nameEncrypted: text('name_encrypted').notNull(),
  phoneEncrypted: text('phone_encrypted'),
  age: integer('age').notNull(),
  gender: varchar('gender', { length: 20 }).notNull(),
  sex: varchar('sex', { length: 20 }),
  bloodGroup: varchar('blood_group', { length: 10 }),
  emergencyContact: text('emergency_contact'),
  consentObtained: boolean('consent_obtained').default(true).notNull(),
  consentObtainedAt: timestamp('consent_obtained_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const encounters = pgTable('encounters', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'set null' }),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'set null' }),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
  visitDate: timestamp('visit_date', { withTimezone: true }).defaultNow().notNull(),
  chiefComplaint: text('chief_complaint').notNull(),
  symptoms: jsonb('symptoms').notNull(),
  vitals: jsonb('vitals').notNull(),
  allergies: jsonb('allergies').notNull(),
  currentMedications: jsonb('current_medications').notNull(),
  pastHistory: text('past_history'),
  clinicalNotes: text('clinical_notes'),
  status: varchar('status', { length: 30 }).default('in_progress').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const prescriptions = pgTable('prescriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  encounterId: uuid('encounter_id').references(() => encounters.id, { onDelete: 'set null' }),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'set null' }),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  rxNumber: varchar('rx_number', { length: 50 }).notNull().unique(),
  diagnosis: text('diagnosis'),
  investigations: jsonb('investigations').notNull(),
  generalAdvice: text('general_advice'),
  followUpText: varchar('follow_up_text', { length: 100 }),
  status: varchar('status', { length: 30 }).default('draft').notNull(), // 'draft' | 'finalized'
  qrHash: varchar('qr_hash', { length: 64 }).notNull().unique(),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const prescriptionItems = pgTable('prescription_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  prescriptionId: uuid('prescription_id').references(() => prescriptions.id, { onDelete: 'cascade' }).notNull(),
  brandName: varchar('brand_name', { length: 100 }).notNull(),
  genericName: varchar('generic_name', { length: 100 }).notNull(),
  strength: varchar('strength', { length: 50 }).notNull(),
  form: varchar('form', { length: 50 }).default('Tab').notNull(),
  dosingSchedule: varchar('dosing_schedule', { length: 50 }).notNull(),
  mealTiming: varchar('meal_timing', { length: 50 }).default('খাবারের পর').notNull(),
  durationDays: integer('duration_days').default(7).notNull(),
  durationText: varchar('duration_text', { length: 50 }).default('৭ দিন').notNull(),
  instructions: text('instructions'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const medicineBrands = pgTable('medicine_brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandName: varchar('brand_name', { length: 150 }).notNull(),
  genericName: varchar('generic_name', { length: 150 }).notNull(),
  manufacturer: varchar('manufacturer', { length: 150 }).notNull(),
  form: varchar('form', { length: 50 }).default('Tab').notNull(),
  strength: varchar('strength', { length: 50 }).notNull(),
  packSize: varchar('pack_size', { length: 50 }).default('10x10'),
  priceBdt: numeric('price_bdt', { precision: 10, scale: 2 }).default('0.00'),
  dgdaRegNum: varchar('dgda_reg_num', { length: 50 }),
  status: varchar('status', { length: 30 }).default('approved').notNull(), // 'pending' | 'partially_approved' | 'approved' | 'rejected'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const medicineVersions = pgTable('medicine_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  medicineId: uuid('medicine_id').references(() => medicineBrands.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').default(1).notNull(),
  changesJson: jsonb('changes_json').notNull(),
  reviewedBy1: uuid('reviewed_by_1').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt1: timestamp('reviewed_at_1', { withTimezone: true }),
  reviewedBy2: uuid('reviewed_by_2').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt2: timestamp('reviewed_at_2', { withTimezone: true }),
  status: varchar('status', { length: 30 }).default('pending').notNull(), // 'pending' | 'partially_approved' | 'approved' | 'rejected'
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const medicineNotices = pgTable('medicine_notices', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  severity: varchar('severity', { length: 30 }).default('info').notNull(), // 'info' | 'warning' | 'critical_recall'
  body: text('body').notNull(),
  affectedBatches: jsonb('affected_batches').notNull(),
  publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const patientSchedules = pgTable('patient_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'set null' }),
  prescriptionItemId: uuid('prescription_item_id').references(() => prescriptionItems.id, { onDelete: 'set null' }),
  medicineName: varchar('medicine_name', { length: 150 }).notNull(),
  dosage: varchar('dosage', { length: 50 }).notNull(),
  slot: varchar('slot', { length: 20 }).notNull(), // 'morning' | 'noon' | 'night'
  mealRelation: varchar('meal_relation', { length: 50 }).default('খাবারের পর').notNull(),
  takenToday: boolean('taken_today').default(false).notNull(),
  lastTakenAt: timestamp('last_taken_at', { withTimezone: true }),
  instructions: text('instructions'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const patientReports = pgTable('patient_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 150 }).notNull(),
  reportType: varchar('report_type', { length: 50 }).default('lab_test').notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  notes: text('notes'),
  isShared: boolean('is_shared').default(false).notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
});

export const patientPreVisits = pgTable('patient_pre_visits', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'set null' }),
  chiefComplaint: text('chief_complaint').notNull(),
  symptoms: jsonb('symptoms').default([]).notNull(),
  duration: varchar('duration', { length: 50 }).default('১-২ দিন').notNull(),
  notes: text('notes'),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
});

export const patientConsentLogs = pgTable('patient_consent_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 30 }).notNull(), // 'granted' | 'revoked'
  reason: text('reason'),
  loggedAt: timestamp('logged_at', { withTimezone: true }).defaultNow().notNull(),
});

export const medicineIntakeLogs = pgTable('medicine_intake_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  prescriptionItemId: uuid('prescription_item_id').references(() => prescriptionItems.id, { onDelete: 'set null' }),
  profileId: uuid('profile_id').references(() => patientProfiles.id, { onDelete: 'cascade' }).notNull(),
  slot: varchar('slot', { length: 20 }), // 'morning' | 'noon' | 'night'
  takenAt: timestamp('taken_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
export const medicineIntakeLog = medicineIntakeLogs;

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: varchar('key', { length: 100 }).primaryKey(),
  route: varchar('route', { length: 200 }).notNull(),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const studentCases = pgTable('student_cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  specialty: varchar('specialty', { length: 100 }).notNull(),
  difficulty: varchar('difficulty', { length: 20 }).default('intermediate').notNull(),
  vignette: text('vignette').notNull(),
  vitals: jsonb('vitals').default({}).notNull(),
  options: jsonb('options').default([]).notNull(),
  correctOption: text('correct_option').notNull(),
  clinicalExplanation: text('clinical_explanation').notNull(),
  citations: jsonb('citations').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const studentQuizzes = pgTable('student_quizzes', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  topic: varchar('topic', { length: 100 }).notNull(),
  question: text('question').notNull(),
  options: jsonb('options').default([]).notNull(),
  correctAnswer: varchar('correct_answer', { length: 10 }).notNull(),
  explanation: text('explanation').notNull(),
  citationChunkId: uuid('citation_chunk_id').references(() => chunks.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const studentNotes = pgTable('student_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  chunkId: uuid('chunk_id').references(() => chunks.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  tags: jsonb('tags').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const researcherCollections = pgTable('researcher_collections', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  items: jsonb('items').default([]).notNull(),
  tags: jsonb('tags').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const voiceSessions = pgTable('voice_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
  sttSeconds: numeric('stt_seconds', { precision: 8, scale: 2 }).default('0.00').notNull(),
  ttsChars: integer('tts_chars').default(0).notNull(),
  sttProvider: varchar('stt_provider', { length: 50 }).default('browser').notNull(),
  ttsProvider: varchar('tts_provider', { length: 50 }).default('browser').notNull(),
  estimatedCost: numeric('estimated_cost', { precision: 8, scale: 4 }).default('0.0000').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

export const voiceTurns = pgTable('voice_turns', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => voiceSessions.id, { onDelete: 'cascade' }).notNull(),
  intent: varchar('intent', { length: 50 }).notNull(), // 'ask_library' | 'dictate' | 'answer_followup' | 'navigate' | 'read_aloud' | 'blocked_action' | 'other'
  status: varchar('status', { length: 50 }).notNull(), // 'ok' | 'low_confidence' | 'failed' | 'blocked'
  latencyMs: integer('latency_ms').default(0).notNull(),
  errorCode: varchar('error_code', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const termAliases = pgTable('term_aliases', {
  id: uuid('id').defaultRandom().primaryKey(),
  canonicalEn: varchar('canonical_en', { length: 150 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // 'symptom' | 'sign' | 'disease' | 'medicine_generic' | 'medicine_brand' | 'body_part' | 'unit' | 'duration' | 'number' | 'negation'
  variants: jsonb('variants').default({ bn: [], banglish: [], en: [], bn_translit_en: [] }).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(), // 'active' | 'pending'
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_term_aliases_canonical').on(table.canonicalEn),
  index('idx_term_aliases_category').on(table.category),
  index('idx_term_aliases_status').on(table.status),
]);

export const unmatchedTerms = pgTable('unmatched_terms', {
  id: uuid('id').defaultRandom().primaryKey(),
  term: varchar('term', { length: 150 }).notNull(),
  language: varchar('language', { length: 20 }).default('unknown').notNull(),
  count: integer('count').default(1).notNull(),
  firstSeen: timestamp('first_seen', { withTimezone: true }).defaultNow().notNull(),
  lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending' | 'reviewed' | 'added' | 'ignored'
}, (table) => [
  index('idx_unmatched_terms_status').on(table.status),
  index('idx_unmatched_terms_count').on(table.count),
]);

export const userLanguagePrefs = pgTable('user_language_prefs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  replyLanguage: varchar('reply_language', { length: 20 }).default('auto').notNull(), // 'auto' | 'bn' | 'en'
  banglishReply: boolean('banglish_reply').default(false).notNull(),
  sttMode: varchar('stt_mode', { length: 20 }).default('auto').notNull(), // 'auto' | 'bn' | 'en'
  showUnderstanding: boolean('show_understanding').default(true).notNull(),
  phoneticTyping: boolean('phonetic_typing').default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_user_language_prefs_user').on(table.userId),
]);

export const languageEvalRuns = pgTable('language_eval_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: timestamp('date', { withTimezone: true }).defaultNow().notNull(),
  metrics: jsonb('metrics').default({}).notNull(),
  thresholds: jsonb('thresholds').default({}).notNull(),
  passed: boolean('passed').default(false).notNull(),
  notes: text('notes'),
}, (table) => [
  index('idx_language_eval_runs_date').on(table.date),
]);

export const userAssistantPrefs = pgTable('user_assistant_prefs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  addressStyle: varchar('address_style', { length: 50 }).default('doctor').notNull(), // 'doctor' | 'doctor_sahib' | 'doctor_madam' | 'name'
  tonePreset: varchar('tone_preset', { length: 50 }).default('friendly').notNull(), // 'reserved' | 'friendly'
  verbosity: varchar('verbosity', { length: 50 }).default('normal').notNull(), // 'brief' | 'normal' | 'detailed'
  soundsEnabled: boolean('sounds_enabled').default(true).notNull(),
  hintsEnabled: boolean('hints_enabled').default(true).notNull(),
  avatarEnabled: boolean('avatar_enabled').default(true).notNull(),
  speechRate: real('speech_rate').default(1.0).notNull(),
  voiceId: varchar('voice_id', { length: 100 }).default('default'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_user_assistant_prefs_user').on(table.userId),
]);

export const phrasebankEntries = pgTable('phrasebank_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: varchar('category', { length: 100 }).notNull(),
  locale: varchar('locale', { length: 10 }).default('bn').notNull(), // 'bn' | 'en'
  preset: varchar('preset', { length: 50 }).default('friendly').notNull(), // 'reserved' | 'friendly' | 'all'
  text: text('text').notNull(),
  status: varchar('status', { length: 20 }).default('live').notNull(), // 'draft' | 'reviewed' | 'live'
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_phrasebank_lookup').on(table.category, table.locale, table.preset, table.status),
]);

export const assistantFeedback = pgTable('assistant_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: varchar('message_id', { length: 100 }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  rating: varchar('rating', { length: 20 }).notNull(), // 'helpful' | 'unhelpful'
  reason: varchar('reason', { length: 100 }), // 'too_long' | 'too_formal' | 'did_not_understand' | 'wrong_tone' | 'other'
  preset: varchar('preset', { length: 50 }).default('friendly').notNull(),
  locale: varchar('locale', { length: 10 }).default('bn').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_assistant_feedback_metrics').on(table.rating, table.reason, table.preset, table.locale, table.createdAt),
]);



