# ANALYSIS_LANGUAGE.md — Multilingual Language Layer for Chat & Voice Assistant

**DocMate AI — Architecture & Engineering Analysis**  
**Role**: Principal Engineer & Product Designer  
**Scope**: Unified Multilingual Language Layer (Bangla script, English, Banglish, and Mixed Code-Switching) for both Chatbox and Voice Assistant.

---

## 1. System Entry Points (Where User Text Enters)

Text enters DocMate AI across 6 distinct input vectors:
1. **Case Workspace Chat Input** (`src/app/[locale]/cases/[id]/components/CaseConversationTab.tsx`):
   - Textarea input (`inputObservation`) accepting clinical notes, observations, questions, or evidence review requests.
   - Horizontal prompt chips (e.g. *"অ্যান্টিবায়োটিক নির্দেশিকা"*, *"হাসপাতালে ভর্তির মাপকাঠি"*).
2. **Follow-Up Question Answers** (`src/components/shared/FollowUpQuestionCard.tsx` & `CaseConversationTab.tsx`):
   - Inline manual answers or quick 1-tap suggestion pills (e.g. *"হ্যাঁ, কাঁপুনি ছিল"*, *"no vomiting"*, *"BP 130/85"*).
3. **Voice Assistant Spoken Transcripts** (`src/components/voice/VoicePanel.tsx` & `src/context/VoiceContext.tsx`):
   - Captured audio converted by STT (`BrowserWebSpeechSTT` or `OpenAiWhisperSTT`).
   - Rendered in an editable transcript bar before execution or auto-submitted upon speech completion.
4. **Patient Intake Form & Pre-Visit** (`src/app/[locale]/patients/new/page.tsx` & `src/app/[locale]/portal/page.tsx`):
   - Chief complaint, symptoms, durations, vitals, and allergy input fields entered by typing or voice dictation.
5. **Direct Library Q&A** (`src/app/[locale]/ask/page.tsx` & `/api/ask`):
   - Standalone clinical guideline inquiry box.
6. **Command Bar & Global Search** (`src/components/shared/CommandSearch.tsx`):
   - Case lookup, drug search, and guideline search.

---

## 2. Where Language Is Currently Assumed

| File / Component | Current Implementation / Assumption | Limitation / Vulnerability |
| :--- | :--- | :--- |
| `src/lib/retrieval.ts` (lines 51-53) | `const isBengali = /[\u0980-\u09FF]/.test(query); const tsvConfig = isBengali ? 'simple' : 'english';` | Banglish queries (`"pneumonia er first line treatment ki"`) lack Bengali characters and are routed to Postgres `'english'` config without stemming, failing retrieval. |
| `src/lib/clinical-extractor.ts` (lines 14-24) | English-only regexes (`/\b(?:cough|fever|headache)\b/i`) | Fails on Bangla (`কাশি`, `জ্বর`) and Banglish (`kashi`, `jor`, `matha betha`). Does not parse negations (`jor nai`). |
| `src/lib/voice/intent-router.ts` | Separate keyword regex lists for Bangla and English | Does not handle Banglish intents (`"tmi ki dekhte paro"`, `"Napa dose koto"`) or ambiguous contextual references (`"this"`, `"eta"`). |
| `src/lib/voice/stt-provider.ts` | Hardcoded `this.recognition.lang = 'bn-BD'` | Browser STT forces English clinical words into Bengali phonetic script (`"ফিভার"`, `"অ্যামোক্সিসিলিন"`) without automatic canonicalization. |
| `src/app/api/cases/[id]/turns/route.ts` | `locale = data.locale || 'bn'` determines assistant output language solely from UI locale | Does not distinguish UI locale from desired conversational reply language or handle Banglish inquiries properly. |

---

## 3. What Must Be Reused

1. **Closed-Library Verification Core** (`src/lib/verifier.ts`):
   - Deterministic whitespace-normalized quote verification against cited `chunk_id`. Must never be bypassed.
2. **Hybrid Multi-Query Retrieval & RRF** (`src/lib/retrieval.ts`):
   - Vector search (OpenAI embedding) + Full-text search + Reciprocal Rank Fusion (`k = 60`) + `content_hash` deduplication.
3. **Deterministic Number & Vitals Parser** (`src/lib/voice/number-parser.ts`):
   - Parsing of Bangla numerals (`০-৯`), English digits, blood pressure (`120/80`), temperature (`°C` / `°F`), and units.
4. **Deterministic Dosage Speech Generator** (`src/lib/voice/dose-speech.ts`):
   - Structured medication schedules (`1+0+1`, with meals, duration) translated deterministically without LLM hallucinations.
5. **Closed-Library Speakable Formatter** (`src/lib/voice/speakable.ts`):
   - `makeSpeakable()` dropping unverified claims, enforcing citation notices (*"প্রমাণ স্ক্রিনে আছে"*), and capping to 2–3 sentences.
6. **Cryptographic De-Identification** (`src/lib/deidentify.ts`):
   - Stripping Bangladeshi mobile numbers (`+880...`), names, and NIDs prior to external LLM calls or metric logging.
7. **Fine-Grained RBAC & Audit Ledger** (`src/lib/permissions.ts` & `src/lib/audit.ts`):
   - Feature key checks and tamper-evident SHA-256 audit chaining.

---

## 4. Key Clinical & Technical Risks

1. **Negation Misinterpretation Risk (Safety Critical)**:
   - *Risk*: A doctor writes/speaks *"jor nai kintu kashi ache"* (No fever, but cough present). If the system extracts `fever` and `cough` without recognizing `nai`, the differential diagnosis will be fundamentally wrong.
   - *Mitigation*: Deterministic negation scope parser in `src/lib/language/negation-parser.ts` supporting markers across Bengali script (`নেই, নাই, না, নয়, ছাড়া`), Banglish (`nai, nei, na, noy, chhara`), and English (`no, not, denies, without`). Handles conjunctions (`kintu, but, tobe, কিন্তু`).
2. **Ambiguous Pronoun Hallucination**:
   - *Risk*: A doctor asks *"is this safe?"* or *"eta ki safe?"* with no drug in context. A typical LLM might guess a drug.
   - *Mitigation*: Hard rule: If an entity reference is ambiguous, the system declares status `ambiguous` and poses a targeted clarifying question with quick-reply chips.
3. **Capabilities Inquiry Confusion**:
   - *Risk*: Doctor asks *"tmi ki dekhte paro how much efficient this is ?"*.
   - *Mitigation*: Recognized as `ask_capabilities`. Returns a deterministic explanation of what is currently visible (the active case and library only, zero internet, doctor decides) and asks what "this" refers to.
4. **Audio & Text Audit Integrity**:
   - *Risk*: Replacing original doctor phrasing with normalized text compromises medico-legal audit trails.
   - *Mitigation*: Original doctor text is preserved verbatim in storage and audit logs; normalization is stored strictly as companion metadata.
5. **Latency & Cost Overhead**:
   - *Risk*: Running an LLM call on every single keystroke or chat turn increases latency and cost.
   - *Mitigation*: Deterministic fast-path: Skip the LLM understanding call when deterministic regex/term matching is 100% confident (e.g. plain English or clean commands). Cache language layer decisions by SHA-256 text hash (after de-identification).

---

## 5. Phased Implementation Plan

### Phase 1: Database Migration & Core Language Modules
- Migration `0006_language_layer.sql`:
  - `term_aliases` (canonical_en, category, variants JSONB, status, notes).
  - `unmatched_terms` (term, language, count, status).
  - `user_language_prefs` (reply_language, banglish_reply, stt_mode, show_understanding, phonetic_typing).
  - `language_eval_runs` (date, metrics, thresholds, passed).
- Seed data `data/aliases.seed.json` with 150+ medical terms (symptoms, drugs, units, durations, negations).
- Core modules in `src/lib/language/`:
  - `preprocessor.ts`: Unicode NFC, digit conversion, lowercasing.
  - `detector.ts`: Script ratio + 300-word Banglish lexicon matching (`bn | en | banglish | mixed`).
  - `term-matcher.ts`: Term alias dictionary matching & English canonicalization.
  - `negation-parser.ts`: Multi-script deterministic negation scope engine.
  - `number-duration-parser.ts`: Deterministic numbers, durations, and units.

### Phase 2: Understanding Engine & Multi-Query Retrieval
- `src/lib/language/understand.ts`:
  - Cheap structured model call (Zod schema) when fast-path is insufficient.
  - Deterministic override: copies numbers and negations from parser; trusts parse on disagreement.
  - Generates `canonical_english_query` and `bangla_query`.
- Multi-query hybrid retrieval in `src/lib/retrieval.ts`:
  - Up to 3 queries (original, canonical English, Bangla) executed via hybrid search.
  - Reciprocal rank fusion merge, content-hash deduplication, max 12 chunks.
- Caching layer (`src/lib/language/cache.ts`) by SHA-256 hash.

### Phase 3: Reply Policy & Capabilities Engine
- `src/lib/language/reply-policy.ts`:
  - Auto policy (Bangla/Banglish -> Bangla; English -> English; Banglish reply toggle).
  - Verbatim citations in source language; medical terms with English in brackets.
- `src/lib/language/capabilities.ts`:
  - Fixed capabilities answer in chosen reply language detailing what the AI can and cannot see.

### Phase 4: Chatbox UI & "আমি যা বুঝেছি" (What I Understood)
- Detected language badge on messages (`বাংলা`, `English`, `Banglish`, `বাংলা + English`).
- Accordion under assistant turns: "আমি যা বুঝেছি" (What I understood) showing canonical query, extracted symptoms (`[+] Present`, `[-] Absent`, durations), and medicines.
- Clarifying questions with 1-click quick response chips.
- Per-message reply language switcher in chat header.
- Feature flag: optional client-side phonetic Bangla typing.

### Phase 5: Voice Assistant Multilingual Integration
- `segmentForSpeech(text)`: Segmenting bilingual text into `bn` and `en` chunks for optimal TTS.
- Browser STT `bn_translit_en` restoration (e.g. converting "ফিভার" -> "Fever" -> English terms).
- STT language mode setting (`auto | bn | en`).

### Phase 6: Admin Governance & Feature Permissions
- Super admin screen `/[locale]/admin/language`:
  - Alias management (search, add variants, review pending).
  - Unmatched terms review queue.
  - Default language configuration & eval run reports.
- Feature keys: `language.prefs`, `language.aliases.manage`, `language.phonetic_typing`.
- Access control tests & i18n parity tests.

### Phase 7: Evaluation Suite & Benchmark Runner
- Test set `eval/language/test-cases.jsonl` with 200+ annotated clinical utterances across all 4 styles.
- Benchmark script `scripts/eval-language.ts` (`npm run eval:language`):
  - Accuracy thresholds: Language detection ≥95%, Negation ≥98%, Numbers ≥98%, Intent ≥90%.
- Documentation `docs/LANGUAGE.md`.
- Responsive browser testing (390px, 768px, 1280px) and full test suite execution.
