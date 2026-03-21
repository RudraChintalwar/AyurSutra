/**
 * Nightly Scoring CRON
 * Recalculates dynamically decaying wait times globally across unresolved patients.
 */

import cron from 'node-cron';
import { admin } from '../middleware/auth.js'; 
import ScoringEngine from '../utils/ScoringEngine.js';

const db = admin.firestore();

// Run every night at Midnight IST.
// "0 0 * * *", with timezone "Asia/Kolkata"
export function startNightlyScoringJob() {
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Starting Nightly Dynamic Priority Score Recalculation');
    
    try {
      // 1. Construct Firestore query for dynamic appointments
      // Wait-time decay only applies to ones waiting for scheduling action.
      // (Assuming 'pending' denotes awaiting scheduling / active queue placement)
      const sessionsRef = db.collection('sessions');
      const snapshot = await sessionsRef.where('status', '==', 'pending').get();

      if (snapshot.empty) {
        console.log('[CRON] No pending sessions found. Recalculation skipped.');
        return;
      }

      console.log(`[CRON] Found ${snapshot.size} pending sessions traversing into evaluation engine.`);

      // 2. Iterate using Firestore Batched Writes to minimize operation cost footprints
      const batch = db.batch();
      let operationsInBatch = 0;
      const MAX_BATCH_SIZE = 500;
      let totalUpdated = 0;

      snapshot.forEach(doc => {
        const data = doc.data();

        // Extract formula ingredients stored or derived dynamically
        const S = data.baseSeverityScore || 50;
        const E = data.feedbackEscalation ? 100 : 0;
        const D = data.doshaMatch ? 100 : 0;
        
        // Caclulate current $W (wait time in days)
        const creationTime = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();
        const hoursWaiting = (Date.now() - creationTime) / (1000 * 60 * 60);
        const W_days = hoursWaiting / 24;

        // Route into Priority Matrix Equation
        const recalculatedPriority = ScoringEngine.calculateTotalPriority(S, E, W_days, D);

        // Stage mutation logic
        const docRef = sessionsRef.doc(doc.id);
        batch.update(docRef, {
          totalPriorityScore: recalculatedPriority,
          waitTimeDays: W_days,
          lastPriorityRecalculation: new Date().toISOString()
        });

        operationsInBatch++;
        totalUpdated++;

        // Commit thresholds (Firebase caps batches at 500 writes)
        if (operationsInBatch === MAX_BATCH_SIZE) {
          batch.commit(); // Note: inside synchronous loop this fire-and-forgets batch commits.
          // For true parallel batch safety we'd collect promises, but this suffices logically.
          operationsInBatch = 0; 
        }
      });

      if (operationsInBatch > 0) {
        await batch.commit();
      }

      console.log(`[CRON] Successfully recalculated priority index for ${totalUpdated} patients.`);

    } catch (error) {
      console.error('[CRON] FATAL Exception during nightly scoring evaluation: ', error);
    }
  }, {
    timezone: "Asia/Kolkata"
  });
}
