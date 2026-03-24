/**
 * ScoringEngine.js — DEPRECATED
 *
 * This file is kept only for reference. Do NOT import or use it.
 *
 * ISSUE A: Two competing priority formulas existed in the codebase:
 *
 *   ScoringEngine.js (this file)    — weights 50/30/15/5,  severity input 0–100
 *   priorityQueue.js (canonical)    — weights 40/35/15/10, severity input 1–10
 *
 * The input scales are incompatible: passing a session's severity_score of 7
 * (stored as 1–10) into calculateTotalPriority() treats it as 7/100 = 7%,
 * producing a score of ~20 instead of the correct ~68.
 *
 * All scoring must go through calculatePriorityScore() in priorityQueue.js.
 * That is the single source of truth used by:
 *   - scheduling.js  (at booking time)
 *   - nightlyScoring.js  (nightly recalculation)
 *   - buildPriorityQueue()  (doctor dashboard queue)
 *
 * The tie-breaker logic in resolveScheduleConflicts() is still valid design
 * and has been incorporated into bumpAndReschedule() in priorityQueue.js.
 *
 * Delete this file once you have confirmed no other code imports it.
 */

// Deliberately not exporting anything so any accidental import fails loudly
// rather than silently producing wrong scores.

throw new Error(
    '[ScoringEngine] This module is deprecated. ' +
    'Import calculatePriorityScore from ../utils/priorityQueue.js instead.'
);
