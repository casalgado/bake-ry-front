---
description: Audit staged changes for code-quality issues, propose fixes, and suggest a commit message
---

Audit the currently **staged** changes, propose code fixes (without staging them), and suggest a commit message. Do not commit anything — only review and suggest.

## Steps

1. Get the staged diff:
   - `git diff --cached --stat` for an overview
   - `git diff --cached` for the full diff
   - If nothing is staged, tell the user "No staged changes to audit" and stop.

2. Run the actual linter against the staged files — this is the only point in the workflow where lint runs (never run eslint proactively while editing; only here):
   - `git diff --cached --name-only --diff-filter=ACM` filtered to `.js`/`.vue` files, split by which repo each path belongs to (frontend `bake-ry-front`, backend `bake-ry/functions`).
   - For frontend files: `npx eslint <files>` from the frontend root.
   - For backend files: `npx eslint <files>` from `bake-ry/functions`.
   - Record every rule violation with `file:line` and the rule id — these feed directly into the findings list in step 3 (fold them into **Must fix** or **Consider** depending on severity, don't list them separately).

3. Review the staged diff for code-quality issues. Focus on what the diff actually changes — do not audit unrelated pre-existing code. Check for:
   - **Correctness**: obvious bugs, off-by-one, null/undefined access, wrong async handling, unhandled promise rejections, missing computed properties, refs not tracked properly.
   - **Clean code / simplicity**: dead code, duplication, over-engineering, needless complexity, unclear names. Prefer the simplest thing that works.
   - **Architecture**: verify component → store → service layering. Components should never call services directly (always via store actions). Forms use TanStack Vue Form with proper validation.
   - **Vue/Pinia conventions** (this repo): `<script setup>` first → `<template>` → `<style scoped>`; Composition API; stores use `defineStore` composition style. Script tag must come first in SFC.
   - **Firestore/Firebase**: proper error handling for async operations, no direct Firestore access from components, auth token management.
   - **Style**: matches Prettier config (single quotes, trailing commas, 2-space indentation). Tailwind classes properly formatted. (Actual lint violations are already covered by step 2 — don't re-derive them by eye here.)
   - **Accessibility**: semantic HTML, ARIA attributes where needed, proper heading hierarchy, form labels associated with inputs.
   - **Leftovers**: `console.log`, commented-out code, `debugger`, TODO/FIXME added in this diff, stray test/scratch files.
   - **Secrets**: hardcoded API keys, Firebase config that shouldn't be committed, hardcoded credentials.

4. Report findings grouped by severity: **Must fix** / **Consider** / **Nitpick**. Reference `file:line`. If the diff is clean, say so plainly. Be direct and critical — no rubber-stamping.
   - Number every finding sequentially across all groups (do not restart at 1 per group), so each can be referenced by number:
     ```
     Must fix

     1. path/to/file.js:26 — one-line claim. Then the explanation.
     2. path/to/other.js:227-289 — one-line claim. Then the explanation.

     Consider

     3. ...
     ```
   - Within a finding, don't use " - " (spaced dash) as a bullet or clause separator; write full sentences or use a colon. It reads ambiguously in chat.

5. If there are fixable issues, ask the user: "Apply these fixes?" If yes, apply the code changes using the Edit tool (do NOT stage them). Report what was changed. The changes will remain **unstaged** so the user can review the diffs before deciding to stage them.

6. Propose a commit message following this repo's convention:
   - Format: `type(scope): change list` — lowercase, imperative, comma-separated for multiple changes.
   - Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`.
   - Examples: `feat(orders): add export functionality, show export status in list`, `fix(dashboard): handle missing user roles gracefully`.
   - **No `Co-Authored-By` trailer** — only the primary author (you) should be credited.
   - Give one primary suggestion; offer a short alternative if the change spans multiple concerns (and note it might warrant splitting the commit).

7. End by asking whether to commit with the proposed message, or whether the user wants to make further revisions first. Do not run `git commit` unless the user confirms.
