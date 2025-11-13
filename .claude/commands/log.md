# Log Command

Create a new development log entry for today's coding session by analyzing unlogged commits.

## Instructions

### Step 1: Find Latest Log Entry
- Read files in `zdocs/` to identify the most recent log
- Filename pattern: `YYYY_MM_DD_mad.md` (e.g., `2025_10_17_mad.md`)

### Step 2: Find Last Logged Commit
- Extract the **last commit hash** mentioned in the "Commits" section
- Commit hashes appear in format: `815356a`, `fd6cbec`, etc.
- This is the newest commit that was already logged

### Step 3: Get Unlogged Commits
- Run: `git log {last-commit}..HEAD --oneline --reverse` to get all commits since the last logged one, in chronological order (oldest first)
- If the result is empty, inform the user there are no new commits to log
- Analyze each commit with `git show {commit-hash}` to understand changes

### Step 4: Group Commits by Date
- **IMPORTANT**: If commits span multiple days, create a SEPARATE log entry for each day
- Group commits by their commit date (not today's date)
- For example, if commits are from Oct 9 and Oct 18, create two files:
  - `zdocs/2025_10_09_mad.md` for Oct 9 commits
  - `zdocs/2025_10_18_mad.md` for Oct 18 commits
- Each log file should only contain commits from that specific date
- The log file date should match the date of the commits, not the date you're creating the log

### Step 5: Create Log Entries

Create file(s): `zdocs/YYYY_MM_DD_mad.md` (using the commit date, not today's date)

Use this **exact structure**:

```markdown
# Development Log - {Month Day, Year}

## Summary
{Write 2-3 sentences summarizing what was accomplished in this session. Keep it brief and factual.}

## Commits

### {commit-hash} - "{commit message}" ({Month Day, Time})

**Summary:** {1-2 sentences describing what this commit accomplished, including key line counts}

**Files Added:**
- `path/to/file.js` ({X} lines) - {One sentence describing what this file does}
- `another/file.vue` ({X} lines) - {One sentence description}

**Files Modified:**
- `path/to/file.js` ({X} lines) - {One sentence describing what changed}
- `components/Foo.vue` ({X} lines) - {One sentence description}

**Files Deleted:**
- `path/to/old-file.js` - {One sentence explaining why it was removed}

---

### {next-commit-hash} - "{message}" ({Month Day, Time})

**Summary:** {1-2 sentences with line counts}

**Files Added:**
- ...

**Files Modified:**
- ...

---

{Continue for all commits in chronological order}
```

## Important Formatting Rules

1. **Dates**: Use format "October 19, 2025" not "19-10-2025"
2. **Commit Times**: Include time from git log (e.g., "October 19, 10:17 AM")
3. **Chronological Order**: List commits in chronological order (oldest to newest)
4. **Line Counts**: Always include line counts in parentheses
5. **File Summaries**: Exactly one sentence per file - brief and factual
6. **Commit Summary**: 1-2 sentences max, include major line counts
7. **Sections**: Only two sections: Summary and Commits
8. **No Code Examples**: Do not include code snippets or technical implementation details
9. **No Grouping**: Do not group commits by functionality - keep them in chronological order

## Key Principles

- **Brief and scannable**: Easy to quickly understand what happened
- **File-centric**: Focus on what files changed and why
- **Chronological**: Show the natural progression of work
- **Factual**: State what was done, avoid adjectives
- **Line counts**: Help gauge scope of changes
- **One sentence per file**: Keep descriptions concise

## Example

```markdown
# Development Log - October 19, 2025

## Summary
Created Match model with score tracking capabilities and enhanced tournament store with real-time match subscription management. Refactored TournamentDetail view to use centralized store instead of local state.

## Commits

### 372a5d0 - "added match model to frontend, improve tournament store" (October 19, 10:17 AM)

**Summary:** Created Match model (97 lines) and enhanced tournament store (201 lines) with real-time match management capabilities.

**Files Added:**
- `frontend/src/models/Match.js` (97 lines) - Match model with score tracking, status management, and utility getters.

**Files Modified:**
- `frontend/src/models/index.js` (1 line) - Exported Match model.
- `frontend/src/services/firestore/TournamentService.js` (86 lines) - Added match subscription and update methods for real-time match management.
- `frontend/src/stores/tournamentStore.js` (201 lines) - Added match getters and real-time subscription management with cleanup.
- `frontend/src/views/admin/tournaments/TournamentDetail.vue` (298 lines changed) - Refactored to use store-based match management instead of local state.
- `.claude/commands/log.md` (15 lines) - Updated with multi-day commit guidance.

---

### dd8fe0c - "seed scripts" (October 18, 8:42 AM)

**Summary:** Built production seed system (1,389 lines) with test data repositories and database utilities.

**Files Added:**
- `seeds/data/seedData.js` (307 lines) - Centralized test data repository with users, pollas, and entries.
- `seeds/queryDatabase.js` (164 lines) - Database query helper functions for existence checks and cleanup.
- `seeds/seedEntries.js` (398 lines) - Entry seeding script with validation.
- `seeds/seedPredictions.js` (325 lines) - Prediction seeding script with random score generation.
- `seeds/seedUsers.js` (195 lines) - User seeding script with Firebase Auth integration.

**Files Modified:**
- `seeds/seedAll.js` (108 lines) - Enhanced orchestration with dependency management and error handling.
- `seeds/seedPolla.js` (90 lines) - Enhanced polla seeding with existence checks.
- `seeds/package.json` (6 lines) - Added dependencies for Firebase Admin SDK.
- `package.json` (6 lines) - Updated root seed scripts for dev and production environments.

---
```
