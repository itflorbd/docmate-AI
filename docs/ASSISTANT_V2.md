# DocMate AI — Assistant V2 Architecture & Implementation Guide

**Document Version:** 2.0.0  
**Target Audience:** Clinical AI Engineers, Full-Stack Engineers, System Architects  
**Location:** \`docs/ASSISTANT_V2.md\`  

---

## 1. System Overview

**DocMate AI Assistant V2** is a clinical decision-support system designed for Bangladeshi physicians. It turns the consultation assistant into a grounded, streaming, multi-turn AI colleague ("Jarvis for doctors") operating under the strict non-negotiable safety guardrails of \`AGENTS.md\`.

### Core Capabilities
- **Multi-Turn Clinical Memory:** Retains patient demographics, symptoms, vitals, history, allergies, medications, confirmed facts, and previous conversation turns.
- **Closed-Library Grounding:** LLM generation strictly relies on retrieved internal guidelines (e.g. DGHS National Guidelines for Dengue, BMDC Guidelines, Clinical Pharmacology).
- **Code-Verified Citations:** Every clinical claim carries a citation to a specific \`chunk_id\` and includes a verbatim quote verified via normalized whitespace string matching against the database chunk text. Unverified claims are stripped deterministically.
- **Abstention by Design:** Declares \`insufficient_evidence\` when internal guidelines do not cover the inquiry, while offering concrete suggestions for missing clinical investigations.
- **Deterministic Red-Flag Alerts:** Unicode-compatible bilingual regex engine detecting emergency cardiopulmonary, shock, and hemorrhagic symptoms with negation awareness.
- **Claude-Style Streaming UI:** Token-by-token streaming with live activity traces ("Searching library → Reading sources → Writing response → Verifying citations"), rich Markdown rendering, inline citation previews, quick-answer chips, and record update proposals.

---

## 2. Backend Engine Architecture (\`src/lib/assistant/\`)

```
src/lib/assistant/
├── engine.ts              # Core turn execution pipeline (orchestrates planning, retrieval, generation, verification)
├── context.ts             # Multi-turn memory loader & deduplication of answered follow-ups
├── prompt.ts              # System prompt assembly, XML untrusted data fencing, and few-shot formatting
├── llm.ts                 # OpenAI-compatible streaming client reading credentials from admin settings
├── verify.ts              # Deterministic citation verifier & claim extraction
├── followups.ts           # Context-aware follow-up registry (enforces at most 1 question, 0 repeats)
├── query-builder.ts       # Multilingual patient-aware retrieval query generator
├── retrieval-queries.ts   # Entity-based query expansion & canonical translations
├── excerpts.ts            # Chunker sentence selector & deterministic fallback synthesizer
├── fallback.ts            # Grounded fallback generator when no LLM key is configured
└── types.ts               # Core TypeScript interfaces for assistant replies, claims, and streaming events
```

### 2.1 The Execution Pipeline (\`engine.ts\`)

1. **Deterministic Utility Intercept:** Direct matches for system queries (date, time, identity) return immediate deterministic replies without LLM invocation.
2. **Clinical Dictation Path:** When a doctor dictates observations or vitals without a clinical query (e.g. \`BP 120/80, Pulse 76\`), facts are extracted into \`proposed_updates\` and acknowledged immediately with 0 LLM latency.
3. **Red-Flag Emergency Scan:** Checked before retrieval via \`src/lib/red-flags.ts\`. If acute red flags match (and are not negated), a critical safety alert is attached.
4. **Patient-Aware Retrieval:** Builds targeted full-text and vector queries combining doctor inquiry, patient chief complaint, symptoms, and canonical English terms. Retrieval runs outside any database lock.
5. **Streaming Generation:** Messages are constructed with XML data isolation tags:
   - \`<patient_context>\`
   - \`<conversation_history>\`
   - \`<library_excerpts>\`
   - \`<doctor_message>\`
6. **Deterministic Verification:** The model output is parsed into markdown prose and structured claims. The verifier scans each claim, checks that \`quote\` appears verbatim in the cited chunk, re-indexes marker references, and drops unverified sentences.
7. **Abstention Fallback:** If no claims verify or retrieval returns 0 hits, status is set to \`insufficient_evidence\`.
8. **No-Model Fallback:** With no API key, or when the model fails or returns no valid META block, the reply shows the closest verbatim library sentences with status \`excerpts\` (not \`answered\`). Chunks that share fewer than two key terms with the question are not quoted.

Measured results, including run-to-run variation and known gaps, are in \`eval/RESULTS.md\` (regenerate with \`pnpm run eval:chat\`).

---

## 3. Streaming Chat API (\`src/app/api/cases/[id]/chat/route.ts\`)

The streaming endpoint communicates via NDJSON streaming (\`application/x-ndjson\`), delivering structured events as they occur:

### Stream Events
| Event Type | Payload Schema | Description |
| :--- | :--- | :--- |
| \`trace\` | \`{ step: string, status: 'running' \| 'done' \| 'error', count?: number }\` | Live activity updates (retrieve, generate, verify) |
| \`delta\` | \`{ text: string }\` | Token deltas streamed into client draft |
| \`reset\` | \`{ text: string }\` | Replaces draft text when verification strips ungrounded sentences |
| \`safety\` | \`{ alerts: SafetyAlert[] }\` | Real-time red flag or drug interaction alerts |
| \`final\` | \`{ turn: CaseTurn, assistantTurn: CaseTurn }\` | Complete persisted turns stored in PostgreSQL |
| \`error\` | \`{ error: string }\` | Error message on network or database failure |

### Client Abort Handling
When a doctor clicks **Stop** or presses **Escape**, the client \`AbortController\` signals the server. The stream catches the abort signal, finalizes whatever text has been generated so far, and persists the turn with status \`stopped\` so the doctor never loses what was transcribed.

---

## 4. Frontend UI Architecture (\`src/components/case-chat/\`)

Built exclusively with **shadcn/ui** and **Base UI** primitives:

```
src/components/case-chat/
├── case-chat.tsx          # Root container: scroller, message stream, alerts, composer
├── use-case-chat.ts       # React hook managing NDJSON streaming, abort signals, draft cache
├── assistant-message.tsx  # Assistant bubble-less prose, citations row, sources popover
├── assistant-trace.tsx    # Collapsible activity trace with spinner and step counts
├── doctor-message.tsx     # Doctor message bubble with edit-and-resend & retry actions
├── chat-composer.tsx      # Auto-growing Textarea, reply language toggle, phonetic toggle, mic
├── chat-markdown.tsx      # Rich Markdown renderer with citation superscript chips
├── follow-up-card.tsx     # Smart follow-up card with 1-click quick-answer chips
├── proposed-updates.tsx   # Extracted clinical facts with Confirm / Dismiss actions
└── safety-alerts.tsx      # Critical red-flag banners pinned above the composer
```

### Key UI Features
- **Markdown & Citations:** Superscript chips (e.g. \`[1]\`) render inside Markdown. Hovering displays a preview of the source title and page; clicking opens the full passage in the right-side \`EvidenceSheet\`.
- **Reply Language Switching:** Doctor can toggle between \`Auto\`, \`বাংলা (Bangla)\`, and \`English\` directly in the composer.
- **Phonetic Bangla Typing (Avro-style):** Optional toggle for instant phonetic English-to-Bangla transliteration.
- **Multi-Turn Quick Replies:** Suggested replies from the active follow-up render as clean pill chips that automatically populate and send upon tap.
- **Critical Red-Flag Pinning:** Critical safety warnings remain pinned above the composer until explicitly acknowledged.

---

## 5. Verification & Benchmark Reproduction

### 5.1 Run Full Vitest Suite (355 tests)
\`\`\`bash
pnpm test
\`\`\`

### 5.2 Run Conversational Benchmark (60 clinical scenarios)
\`\`\`bash
pnpm run eval:chat
\`\`\`

### 5.3 Run Typecheck & Linter
\`\`\`bash
pnpm run typecheck
pnpm run lint
\`\`\`

### 5.4 Run Production Build
\`\`\`bash
pnpm run build
\`\`\`

---

## 6. AGENTS.md Hard Rules Verification Summary

| Rule | Requirement | Implementation Mechanism |
| :--- | :--- | :--- |
| **Rule 1** | Closed Library Only | System prompt contains exact abstention rule; retrieval queries only PostgreSQL internal chunks; zero external web access. |
| **Rule 2** | Verbatim Citations | \`verifyModelAnswer\` verifies normalized quote against chunk text; drops any sentence lacking verified quote. |
| **Rule 3** | Code Verification | Deterministic TypeScript verifier executes on all model candidate claims before database persistence. |
| **Rule 4** | Abstention by Design | Returns \`insufficient_evidence\` whenever library chunks are absent or claims fail verification. |
| **Rule 5** | Doctor Decides, AI Suggests | Persistent bilingual disclaimer on all views; AI only proposes updates and differential suggestions. |
| **Rule 6** | Deterministic Doses | Drug dosages sourced strictly from structured tables or verified guidelines. |
| **Rule 7** | Prompt Injection Defense | User and library inputs fenced in XML tags; ignored as executable instructions. |
| **Rule 8** | Synthetic Demo Data Only | Only synthetic patient codes (\`P-101\`, \`P-102\`, \`P-103\`) used in evaluation and tests. |
| **Rule 9** | No 100% Accuracy Claims | Zero claims of 100% accuracy anywhere in UI copy, prompts, or code comments. |
