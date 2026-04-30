# Goal 3: Follow-Up Depth Detection

This document records the Goal 3 work implemented in this repo.

## Purpose

Given an interview question and a candidate answer, the depth module decides whether the answer is deep enough. If the answer is shallow and the question has fewer than two follow-ups already, it generates a targeted follow-up question.

The design is a three-layer funnel:

1. Layer 1: keyword heuristic
2. Layer 2: structural/depth-signal heuristic
3. Layer 3: Claude-powered judge for ambiguous answers

Layer 3 is intentionally reserved for ambiguous answers so most assessments stay fast and cheap.

## Files Added

- `lib/depth/types.ts`: Shared module types.
- `lib/depth/layers.ts`: Layer 1 and Layer 2 heuristics.
- `lib/depth/judge.ts`: Layer 3 Claude judge.
- `lib/depth/followup.ts`: Claude follow-up generation plus fallback follow-ups.
- `lib/depth/index.ts`: Public API: `assessAnswer()` and `assessAndFollowUp()`.
- `app/api/interview/answer/route.ts`: Answer submission route.
- `scripts/test-depth.ts`: Manual depth detector test suite.
- `scripts/test-depth-integration.ts`: End-to-end follow-up loop test.
- `lib/store.ts`: Minimal in-memory store shim used by the answer route until Goal 5 persistence replaces it.

## Files Updated

- `lib/depth.ts`: Re-exports `./depth/index` for compatibility with imports from `@/lib/depth`.
- `package.json`: Added `test:depth` and `test:depth:integration`.

## Public API

```ts
assessAnswer(input): Promise<AssessmentResult>
```

Runs Layer 1, then Layer 2, then Layer 3 only if the earlier layers return `ambiguous`.

```ts
assessAndFollowUp(input): Promise<{
  assessment: AssessmentResult
  followUp?: FollowUpResult
}>
```

Runs assessment and generates a follow-up when the verdict is `shallow` and `followUpCount < 2`.

## Layer Behavior

Layer 1 checks for broad trade-off language and shallow deflection language. It can make high-confidence shallow or deep calls, otherwise it escalates.

Layer 2 checks structural signals:

- answer length
- code references
- concrete numbers or units
- alternatives considered
- failure modes
- constraints or requirements

An answer is treated as deep when it has at least two meaningful depth signals. Borderline answers, especially those that mention an alternative without enough reasoning, escalate to Layer 3.

Layer 3 sends the question, answer, and shallow/deep answer profiles to Claude and expects an exact response format:

```text
VERDICT: DEEP
REASON: ...
```

or:

```text
VERDICT: SHALLOW
REASON: ...
MISSING: ...
```

If Claude is unavailable or the response cannot be parsed, Layer 3 defaults to `shallow`. The product should ask one extra follow-up rather than accidentally pass a shallow answer.

## API Route

`POST /api/interview/answer`

Expected body:

```json
{
  "sessionId": "string",
  "questionId": "string",
  "answer": "string"
}
```

Response shapes:

```ts
{ followUp, assessment }
{ next, assessment }
{ sessionComplete: true, assessment }
```

The route:

1. Requires an authenticated NextAuth session.
2. Loads the interview session from `lib/store`.
3. Finds the submitted question.
4. Runs `assessAndFollowUp`.
5. Persists the answer and assessment.
6. Returns a follow-up, the next question, or session completion.

## Current Test Results

Commands run:

```bash
npm run test:depth
npm run test:depth:integration
npm run lint
npx tsc --noEmit
npm run build
```

Results:

- `npm run test:depth`: passed 6/6 cases.
- Layer 3 fired on 2/6 cases, matching the intended 20-40% band for the test mix.
- `npm run test:depth:integration`: passed the follow-up loop.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed after sandbox approval for Turbopack helper process permissions.

## Local Caveats

The local environment did not have an Anthropic API key available during verification. Claude calls therefore hit the module fallback behavior:

- Layer 3 defaults to shallow.
- Follow-up generation uses a fallback question.

The fallback follow-up now references a concrete part of the answer when possible, for example:

```text
You mentioned 86400 seconds - what specific requirement made that the right call at the time?
```

## Known Follow-Up Work

- Goal 5 should replace the in-memory `lib/store.ts` shim with persistent storage.
- UI integration should consume the answer route response shapes exactly as documented above.
- With a real Anthropic key, rerun `npm run test:depth:integration` to inspect the live Claude-generated follow-up wording.
