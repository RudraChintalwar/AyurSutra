import { jest } from '@jest/globals';
import ScoringEngine from '../src/utils/ScoringEngine.js';

describe('AyurSutra Logic Engine Systems', () => {

  // ==========================================
  // Test Case 2.1: The Priority Formula
  // ==========================================
  describe('ScoringEngine Math Verification', () => {
    it('computes baseline equations properly (Expected 25.0)', () => {
      // S(50)*0.5 + E(0) + W(0) + D(0) = 25.0
      expect(ScoringEngine.calculateTotalPriority(50, 0, 0, 0)).toBe(25.0);
    });

    it('computes edge cases properly (max Emergency expected ~100)', () => {
      // S(100)*0.5 + E(100)*0.3 + W_days(30 => 100)*0.15 + D(100)*0.05
      // 50 + 30 + 15 + 5 = 100
      expect(ScoringEngine.calculateTotalPriority(100, 100, 30, 100)).toBe(100.0);
    });

    it('correctly bounds Wait Time Decays (Days -> %)', () => {
      // S(95)*0.5 + E(100)*0.3 + W_days(10 => 33.333)*0.15 + D(0)
      // 47.5 + 30 + 5.0 = 82.5
      expect(ScoringEngine.calculateTotalPriority(95.0, 100, 10, 0)).toBeCloseTo(82.5, 1);
    });
  });

  // ==========================================
  // Test Case 2.2: The Tie-Breaker Algorithm
  // ==========================================
  describe('Conflict Resolution Hierarchy', () => {
    it('prioritizes Total Score -> Severity -> Wait Time -> FIFO', () => {
      const pBase     = { totalPriorityScore: 80, baseSeverityScore: 50, waitTimeDays:  5, createdAt: "2023-10-01" };
      
      const pTotalWin = { totalPriorityScore: 90, baseSeverityScore: 10, waitTimeDays: 0, createdAt: "2023-10-02" };
      const pSeverWin = { totalPriorityScore: 80, baseSeverityScore: 90, waitTimeDays: 0, createdAt: "2023-10-02" };
      const pWaitWin  = { totalPriorityScore: 80, baseSeverityScore: 50, waitTimeDays: 10, createdAt: "2023-10-02" };
      const pFifoWin  = { totalPriorityScore: 80, baseSeverityScore: 50, waitTimeDays:  5, createdAt: "2023-09-01" };

      // Negative return value implies the first argument wins over the second argument
      expect(ScoringEngine.resolveScheduleConflicts(pTotalWin, pBase)).toBeLessThan(0);
      expect(ScoringEngine.resolveScheduleConflicts(pSeverWin, pBase)).toBeLessThan(0);
      expect(ScoringEngine.resolveScheduleConflicts(pWaitWin,  pBase)).toBeLessThan(0);
      expect(ScoringEngine.resolveScheduleConflicts(pFifoWin,  pBase)).toBeLessThan(0);
      
      // Control check: pBase should lose to pTotalWin
      expect(ScoringEngine.resolveScheduleConflicts(pBase, pTotalWin)).toBeGreaterThan(0);
    });
  });
});
