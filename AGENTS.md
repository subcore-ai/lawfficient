<!-- BEGIN:nextjs-agent-rules -->
 
# Next.js: ALWAYS read docs before coding
 
Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.
 
<!-- END:nextjs-agent-rules -->

# Working guidelines

_Behavioral guidelines adapted from [Andrej Karpathy's CLAUDE.md](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md) to reduce common LLM coding mistakes. They apply to every agent in this repo, on top of the Next.js docs rule above._

**Tradeoff:** These bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think before coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

Here, "think before coding" starts with the rule above: read the relevant doc in `node_modules/next/dist/docs/` before any Next.js work. Next.js 16 + React 19 defaults (App Router, Server Components, `async` request APIs like `cookies()`/`headers()`/`params`, Cache Components / PPR) differ from older patterns in training data — confirm against the installed docs, not memory.

## 2. Simplicity first

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Prefer framework-native solutions before reaching for dependencies: Server Components over client components, Server Actions over bespoke API routes, the built-in `fetch` cache over a data-fetching library. Don't reach for `"use client"` or a state library when a Server Component already renders it. Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style (TypeScript, Tailwind v4, shadcn / Base UI) even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that YOUR changes made unused; leave pre-existing dead code alone.
- Don't touch `next.config.ts`, the App Router tree, or Vercel project settings unless the task requires it.

The test: every changed line should trace directly to the request.

## 4. Goal-driven execution

**Define success criteria. Loop until verified.**

Transform vague tasks into verifiable goals:
- "Add validation" → "Cover the invalid inputs, then confirm they're rejected"
- "Fix the bug" → "Reproduce it first, then confirm the repro is gone"
- "Refactor X" → "Ensure behavior holds before and after"

For multi-step tasks, state a brief plan with a verify step for each.

"Done" in this repo means the relevant gates pass (run with bun):
- `bun run typecheck` — `tsc --noEmit`
- `bun run lint` — eslint
- `bun test` — unit tests via bun's built-in runner (`*.test.ts`; run from `apps/app`, or `bun run test` at the root)
- `bun run build` — `next build`; the real check for Server/Client boundary and RSC errors
- `bun dev` — manual check when the change is visual

Test coverage is being built out with `bun test` — until it's broad, treat these commands together as the verifiable gate. On Vercel, verify on the preview deployment before promoting to production; a green local build is not proof the deploy works.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites from overcomplication, and clarifying questions come before implementation rather than after mistakes.
