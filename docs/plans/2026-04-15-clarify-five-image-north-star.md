# Clarify Five-Image North Star Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update project docs to explicitly prioritize automating 5 property images first, with low-volume operation now and scaling later.

**Architecture:** Keep existing rendering architecture unchanged. Make documentation-only updates in high-visibility docs so product intent is unambiguous for future commits and agent-assisted changes.

**Tech Stack:** Markdown documentation in repository root (`README.md`, `REQUIREMENTS.md`).

---

### Task 1: Update README product direction

**Files:**
- Modify: `README.md`

**Step 1:** Add a clear product north star section near the top.

**Step 2:** State immediate objective as generating 5 usable PNGs with visible boundaries.

**Step 3:** State operating assumption: a few runs per day now.

**Step 4:** State scaling approach: scale only after baseline correctness is stable.

### Task 2: Update requirements with explicit priority

**Files:**
- Modify: `REQUIREMENTS.md`

**Step 1:** Add a guiding product goal section above architecture sections.

**Step 2:** Reword role statement to emphasize 5 PNG outputs over broader infrastructure ambition.

**Step 3:** Preserve technical constraints while clarifying that complexity should be incremental.

### Task 3: Verify and commit

**Files:**
- Modify: `README.md`
- Modify: `REQUIREMENTS.md`
- Create: `docs/plans/2026-04-15-clarify-five-image-north-star.md`

**Step 1:** Run `git diff -- README.md REQUIREMENTS.md docs/plans/2026-04-15-clarify-five-image-north-star.md` to verify wording.

**Step 2:** Run `git status --short` to verify only intended docs changed.

**Step 3:** Commit with a docs-focused message.
