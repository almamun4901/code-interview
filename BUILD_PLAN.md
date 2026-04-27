# Code-Grounded Technical Interview Tool Build Plan

A Claude Code-friendly intensive plan. Each goal is independently shippable.
Run tasks in order within each goal. Goals build on each other.

---

## Goal 0 — Project Scaffold (30 min)

*Get a running Next.js app with the right dependencies wired up.*

### Tasks

1. `npx create-next-app@latest codeinterview --typescript --tailwind --app`
2. Install deps:
   ```bash
   npm install @octokit/rest @octokit/auth-app next-auth @anthropic-ai/sdk zod
   ```
3. Install dev deps:
   ```bash
   npm install -D @types/node
   ```
4. Create `.env.local` with placeholders:
   ```env
   GITHUB_CLIENT_ID=
   GITHUB_CLIENT_SECRET=
   ANTHROPIC_API_KEY=
   NEXTAUTH_SECRET=
   NEXTAUTH_URL=http://localhost:3000
   ```
5. Create folder structure:
   ```text
   app/
     api/
       auth/[...nextauth]/
       repos/
       interview/
         start/
         answer/
     interview/[sessionId]/
   lib/
     github.ts       # GitHub API helpers
     prompts.ts      # All prompt templates
     interview.ts    # Session logic
     depth.ts        # Follow-up detection logic
   types/
     index.ts
   ```
6. Verify `npm run dev` starts clean.

### Checkpoint

App runs at `localhost:3000` with no errors.

---

## Goal 1 — GitHub Auth + Repo Access (1–2 hrs)

*User logs in with GitHub, you can read their commits.*

### Tasks

1. Set up NextAuth with GitHub provider in `app/api/auth/[...nextauth]/route.ts`.
   - Request scopes: `read:user repo`
   - Store `access_token` in the JWT session
2. Create `lib/github.ts`:
   - `getUserRepos(token)` — fetch repos, return `{ name, full_name, description, language, pushed_at }`
   - `getRecentCommits(token, repo, limit=20)` — return `{ sha, message, date, files_changed }`
   - `getCommitDiff(token, repo, sha)` — return full diff text, truncated to 6000 chars
   - `getPRDescription(token, repo, sha)` — best-effort fetch of associated PR body
3. Create `app/api/repos/route.ts` — authenticated endpoint returning user's repos.
4. Create a basic `/` page: GitHub login button → repo list after auth.
5. Test manually: log in, verify repos appear, log a commit diff to console.

### Checkpoint

You can see your own repos and print a real commit diff.

---

## Goal 2 — Question Generation (2–3 hrs)

*The core prompt. Given a commit, produce 3–5 grounded interview questions.*

### Tasks

1. Create `lib/prompts.ts` with `buildQuestionPrompt(context)`:

   ```ts
   // context shape:
   {
     commitSha: string       // e.g. "a3f2c91"
     commitMessage: string
     diff: string            // truncated diff
     filePaths: string[]     // changed files
     prDescription?: string
     repoLanguage: string
   }
   ```

   Prompt must instruct Claude to:
   - Reference the actual commit SHA and file names in questions
   - Ask about *decisions made*, not generic patterns
   - Include at least one question about a trade-off or alternative approach
   - Return JSON: `{ questions: [{ id, text, targetDepth: "surface"|"deep", hint: string }] }`

2. Create `app/api/interview/start/route.ts`:
   - Accept `{ repo, sha }`
   - Fetch diff + metadata from GitHub
   - Call Claude API with question-generation prompt
   - Parse and validate response with Zod
   - Return `{ sessionId, questions, context }`

3. Create `types/index.ts` with `Session`, `Question`, `Answer` types.

4. Store session in-memory for now: a simple `Map<sessionId, Session>` in a module-level variable. You'll replace this later.

5. Test with your own repo: hit the endpoint with a real commit SHA, read the output. Iterate on the prompt until the questions feel specific and grounded.

   This is the most important step in the entire project. Do not rush it.

### Checkpoint

Given commit `a3f2c91`, questions mention the actual files and decisions in that commit.

---

## Goal 3 — Follow-Up Depth Detection (1–2 hrs)

*When an answer is shallow, probe deeper. This is the second hardest problem.*

### Tasks

1. Create `lib/depth.ts` with `assessAnswer(question, answer, context)`:

   Simple v1 heuristic. Implement these in order, stop when good enough:

   - **Level 1:** Check if answer mentions a trade-off word: `["however", "alternatively", "trade-off", "downside", "instead", "could have", "considered"]`. If none, mark shallow.
   - **Level 2:** Check answer length. Under 80 words with no code means likely shallow.
   - **Level 3 (Claude-powered):** If Level 1 and Level 2 are ambiguous, send to Claude with:

     ```text
     Question: {question}
     Answer: {answer}
     Does this answer explain WHY this decision was made and what alternatives were considered?
     Reply: DEEP or SHALLOW, then one sentence explaining why.
     ```

2. Create `buildFollowUpPrompt(question, shallowAnswer, context)` in `lib/prompts.ts`:
   - Follow-up must reference the specific answer given
   - Ask for the missing piece: the trade-off, the alternative, or the reasoning
   - Should feel like a human interviewer saying "can you say more about why?"

3. Add follow-up logic to `app/api/interview/answer/route.ts`:
   - Accept `{ sessionId, questionId, answer }`
   - Run `assessAnswer()`
   - If shallow: return `{ followUp: { text, isFollowUp: true } }`
   - If deep: return `{ next: nextQuestion, isFollowUp: false }`
   - Track follow-up count per question. Max 2 follow-ups before moving on.

### Checkpoint

Give a one-sentence answer to a question. Get a follow-up. Give a detailed answer. Move to next question.

---

## Goal 4 — Interview UI (2–3 hrs)

*The actual screen where the interview happens.*

### Tasks

1. Create `app/interview/[sessionId]/page.tsx`:
   - Header: repo name + commit SHA, clickable to GitHub
   - Question display with subtle "question N of M" indicator
   - Text area for answer. No submit on Enter; only on button click.
   - "Follow-up" badge when a follow-up is being asked
   - Progress through all questions
   - End screen: "Session complete" with session summary

2. Create `app/page.tsx` as the repo selector:
   - List user repos sorted by `pushed_at`
   - Clicking a repo shows last 10 commits
   - Clicking a commit starts an interview session by calling `/api/interview/start`

3. Style rules to enforce:
   - Show the commit SHA and file names visibly. They establish credibility.
   - Follow-up questions should look visually distinct: indented or labeled.
   - No loading spinners that block. Stream the question text via `ReadableStream`.

4. Wire up API calls with `fetch`, handle loading and error states.

### Checkpoint

Full interview flow works end to end in the browser.

---

## Goal 5 — Session Persistence (1 hr)

*Replace the in-memory Map with something that survives restarts.*

### Tasks

1. Choose storage: use Vercel KV (Redis) or simple SQLite via `better-sqlite3` for local dev.
2. Create `lib/store.ts`:
   - `createSession(data)` → `sessionId`
   - `getSession(id)` → `Session | null`
   - `updateSession(id, patch)` → `void`
3. Replace all `Map` usage in route handlers with `lib/store.ts` calls.
4. Add session expiry: 24 hours.

### Checkpoint

Start an interview, restart the dev server, resume the interview.

---

## Goal 6 — Self-QA Week (Ongoing)

*The most important goal. Interview yourself every day.*

### Repeating Daily Tasks

1. Pick a commit from a real project you worked on 1–4 weeks ago.
2. Do the full interview session.
3. After each session, note:
   - Which questions felt generic? → Improve the question-generation prompt
   - Which follow-ups felt off-topic? → Improve the depth prompt
   - What did the UI make annoying? → Fix it
4. Keep a `NOTES.md` in the repo with raw observations.
5. After 5 sessions, audit the question prompt and rewrite any instruction that generated a bad question more than once.

### Goal

Complete 20 sessions before public launch.

If a question ever feels like something GPT would ask about any codebase, the prompt needs work.

---

## Goal 7 — Pre-Launch Hardening (Half Day)

*Make it not break for strangers.*

### Tasks

1. Rate limiting: max 5 interview starts per user per day. Store count in session store.
2. Diff size cap: truncate diffs over 8000 tokens before sending to Claude. Add a visible note in the UI when truncation happens.
3. Handle repos with no commits, empty diffs, and binary files.
4. Add a simple `/api/health` endpoint.
5. Write 3 unit tests for `lib/depth.ts`: one shallow answer, one deep answer, one edge case.
6. Deploy to Vercel. Verify GitHub OAuth works on the prod domain.

### Checkpoint

A colleague can log in with their GitHub and complete a session without hitting an error.

---

## Prompt Engineering Checklist

### Question-Generation Prompt

- [ ] Questions reference the actual commit SHA
- [ ] Questions reference at least one real file path from the diff
- [ ] At least one question asks about a trade-off or alternative
- [ ] No question could apply to any random codebase unchanged
- [ ] Output is valid JSON parseable by Zod schema

### Follow-Up Prompt

- [ ] Follow-up references the specific answer given
- [ ] Follow-up asks for exactly the thing that was missing: trade-off, reasoning, or alternative
- [ ] Follow-up does not repeat the original question
- [ ] Follow-up is one sentence max

### Depth Assessment Prompt (Level 3)

- [ ] Returns only `DEEP` or `SHALLOW` plus one sentence
- [ ] Does not penalize short answers that are actually complete
- [ ] Correctly identifies "I used X because it was fast" as shallow
- [ ] Correctly identifies "I used X because Y and Z were the alternatives but X had better P99 latency for our use case" as deep

---

## Stack Summary

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 14 (App Router) | API routes + UI in one repo |
| Auth | NextAuth v5 | GitHub OAuth in ~30 lines |
| GitHub API | `@octokit/rest` | Official, typed |
| AI | `@anthropic-ai/sdk` | Claude Sonnet for questions + depth |
| Storage | Vercel KV or SQLite | Simple KV is enough for sessions |
| Deploy | Vercel | Zero-config for Next.js |
| Styling | Tailwind | Fast, no context-switching |

---

## Claude Code Usage Tips

- Give Claude Code the entire `lib/prompts.ts` file when asking it to improve prompts. It needs the full context.
- When a question feels wrong, paste the actual bad output and the commit diff into Claude Code and ask it to diagnose which part of the prompt caused it.
- Keep `NOTES.md` updated. Paste it to Claude Code at the start of each session as context for what has already been tried.
- Do not ask Claude Code to "make the prompts better" in the abstract. Show it a bad question and a good question, then ask it to find the diff.
