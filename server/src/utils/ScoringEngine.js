/**
 * ScoringEngine.js
 * Advanced Priority & Severity Computation for AyurSutra
 */

class ScoringEngine {
  /**
   * Calculates the highly differentiated total priority score.
   * 
   * @param {number} S - Base Severity Score from Python ML (0.0 - 100.0)
   * @param {number} E - Emergency Escalation Factor (0 for normal, 100 for adverse side effects)
   * @param {number} W_days - Wait Time in days since booking request
   * @param {number} D - Dosha Optimization Match (0 or 100)
   * @returns {number} The Total Priority Score (0.0 - 100.0)
   */
  static calculateTotalPriority(S, E, W_days, D) {
    // Weight parameters optimized for triage hierarchy
    const wS = 0.50; // Severity dictates standard precedence
    const wE = 0.30; // Escalations heavily override standard wait times
    const wW = 0.15; // Waiting too long causes slow but constant priority crawl
    const wD = 0.05; // Dosha chronobiology acts as an optimizer

    // Cap wait time decay W to a max index of 100 so it doesn't outscale medical emergencies.
    // Assuming 30 days is the absolute max wait cap (100).
    const W = Math.min(100, (W_days / 30) * 100);

    const totalPriority = (S * wS) + (E * wE) + (W * wW) + (D * wD);
    return Number(totalPriority.toFixed(4));
  }

  /**
   * Tie-Breaker Algorithm to resolve scheduling collisions strictly.
   * Primary Check: High totalPriorityScore wins.
   * Tie-Breaker 1: High Base Severity (S) wins.
   * Tie-Breaker 2: High Wait Time (W) wins.
   * Tie-Breaker 3: Absolute Fallback (FIFO createdAt timestamp).
   * 
   * @param {Object} patientA 
   * @param {Object} patientB 
   * @returns {number} Negative if patientA wins, positive if patientB wins.
   */
  static resolveScheduleConflicts(patientA, patientB) {
    // 1. Primary Check: Total Priority
    if (patientA.totalPriorityScore !== patientB.totalPriorityScore) {
      return patientB.totalPriorityScore - patientA.totalPriorityScore; // Descending
    }

    // 2. Tie-Breaker 1: Medical Urgency (Base Severity)
    if (patientA.baseSeverityScore !== patientB.baseSeverityScore) {
      return patientB.baseSeverityScore - patientA.baseSeverityScore;
    }

    // 3. Tie-Breaker 2: System Fairness (Wait Time Decay - represented by waitTimeDays internally)
    if (patientA.waitTimeDays !== patientB.waitTimeDays) {
      return patientB.waitTimeDays - patientA.waitTimeDays;
    }

    // 4. Tie-Breaker 3: Absolute Fallback (FIFO)
    // Compare timestamps directly to ensure older documents have chronological priority
    const timeA = new Date(patientA.createdAt).getTime();
    const timeB = new Date(patientB.createdAt).getTime();
    return timeA - timeB; // Ascending (earliest creation time wins)
  }
}

export default ScoringEngine;
