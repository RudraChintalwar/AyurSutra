import ScoringEngine from '../src/utils/ScoringEngine.js';
import fs from 'fs';

async function runTests() {
  const results = [];
  try {
    let passCount = 0;
    let failCount = 0;

    const assert = (condition, message) => {
        results.push({ message, condition });
        if (condition) passCount++;
        else failCount++;
    };

    // TEST SUITE 1: ML Priority Engine Equations
    const score1 = ScoringEngine.calculateTotalPriority(50.0, 0, 0, 0);
    assert(score1 === 25.0, `Baseline calculation (50S * 0.5) is 25.0 (Got ${score1})`);

    const score2 = ScoringEngine.calculateTotalPriority(88.4, 0, 0, 100);
    assert(Math.abs(score2 - 49.2) < 0.01, `High severity + Dosha is 49.2 (Got ${score2})`);

    const score3 = ScoringEngine.calculateTotalPriority(95.0, 100, 10, 0);
    assert(Math.abs(score3 - 82.5) < 0.01, `Emergency Escalation is 82.5 (Got ${score3})`);

    // TEST SUITE 2: Tie-Breaker Resolution
    const p1 = { totalPriorityScore: 85.5, baseSeverityScore: 50, waitTimeDays: 5, createdAt: "2023-10-01T10:00:00Z" };
    const p2_wins_on_total = { totalPriorityScore: 90.0, baseSeverityScore: 10, waitTimeDays: 0, createdAt: "2023-10-02T10:00:00Z" };
    const p3_tie_wins_severity = { totalPriorityScore: 85.5, baseSeverityScore: 80, waitTimeDays: 0, createdAt: "2023-10-02T10:00:00Z" };
    const p4_tie_wins_wait = { totalPriorityScore: 85.5, baseSeverityScore: 50, waitTimeDays: 10, createdAt: "2023-10-02T10:00:00Z" };
    const p5_tie_wins_fifo = { totalPriorityScore: 85.5, baseSeverityScore: 50, waitTimeDays: 5, createdAt: "2023-09-01T10:00:00Z" };

    assert(ScoringEngine.resolveScheduleConflicts(p2_wins_on_total, p1) < 0, "Tie breaker correctly favors higher Total Score");
    assert(ScoringEngine.resolveScheduleConflicts(p3_tie_wins_severity, p1) < 0, "Tie breaker correctly favors higher Base ML Severity when Total is tied");
    assert(ScoringEngine.resolveScheduleConflicts(p4_tie_wins_wait, p1) < 0, "Tie breaker correctly favors cumulative Wait Time when Severity is tied");
    assert(ScoringEngine.resolveScheduleConflicts(p5_tie_wins_fifo, p1) < 0, "Tie breaker correctly favors older FIFO timestamps");
    
    fs.writeFileSync('test_results.json', JSON.stringify({ passCount, failCount, results }, null, 2));
    if (failCount > 0) process.exit(1);
  } catch (e) {
    fs.writeFileSync('test_results.json', JSON.stringify({ error: e.toString(), stack: e.stack }));
    process.exit(1);
  }
}


runTests();
