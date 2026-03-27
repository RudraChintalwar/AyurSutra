/**
 * Sanity-check priority math (no test runner in package.json).
 * Run: npm run verify
 */
import { calculatePriorityScore, bumpAndReschedule, BUMP_EMERGENCY_MIN_SCORE } from "../src/utils/priorityQueue.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const morningIST = "2025-06-15T04:30:00.000Z"; // ~10:00 IST — pitta block start 10
const s1 = calculatePriorityScore({
    severityScore: 10,
    feedbackEscalation: false,
    feedbackMultiplier: 1,
    dosha: "pitta",
    slotDatetime: morningIST,
    createdAt: new Date().toISOString(),
});
assert(s1.totalScore <= 100 && s1.totalScore >= 40, `severity-10 cap: got ${s1.totalScore}`);

const escal = calculatePriorityScore({
    severityScore: 5,
    feedbackEscalation: true,
    feedbackMultiplier: 2.5,
    dosha: "",
    slotDatetime: null,
    createdAt: null,
});
assert(escal.totalScore === 100, `escalation should cap at 100, got ${escal.totalScore}`);

const low = calculatePriorityScore({
    severityScore: 1,
    feedbackEscalation: false,
    dosha: "",
    slotDatetime: null,
    createdAt: null,
});
assert(low.totalScore < 50, `low severity should score under neutral, got ${low.totalScore}`);

const sameDay = [
    { datetime: "2025-06-20T10:00:00.000Z", status: "confirmed", priority: 50, sessionId: "a" },
    { datetime: "2025-06-20T11:00:00.000Z", status: "confirmed", priority: 55, sessionId: "b" },
];
const bump = bumpAndReschedule(
    { datetime: "2025-06-20T10:30:00.000Z", priorityScore: 82, therapy: "X", patientEmail: "e@x.com" },
    sameDay,
    ["2025-06-20T15:00:00.000Z"]
);
assert(bump.bumped === true, "should bump lowest when incoming priority higher");
assert(bump.bumpedSession && bump.insertedSession, "bump shapes");

const noBump = bumpAndReschedule(
    { datetime: "2025-06-20T10:30:00.000Z", priorityScore: 40, therapy: "X" },
    sameDay,
    []
);
assert(noBump.bumped === false, "lower priority should not bump");
assert(typeof BUMP_EMERGENCY_MIN_SCORE === "number" && BUMP_EMERGENCY_MIN_SCORE === 80, "export min score");

console.log("verify-priority: OK", { sampleBreakdown: s1.breakdown, escalTotal: escal.totalScore });
