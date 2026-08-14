---
description: Audit staged changes for code-quality issues, propose fixes, and suggest a commit message
---

Audit the currently **staged** changes, propose code fixes (without staging them), and suggest a commit message. Do not commit anything — only review and suggest.

## Steps

1. Get the staged diff:
   - `git diff --cached --stat` for an overview
   - `git diff --cached` for the full diff
   - If nothing is staged, tell the user "No staged changes to audit" and stop.

2. Review the staged diff for code-quality issues. Focus on what the diff actually changes — do not audit unrelated pre-existing code. Check for:
   - **Correctness**: obvious bugs, off-by-one, null/undefined access, wrong async handling, unhandled promise rejections, missing computed properties, refs not tracked properly.
   - **Clean code / simplicity**: dead code, duplication, over-engineering, needless complexity, unclear names. Prefer the simplest thing that works.
   - **Architecture**: verify component → store → service layering. Components should never call services directly (always via store actions). Forms use TanStack Vue Form with proper validation.
   - **Vue/Pinia conventions** (this repo): `<script setup>` first → `<template>` → `<style scoped>`; Composition API; stores use `defineStore` composition style. Script tag must come first in SFC.
   - **Firestore/Firebase**: proper error handling for async operations, no direct Firestore access from components, auth token management.
   - **Style**: matches Prettier config (single quotes, trailing commas, 2-space indentation). Flag anything a lint run would reject. Tailwind classes properly formatted.
   - **Accessibility**: semantic HTML, ARIA attributes where needed, proper heading hierarchy, form labels associated with inputs.
   - **Leftovers**: `console.log`, commented-out code, `debugger`, TODO/FIXME added in this diff, stray test/scratch files.
   - **Secrets**: hardcoded API keys, Firebase config that shouldn't be committed, hardcoded credentials.

3. Report findings grouped by severity: **Must fix** / **Consider** / **Nitpick**. Reference `file:line`. If the diff is clean, say so plainly. Be direct and critical — no rubber-stamping.

4. If there are fixable issues, ask the user: "Apply these fixes?" If yes, apply the code changes using the Edit tool (do NOT stage them). Report what was changed. The changes will remain **unstaged** so the user can review the diffs before deciding to stage them.

5. Propose a commit message following this repo's convention:
   - Format: `type(scope): change list` — lowercase, imperative, comma-separated for multiple changes.
   - Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`.
   - Examples: `feat(orders): add export functionality, show export status in list`, `fix(dashboard): handle missing user roles gracefully`.
   - **No `Co-Authored-By` trailer** — only the primary author (you) should be credited.
   - Give one primary suggestion; offer a short alternative if the change spans multiple concerns (and note it might warrant splitting the commit).

6. End by asking whether to commit with the proposed message, or whether the user wants to make further revisions first. Do not run `git commit` unless the user confirms.
