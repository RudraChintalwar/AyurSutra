/**
 * Nightly Scoring CRON
 * Recalculates dynamically decaying wait times globally across unresolved sessions.
 *
 * BUGS FIXED:
 *  #9  — Status filter was 'pending' which never exists. Changed to cover all
 *         active statuses: pending_review, confirmed, scheduled.
 *  #10 — Field names were wrong on all three scoring inputs:
 *         baseSeverityScore  → severity_score
 *         feedbackEscalation → feedback_escalation
 *         doshaMatch (never written anywhere) → computed dynamically from
 *           dosha + datetime using the same DOSHA_TIME_BLOCKS table that
 *           priorityQueue.js uses at booking time.
 *         createdAt          → created_at  (sessions use snake_case)
 *  #11 — Used ScoringEngine.calculateTotalPriority (weights 50/30/15/5) which
 *         differs from the priorityQueue.js formula (40/35/15/10) used at
 *         booking time. Nightly run was silently rewriting scores with a
 *         different formula, causing compounding priority drift. Now uses
 *         calculatePriorityScore from priorityQueue.js so the formula is
 *         always consistent.
 *  #12 — Batch reuse after commit. When hitting the 500-write Firebase limit,
 *         batch.commit() was called without await and the same batch object
 *         was reused for the next writes — Firestore throws on writes to an
 *         already-committed batch. Now creates a fresh batch after each commit
 *         and collects all commit promises for a final await.
 */

import cron from 'node-cron';
import { admin } from '../middleware/auth.js';
import { calculatePriorityScore } from '../utils/priorityQueue.js'; // FIX #11: use same formula as booking

const db = admin.firestore();

// ─── Dosha Time-Block table (mirrors priorityQueue.js) ────────────────────────
// Used to compute the dosha optimisation bonus dynamically at recalc time
// instead of relying on a pre-stored boolean that was never written (FIX #10).
const DOSHA_TIME_BLOCKS = {
    kapha: { start: 6,  end: 10 },
    pitta: { start: 10, end: 14 },
    vata:  { start: 14, end: 18 },
};

function getDoshaTimeBonus(dosha, slotDatetime) {
    if (!dosha || !slotDatetime) return 0;
    const doshaLower = dosha.toLowerCase();
    const hour = new Date(slotDatetime).getHours();
    for (const [type, block] of Object.entries(DOSHA_TIME_BLOCKS)) {
        if (doshaLower.includes(type) && hour >= block.start && hour < block.end) {
            return 100;
        }
    }
    return 0;
}

// Run every night at Midnight IST.
export function startNightlyScoringJob() {
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Starting Nightly Dynamic Priority Score Recalculation');

        try {
            const sessionsRef = db.collection('sessions');

            // ─── FIX #9: Query all active statuses, not the non-existent 'pending' ──
            // Wait-time decay is relevant for any session not yet completed/cancelled.
            const snapshot = await sessionsRef
                .where('status', 'in', ['pending_review', 'confirmed', 'scheduled', 'reschedule_requested'])
                .get();

            if (snapshot.empty) {
                console.log('[CRON] No active sessions found. Recalculation skipped.');
                return;
            }

            console.log(`[CRON] Found ${snapshot.size} active sessions for recalculation.`);

            // ─── FIX #12: Collect batches as an array — never reuse a committed batch ──
            const batches = [];
            let currentBatch = db.batch();
            let operationsInBatch = 0;
            const MAX_BATCH_SIZE = 499; // Stay under Firebase's 500-write cap
            let totalUpdated = 0;

            snapshot.forEach(docSnap => {
                const data = docSnap.data();

                // ─── FIX #10a: Correct field name — sessions use severity_score ──────
                const severityScore = data.severity_score || 5;

                // ─── FIX #10b: Correct field name — sessions use feedback_escalation ─
                const feedbackEscalation = data.feedback_escalation || false;
                const feedbackMultiplier = data.feedback_multiplier || 1.0;

                // ─── FIX #10c: Compute dosha bonus dynamically (field was never written) ─
                const doshaBonus = getDoshaTimeBonus(data.dosha, data.datetime);

                // ─── FIX #10d: Correct field name — sessions use created_at ──────────
                const createdAt = data.created_at || data.createdAt || new Date().toISOString();

                // ─── FIX #11: Use calculatePriorityScore (same formula as booking) ────
                const { totalScore, breakdown } = calculatePriorityScore({
                    severityScore,
                    feedbackEscalation,
                    feedbackMultiplier,
                    dosha: data.dosha || '',
                    slotDatetime: data.datetime || null,
                    createdAt,
                });

                const hoursWaiting = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
                const waitTimeDays = hoursWaiting / 24;

                const docRef = sessionsRef.doc(docSnap.id);
                currentBatch.update(docRef, {
                    totalPriorityScore: totalScore,
                    priority: totalScore,           // keep both fields in sync
                    waitTimeDays: parseFloat(waitTimeDays.toFixed(2)),
                    lastPriorityRecalculation: new Date().toISOString(),
                    // Store breakdown for debugging / analytics
                    priorityBreakdown: breakdown,
                });

                operationsInBatch++;
                totalUpdated++;

                // ─── FIX #12: Seal full batch, push it, open a fresh one ─────────────
                if (operationsInBatch >= MAX_BATCH_SIZE) {
                    batches.push(currentBatch.commit());
                    currentBatch = db.batch();
                    operationsInBatch = 0;
                }
            });

            // Commit whatever is left in the final (possibly only) batch
            if (operationsInBatch > 0) {
                batches.push(currentBatch.commit());
            }

            // Await all batch commits together
            await Promise.all(batches);

            console.log(`[CRON] Successfully recalculated priority scores for ${totalUpdated} sessions across ${batches.length} batch(es).`);

        } catch (error) {
            console.error('[CRON] FATAL Exception during nightly scoring evaluation:', error);
        }
    }, {
        timezone: "Asia/Kolkata"
    });
}
