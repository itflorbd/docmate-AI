# Master Prompt: Rebuild the DocMate AI Case Assistant into a real conversational clinical copilot

Copy everything below this line into Antigravity.

---

## 0. Your role

You are a senior full-stack engineer and clinical-AI engineer working on **DocMate AI**, a Next.js 16 + PostgreSQL/pgvector clinical decision-support app for doctors in Bangladesh (Bangla default, English second). Your job is to turn the case conversation assistant from a template-based bot into a grounded, streaming, multi-turn assistant that feels like a skilled human colleague (a "Jarvis for doctors"). The interaction should feel like Claude or ChatGPT. The hard safety rules in `AGENTS.md` still apply in full.

Work in phases (section 7). After each phase, run the checks listed for it, fix what fails, and re-run until they pass. Do not move on with red tests.

Before writing any code:
1. Read `AGENTS.md` completely. Its HARD RULES override anything in this prompt.
2. Read the Next.js docs in `node_modules/next/dist/docs/`. This Next.js version has breaking changes compared with your training data (see the note at the bottom of `AGENTS.md`).
3. The working tree has **uncommitted changes** (voice, TTS, reactions, retrieval, `CaseConversationTab.tsx`). Do not discard or overwrite them. Commit them as-is on a branch first (`git switch -c feat/assistant-v2 && git add -A && git commit -m "wip: snapshot before assistant v2"`), then work on that branch.
4. Run the baseline: `pnpm test` (currently 304 tests pass in 32 files), `pnpm run typecheck` (currently passes), `pnpm run lint`. Record the results.

---

## 1. Product goal

A doctor opens a patient case and talks to DocMate in Bangla, English, Banglish, or a mix, by typing or by voice. DocMate should:

- Remember the whole conversation and the patient's structured data (complaint, symptoms, vitals, history, allergies, medicines, confirmed facts).
- Answer the doctor's actual question in natural language, grounded **only** in passages retrieved from the closed internal library. Every clinical claim carries a verifiable verbatim quote.
- Ask **one** smart follow-up question at a time, and only when the answer would change the clinical picture. Never re-ask something already answered or recorded.
- Pull clinical facts out of free text (vitals, symptoms, durations, negations) and propose them as record updates for the doctor to confirm.
- Raise deterministic red-flag and drug-safety alerts in both Bangla and English.
- Say plainly when the library does not cover something (`insufficient_evidence`) and still be helpful about what is missing. Do not dump a generic "no evidence" sentence.
- Stream replies token by token with a visible "searching library → reading sources → writing" activity trace. Support stop, regenerate, edit-and-resend, copy, and feedback.
- Treat the doctor as the decision-maker. DocMate suggests and the doctor decides.

---

## 2. What is broken today (verified by reading the code)

These are confirmed defects. Fix every one and add a regression test for each.

### 2.1 No language model in the conversation at all
- `src/app/api/cases/[id]/turns/route.ts` builds every reply from hard-coded string templates. No chat-completion call exists anywhere in `src/` (`grep` finds only `embeddings.create`).
- `src/app/api/cases/[id]/analyze/route.ts` always returns a hard-coded abstention (`abstentionModel = 'docmate-abstention-v1'`).
- `src/app/api/ask/route.ts` returns raw excerpts with a fixed caption.
- Admin AI credentials (`src/lib/ai-credentials.ts`, provider/model/baseUrl, `OPENAI_CHAT_MODEL` in `.env.example`) are stored but never used for generation.

### 2.2 Every reply collapses into "insufficient evidence"
- `turns/route.ts:385` passes `status: sysQuery ? 'analyzed' : 'insufficient_evidence'` into `humanize()`. As a result `humanize` (`src/lib/persona/humanize/index.ts`, CASE 4) **always** takes the "no evidence" branch for clinical input. It throws away the composed answer, the cited excerpt text, and the extracted-facts message. The doctor sees "Insufficient evidence found in the medical library…" plus the same vitals question on almost every turn, even when citations were found.
- `turns/route.ts:420` hard-codes `status: 'insufficient_evidence'` on every stored assistant turn.
- Because `baseClinicalAnswer` is never empty, the "thanks" and "correction/apology" branches in `humanize` can never run.

### 2.3 No conversation memory
- The route never loads previous turns, so the assistant has no idea what was said before.
- `turnCount: 1` is hard-coded (`turns/route.ts:395`), so session-adaptive behaviour never changes.
- The same follow-ups (vitals, auscultation, general exam) are pushed on **every** turn. Answers to them are never used to suppress them.

### 2.4 Follow-up answers are a dead end
- When a doctor taps a quick-answer chip, the `question_answer` branch (`turns/route.ts:~95-128`) stores the answer and returns `assistantTurn: null`. The assistant never replies, never extracts facts from the answer, and never updates `structuredInput`. The next turn asks the same question again.

### 2.5 Safety red-flag detection is broken
`turns/route.ts:306` uses `\b…\b` without the `u` flag. Verified with Node:
- `রোগীর তীব্র শ্বাসকষ্ট হচ্ছে` → **false**
- `বুকে তীব্র ব্যথা` → **false**
- `chest pain radiating to left arm` → **false** (`radiat\b` cannot match `radiating`)
- `crushing chest pain` → true

Bangla red flags **never fire**. This is a patient-safety bug and has top priority. Move red-flag rules into `src/lib/safety-engine.ts` (or a new `src/lib/red-flags.ts`) as a data-driven, bilingual rule table with negation awareness ("no chest pain" / "বুকে ব্যথা নেই" must not trigger). Reuse `src/lib/language/negation-parser.ts`. Cover it with tests in both languages, Banglish included.

### 2.6 Verification design blocks generated answers
- `src/lib/verifier.ts:20` drops any claim where `claim.text !== claim.quote`. That only works when the "claim" is the raw chunk. Once an LLM writes a sentence and supports it with a quote, every claim will be dropped. Redesign the claim schema to `{ claim_text, quote, chunk_id }`. Verify that `quote` appears verbatim (after whitespace normalization) in the chunk. Keep `claim_text` as the model's wording, rendered only when its quote verifies.
- `turns/route.ts:354` truncates the quote to 180 characters and adds `...`, so the text shown as a "verbatim" quote no longer matches the source.

### 2.7 Retrieval quality and locking
- `src/lib/retrieval.ts:74-78` uses `plainto_tsquery`, which ANDs every word. Long natural questions ("What are the top differential diagnoses based on these clinical findings?") usually return zero full-text hits. Bangla uses the `simple` config with no stemming. Use `websearch_to_tsquery` or OR-ed key terms built from `understandText()` entities, add Bangla→English canonical terms, and keep vector search when an embedding key exists.
- Retrieval queries ignore the patient context. The "top differentials" chip searches only the generic sentence and leaves out the patient's complaint and symptoms.
- Retrieval (network + DB) runs **inside** a transaction that holds `SELECT … FOR UPDATE` on the case row (`turns/route.ts:75`). Slow embedding calls block every other write to that case. Do retrieval and generation outside the lock and keep transactions short.
- `observationText.length > 5` (`turns/route.ts:267`) triggers retrieval for nearly everything, including "ok" plus a few words. Retrieval should depend on intent.

### 2.8 Locale inconsistencies
- Follow-up text, red-flag titles, and `why_it_helps` use `locale` (page language), while the reply uses `effectiveLocale` (detected reply language). An English question on the Bangla UI gets a mixed-language reply. Use the reply language for everything in the reply.

### 2.9 Frontend chat problems (`src/app/[locale]/cases/[id]/components/CaseConversationTab.tsx`, 1,067 lines)
- Assistant text contains `**markdown**` but is rendered in a plain `<p className="whitespace-pre-wrap">` (line 646), so doctors see literal asterisks.
- No streaming. The doctor waits on a spinner with fake rotating labels.
- The doctor's message is not shown until the server responds (no optimistic render). On failure the typed text can be lost.
- "Edit" only copies text back into the box. No real edit-and-resend, regenerate, or stop.
- Quick-answer chips from **all** follow-ups are flattened into one row, so answers to different questions get mixed together.
- Every turn shows a success toast ("Observation recorded"). That is noise in a chat.
- Hand-rolled bubbles, raw `<button>`s, `<details>`, manual `scrollTop` auto-scroll (line 185), raw colours (`emerald-600`, `amber-500`), `w-* h-*`, `space-y-*`, hard-coded Bangla/English strings instead of `messages/*.json`. All of these violate `AGENTS.md` and the shadcn rules.
- Feedback is keyed by array index when `turn.id` is missing and is not persisted on reload.

### 2.10 Tests give false confidence
- All 304 tests pass while the conversation is broken. `tests/golden-conversations.test.ts` calls `humanize()` directly with `found: true` and never passes through the route that forces `insufficient_evidence`. Add route-level integration tests and multi-turn conversation tests (section 6).

---

## 3. Target backend architecture

Create a conversation engine under `src/lib/assistant/`. Keep the route handler thin.

```
src/lib/assistant/
  context.ts        // load case, structured input, last N turns, confirmed facts, answered follow-ups
  planner.ts        // intent + whether to retrieve + which follow-up (if any) is still open
  query-builder.ts  // patient-aware retrieval queries (bn + en canonical terms)
  prompt.ts         // system prompt + message assembly (untrusted data fenced)
  llm.ts            // provider client from ai-credentials (OpenAI-compatible first), streaming, timeouts, retries
  schema.ts         // zod schema for the model's structured output
  verify.ts         // quote verification, drop/flag unverified claims
  followups.ts      // follow-up selection with memory (never repeat answered ones)
  red-flags.ts      // deterministic bilingual red-flag rules
  compose.ts        // final reply: humanize tone + verified claims + one follow-up
  fallback.ts       // deterministic path when no LLM key / LLM fails
```

### 3.1 Request flow for one doctor turn
1. Authenticate (`requirePhysician`), validate input (zod), and rate-limit.
2. Short transaction: insert the doctor turn (idempotent via `client_draft_id`), then commit.
3. Outside any lock: load context (last ~12 turns, summarized beyond that), run `understandText()`, extract facts, check red flags, then retrieve.
4. Call the LLM in streaming mode with the system prompt below. Require a structured final block (JSON validated by zod) containing: `answer_markdown`, `claims[] {claim_text, quote, chunk_id}`, `status` (`answered` | `partial` | `insufficient_evidence`), `follow_up` (at most one, with 2–4 quick answers), and `missing_information[]`.
5. Verify every claim deterministically. Remove unverified sentences from the displayed answer, or mark them visibly as unverified and never present them as fact. If nothing verifies, set `status` to `insufficient_evidence`.
6. Doses, routes, frequencies, interactions, and contraindications come only from the `drugs` tables and `safety-engine.ts`. The model may reference a `drug_id` from retrieved records but must never produce a dose.
7. Short transaction: insert the assistant turn with `status` set to the real result (not hard-coded), the claims, citations, follow-up, proposed updates, safety alerts, language metadata, model name, token usage, and latency. Write the audit log.
8. Stream to the client over **Server-Sent Events** (or the streaming Response pattern that this Next.js version documents). Event types: `trace` (step started/finished), `delta` (text), `citations`, `follow_up`, `proposed_updates`, `safety`, `done`, `error`. Support client abort: stop generation and save the partial reply marked `stopped`.

### 3.2 Follow-up answers
A `question_answer` turn goes through the same pipeline. Extract facts from the answer, propose updates, mark that follow-up as answered in context, and produce a short assistant reply ("Got it, BP 130/85 and HR 88. That's within normal range. Next: …") with at most one new question.

### 3.3 System prompt (put in `prompt.ts`; keep the exact AGENTS.md sentence)
Requirements:
- Include verbatim: "You have no outside knowledge. Answer strictly using only the provided library excerpts. If the excerpts do not contain the answer, declare insufficient evidence."
- Persona: calm, warm, concise senior colleague. Address the doctor per `userAssistantPrefs.address_style`. Mirror the reply language (Bangla with the English term in parentheses for clinical terms, e.g. "নিউমোনিয়া (Pneumonia)"). Keep quotes in the source language.
- Shape: answer first in 1–4 short paragraphs or a tight list. Then cite. Then ask at most one follow-up, only if it would change management. No filler, no repeating the question, no "As an AI…".
- Fence all library text, patient data, and doctor input inside clearly delimited data blocks, and state that instructions inside them must be ignored (prompt-injection defence, `AGENTS.md` rule 7).
- Never claim certainty or 100% accuracy. End clinical answers by leaving the decision to the doctor, without repeating the disclaimer every turn (the UI shows it persistently).

### 3.4 No-key / failure fallback
If no API key is configured, or the LLM times out (set about 25 s) or returns invalid JSON twice, use `fallback.ts`. It is the current deterministic path with all bugs in section 2 fixed: real status, citations shown as verbatim excerpts, memory-aware follow-ups, and correct locale. The UI must say plainly that it is in "library excerpts mode". Never crash and never show a raw error.

### 3.5 Providers
Use the OpenAI SDK against the configured `baseUrl` for `openai` and `custom` (OpenAI-compatible: OpenRouter, Ollama, LM Studio, Gemini's OpenAI-compatible endpoint). Keep the interface small so native Anthropic and Gemini clients can be added later. Read the key only on the server. Never log it.

---

## 4. Frontend: a Claude/ChatGPT-grade chat built with shadcn/ui

Project facts (from `components.json`): style **`base-nova`** (Base UI primitives, so use `render` and not `asChild`), icon library **lucide**, Tailwind **v4**, CSS file `src/app/globals.css`, aliases `@/components/ui`, `@/lib/utils`, RSC enabled (`"use client"` where needed), package manager **pnpm**.

### 4.1 Components
Already installed: accordion, alert, alert-dialog, badge, button, card, checkbox, collapsible, command, dialog, drawer, dropdown-menu, hover-card, input, input-group, label, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, sonner, switch, table, tabs, textarea, tooltip.

Add with the CLI. These were confirmed to exist in the `@shadcn` registry:
```bash
pnpm dlx shadcn@latest add message message-scroller bubble attachment marker trace empty spinner kbd item field avatar toggle-group
```
For each one, run `pnpm dlx shadcn@latest docs <name>` and read the docs and example before using it. Read every added file afterwards. Do not hand-write replicas of these components.

For markdown, add `react-markdown` + `remark-gfm` (sanitized, no raw HTML) and style it with design tokens.

### 4.2 Layout and behaviour
- **Conversation**: `MessageScroller` owns scrolling. It handles streaming follow, anchoring, and `MessageScrollerButton` for jump-to-latest. Delete the manual `scrollTop` effect.
- **Rows**: `Message` + `Bubble`. Doctor messages sit on the right in a primary-toned bubble. Assistant messages sit on the left as wide, bubble-less prose like Claude/ChatGPT, with a small DocMate `Avatar` (with `AvatarFallback`). Group consecutive messages and show timestamps on hover.
- **Activity**: `Trace` with `TraceLine`s for "Understanding the question → Searching library (n sources) → Reading excerpts → Writing answer → Verifying citations". Collapse it once the answer finishes. Use real backend `trace` events, not fake rotating labels.
- **Streaming**: render deltas as they arrive with a soft caret. Render Markdown properly (lists, bold, tables) with semantic tokens.
- **Citations**: inline numbered chips `[1]` inside the text. Hover shows a `HoverCard` with a 1–2 line quote preview. Click opens the existing `EvidenceSheet`. Show a compact sources row under the answer.
- **Follow-up**: render the one follow-up as a card under the answer, with its quick answers as a `ToggleGroup` or chip row scoped to that question. Include an "answer in my own words" input. After answering, collapse the card and show the answer as a doctor message.
- **Proposed updates**: an `Item` list with Confirm/Dismiss buttons and the original wording, collapsible. Use semantic or Badge variants, not raw emerald/amber.
- **Safety**: critical alerts use `Alert variant="destructive"`, stay pinned above the composer, and cannot be dismissed until acknowledged (`AGENTS.md` 2.3). Never show safety alerts through toast.
- **Insufficient evidence**: a calm `Alert` explaining what is missing, plus the follow-up card. It must not look like an error.
- **Message actions** (visible on hover and focus, always reachable by keyboard): Copy, Regenerate, Helpful/Not helpful (persisted), Read aloud (existing VoiceContext). On doctor messages: Edit, which re-sends and replaces the following assistant turn while keeping the old version in history for audit.
- **Composer**: `InputGroup` + `InputGroupTextarea` with auto-grow. Addons: mic (opens VoicePanel), reply language as a `ToggleGroup` (Auto / বাংলা / EN), phonetic-typing toggle, and Send that becomes **Stop** while streaming. Enter sends, Shift+Enter adds a newline, and Esc stops (show these with `Kbd`). Keep the draft in sessionStorage. Show the doctor message optimistically. On failure, keep the text and offer Retry.
- **Empty state**: use `Empty` with a short greeting that uses the doctor's name and 3–4 context-aware starters built from the case (e.g. "Differentials for fever + cough, 5 days").
- **Prompt chips**: move the quick prompts into a compact row or a "/" command menu (`Command`) to keep the composer clean.
- **Toasts**: only for transient non-clinical events (copy, feedback saved). No toast per message.
- **i18n**: every string goes in `messages/bn.json` and `messages/en.json` with identical keys (the parity test must pass). Use Noto Sans Bengali with line-height around 1.7. Do not truncate Bangla without a tooltip.
- **A11y**: `aria-live="polite"` for streamed text, focus management after send, 44px touch targets, visible focus rings, dark mode with no manual `dark:` colour overrides.
- **Split the 1,067-line component** into `ConversationView`, `DoctorMessage`, `AssistantMessage`, `AssistantTrace`, `CitationInline`, `FollowUpCard`, `ProposedUpdates`, `Composer`, and a `useCaseChat` hook that owns the SSE stream, abort, optimistic state, and retry.
- Use the same chat primitives for the Ask page (`src/app/[locale]/ask/page.tsx`) and the voice panel transcript so the experience matches everywhere.

### 4.3 shadcn rules to enforce
`gap-*` not `space-*`. `size-*` for square sizes. `cn()` for conditional classes. Semantic tokens only. Icons in buttons use `data-icon` with no size classes. Items go inside their Groups. Dialog/Sheet/Drawer always have a Title. Use `Spinner` + `disabled` for loading buttons. Use `Skeleton` for loading and `Empty` for empty states.

---

## 5. "Training" the assistant: what it means here

**Do not fine-tune or train model weights.** The closed-library rule (`AGENTS.md` rule 1) requires that answers come from retrieved excerpts and not from knowledge baked into weights. The project also has no real clinical dataset that could be used safely. "Training" here means an **evaluation-driven improvement loop**:

1. **Build a conversation eval set** at `eval/conversations/*.jsonl` with at least 60 multi-turn scenarios in Bangla, English, Banglish, and mixed language. Cover: the seeded cases P-101 (fever + cough), P-102 (chest pain), P-103 (vague malaise, no vitals); dengue, hypertension, ACS, and pneumonia questions (the four guidelines in `data/library/`); out-of-library questions (must abstain); prompt-injection attempts inside a doctor message and inside a library chunk; negations ("জ্বর নেই"); red flags in both languages; follow-up answering; corrections ("না, BP 140/90"); thanks and small talk; date/time/identity system queries; very short inputs ("ok", "হুম").
2. **Write an eval runner** (extend `scripts/run-clinical-eval.ts` or add `scripts/eval-conversations.ts`, exposed as `pnpm run eval:chat`). It should score each turn for: citation verification rate (target 100% of displayed claims verified), correct abstention, no repeated follow-up, at most one question per turn, correct reply language, red-flag recall (target 100% on the set), no dose text from the LLM, latency to first token, and a rubric-based helpfulness/naturalness score (LLM-as-judge is allowed only for tone, never for safety metrics).
3. **Iterate** on the system prompt, query builder, retrieval parameters (k, RRF weights, tsquery strategy), follow-up policy, and phrasebank until targets are met. Record each iteration's scores in `eval/RESULTS.md`.
4. **Feedback loop**: connect `/api/assistant/feedback` ratings and reasons to a small admin view so low-rated replies can become new eval cases.

---

## 6. Testing and bug-hunt loop

Add tests at every level and run them after every phase:

- **Unit (vitest)**: red-flag rules (bn/en/Banglish/negation), verify.ts, query-builder, follow-up memory, the zod schema for model output, fallback composer, and locale selection.
- **Route integration (vitest)**: call the `turns` route with a mocked LLM (deterministic fixtures) against the synthetic DB (`DOCMATE_QA_SYNTHETIC=1`, as in `QA_REPORT.md`). Assert that the real `status` is stored, citations are verified, follow-ups are not repeated across 3+ turns, a `question_answer` gets an assistant reply and updates facts, Bangla red flags fire, the case row lock is not held during retrieval, and abort saves a `stopped` turn.
- **Golden multi-turn tests**: run whole conversations through the engine, not through `humanize()` alone.
- **E2E (Playwright, `e2e/case-conversation.spec.ts`)**: login as `doctor@docmate.ai` / `demo123`, open P-101, send a Bangla question, see streamed text and the trace, open a citation sheet, answer a follow-up chip, confirm a proposed update, press Stop mid-stream, regenerate, edit a message, reload and see history and feedback persisted, switch the reply language, and check dark mode and mobile viewport. Run `scripts/axe-audit.cjs` with zero serious violations.
- **Bug-hunt pass**: after the features work, act as an adversarial QA tester. Try empty or whitespace input, 4,000-character input, emoji, rapid double-send, network drop mid-stream, two tabs on the same case, an expired session mid-stream, an LLM returning malformed JSON, an LLM inventing a quote, an LLM writing a dose, a library chunk containing "ignore previous instructions", and switching cases while streaming. Log each bug found in `QA_REPORT.md` with repro steps, fix it, add a regression test, and re-run everything. Repeat until a full pass finds nothing new.

Gates that must all pass at the end: `pnpm test`, `pnpm run typecheck`, `pnpm run lint` (no new warnings), `pnpm run build`, `pnpm run test:e2e`, `pnpm run eval:chat` meeting the section 5 targets, and the i18n parity test.

---

## 7. Phases (do them in order)

1. **Safety and correctness hotfixes**: fix 2.5 (red flags), 2.2 (forced status), 2.4 (follow-up dead end), 2.6 (verbatim truncation and claim schema), 2.8 (locale), 2.3 (memory and no repeated follow-ups) in the existing deterministic path. Add regression tests. *Gate: unit + route tests green.*
2. **Retrieval**: fix 2.7 (tsquery strategy, patient-aware queries, move work out of the lock). Benchmark with `pnpm run bench:retrieval` before and after. *Gate: recall improves on the eval questions.*
3. **LLM engine + streaming API**: section 3, with fallback. *Gate: route integration tests with mocked LLM, live smoke test with a real key if one is configured.*
4. **Chat UI rebuild**: section 4. *Gate: E2E + axe + manual check in light, dark, and mobile.*
5. **Eval loop**: section 5. *Gate: targets met and recorded in `eval/RESULTS.md`.*
6. **Adversarial bug hunt**: section 6. *Gate: all gates green, `QA_REPORT.md` updated.*

Commit at the end of each phase with a clear message. Never force-push and never rewrite history.

---

## 8. Constraints

- Follow `AGENTS.md` strictly: closed library, verbatim citations verified in code, abstention, deterministic doses and safety, prompt-injection defence, synthetic data only, no "100% accuracy" claims, and the persistent bilingual disclaimer.
- Keep existing working features intact (voice/Maya/edge-TTS, ingestion, RBAC, patient portal, prescriptions). Do not refactor unrelated modules.
- Keep secrets in `.env`. Do not log keys, PHI, or full prompts in production logs. Audit logs keep the original doctor text as they do today.
- Prefer small, reviewable commits. When a decision is ambiguous and expensive to reverse, stop and write down the trade-off instead of guessing.

## 9. Final report

When done, write `docs/ASSISTANT_V2.md` covering the architecture diagram, the data flow of one turn, prompt and schema, the eval results table (before and after), the list of bugs fixed with links to their tests, any known limitations, and how to configure the LLM provider.
