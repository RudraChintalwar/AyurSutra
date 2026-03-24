/**
 * AyurSutra — Priority Queue System
 *
 * Max-Heap priority queue with weighted scoring:
 *   40% Base Severity (from RF Classifier)
 *   35% Feedback / Escalation Factor
 *   15% Dosha Time-Block Matching
 *   10% Wait-Time Decay
 *
 * ISSUE D FIXED:
 *   bumpAndReschedule was filtering sameDaySessions by status === "scheduled".
 *   After the approval workflow, real sessions have status "confirmed" or
 *   "pending_review". The filter was always empty, so bumps never fired.
 *   Fixed to include all active statuses.
 */

// ─── Max-Heap Data Structure ─────────────────────────────────────────────────
export class MaxHeap {
    constructor() {
        this.heap = [];
    }

    _parent(i) { return Math.floor((i - 1) / 2); }
    _left(i)   { return 2 * i + 1; }
    _right(i)  { return 2 * i + 2; }

    _swap(i, j) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }

    _heapifyUp(i) {
        while (i > 0 && this.heap[i].priorityScore > this.heap[this._parent(i)].priorityScore) {
            this._swap(i, this._parent(i));
            i = this._parent(i);
        }
    }

    _heapifyDown(i) {
        const n = this.heap.length;
        let largest = i;
        const l = this._left(i);
        const r = this._right(i);
        if (l < n && this.heap[l].priorityScore > this.heap[largest].priorityScore) largest = l;
        if (r < n && this.heap[r].priorityScore > this.heap[largest].priorityScore) largest = r;
        if (largest !== i) {
            this._swap(i, largest);
            this._heapifyDown(largest);
        }
    }

    insert(item) {
        this.heap.push(item);
        this._heapifyUp(this.heap.length - 1);
    }

    extractMax() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();
        const max = this.heap[0];
        this.heap[0] = this.heap.pop();
        this._heapifyDown(0);
        return max;
    }

    peek()  { return this.heap.length > 0 ? this.heap[0] : null; }
    size()  { return this.heap.length; }

    toSortedArray() {
        return [...this.heap].sort((a, b) => b.priorityScore - a.priorityScore);
    }

    findMin() {
        if (this.heap.length === 0) return null;
        let min = this.heap[0];
        for (const item of this.heap) {
            if (item.priorityScore < min.priorityScore) min = item;
        }
        return min;
    }

    removeById(sessionId) {
        const idx = this.heap.findIndex((item) => item.sessionId === sessionId);
        if (idx === -1) return null;
        const removed = this.heap[idx];
        this.heap[idx] = this.heap[this.heap.length - 1];
        this.heap.pop();
        if (idx < this.heap.length) {
            this._heapifyDown(idx);
            this._heapifyUp(idx);
        }
        return removed;
    }
}

// ─── Dosha Time-Block Optimization ───────────────────────────────────────────
// Kapha: 6 AM – 10 AM | Pitta: 10 AM – 2 PM | Vata: 2 PM – 6 PM
const DOSHA_TIME_BLOCKS = {
    kapha: { start: 6,  end: 10, label: "6 AM – 10 AM (Morning)" },
    pitta: { start: 10, end: 14, label: "10 AM – 2 PM (Midday)"  },
    vata:  { start: 14, end: 18, label: "2 PM – 6 PM (Afternoon)" },
};

function getDoshaTimeBonus(dosha, slotDatetime) {
    if (!dosha || !slotDatetime) return 0;
    const doshaLower = dosha.toLowerCase();
    const hour = new Date(slotDatetime).getHours();
    for (const [doshaType, block] of Object.entries(DOSHA_TIME_BLOCKS)) {
        if (doshaLower.includes(doshaType) && hour >= block.start && hour < block.end) {
            return 100; // Full bonus — weighted at 15% in the formula
        }
    }
    return 0;
}

// ─── Wait-Time Decay Calculation ─────────────────────────────────────────────
// +2 raw points per 24 hours waiting, capped at 20.
// In the formula: waitDecay * 0.1 * 5 → max 10 points (10% of total)
function getWaitTimeDecay(createdAt) {
    if (!createdAt) return 0;
    const hoursWaiting = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    const daysWaiting  = hoursWaiting / 24;
    return Math.min(Math.round(daysWaiting * 2), 20);
}

// ─── Canonical Priority Score Calculator ─────────────────────────────────────
// Weights: 40% severity + 35% feedback + 15% dosha-time + 10% wait-decay
// This is the SINGLE source of truth. Do not use ScoringEngine.js (deprecated).
export function calculatePriorityScore({
    severityScore    = 5,    // 1–10 from RF Classifier or symptom sliders
    feedbackEscalation = false,
    feedbackMultiplier = 1.0, // 1.0 normal | 2.5 adverse side effects
    dosha            = "",
    slotDatetime     = null,
    createdAt        = null,
}) {
    // 40%: severity (1-10 scaled to 0-100)
    const baseSeverity = Math.min(severityScore * 10, 100) * 0.4;

    // 35%: feedback / escalation
    // Neutral baseline = 50*0.35 = 17.5 (deliberate — escalation jumps this to >87)
    const feedbackScore = feedbackEscalation
        ? 100 * feedbackMultiplier * 0.35
        : 50 * 0.35;

    // 15%: dosha time-block match
    const doshaBonus = getDoshaTimeBonus(dosha, slotDatetime) * 0.15;

    // 10%: wait-time decay (raw 0–20, scaled to 0–10 final contribution)
    const waitDecay = getWaitTimeDecay(createdAt) * 0.1 * 5;

    const totalScore = Math.round(baseSeverity + feedbackScore + doshaBonus + waitDecay);

    return {
        totalScore: Math.min(totalScore, 100),
        breakdown: {
            baseSeverity:  Math.round(baseSeverity  * 10) / 10,
            feedbackScore: Math.round(feedbackScore * 10) / 10,
            doshaBonus:    Math.round(doshaBonus    * 10) / 10,
            waitDecay:     Math.round(waitDecay     * 10) / 10,
        },
    };
}

// ─── Bump & Reschedule ────────────────────────────────────────────────────────
// If a high-priority patient (score > 85) needs a slot and the clinic is full:
//   1. Find the lowest-priority confirmed session on the same day
//   2. Move it to the next available slot
//   3. Return both affected sessions so callers can write to Firestore
export function bumpAndReschedule(highPrioritySession, scheduledSessions, availableSlots = []) {
    if (highPrioritySession.priorityScore <= 85) {
        return { bumped: false, reason: "Priority score not high enough for bump (needs >85)" };
    }

    const targetDate = new Date(highPrioritySession.datetime).toDateString();

    // ─── ISSUE D FIX: include all active statuses, not just 'scheduled' ─────
    // Before: status === "scheduled" — never matched real approved sessions
    // After:  any non-terminal status can be bumped
    const BUMPABLE_STATUSES = new Set(['confirmed', 'scheduled', 'pending_review']);
    const sameDaySessions = scheduledSessions.filter(s =>
        new Date(s.datetime).toDateString() === targetDate &&
        BUMPABLE_STATUSES.has(s.status)
    );

    if (sameDaySessions.length === 0) {
        return { bumped: false, reason: "No bumpable sessions found on that day" };
    }

    // Find the lowest-priority session
    let lowestPriority = sameDaySessions[0];
    for (const session of sameDaySessions) {
        const score = session.totalPriorityScore ?? session.priorityScore ?? session.priority ?? 50;
        const lowest = lowestPriority.totalPriorityScore ?? lowestPriority.priorityScore ?? lowestPriority.priority ?? 50;
        if (score < lowest) lowestPriority = session;
    }

    const lowestScore = lowestPriority.totalPriorityScore ?? lowestPriority.priorityScore ?? lowestPriority.priority ?? 50;
    if (highPrioritySession.priorityScore <= lowestScore) {
        return { bumped: false, reason: "High-priority session is not higher than any existing session" };
    }

    // Find the next available slot after the requested time
    const nextSlot = availableSlots.find(slot =>
        new Date(slot) > new Date(highPrioritySession.datetime)
    );

    return {
        bumped: true,
        bumpedSession: {
            ...lowestPriority,
            newDatetime: nextSlot || null,
            reason: `Rescheduled — higher-priority patient (Score: ${highPrioritySession.priorityScore})`,
        },
        insertedSession: {
            ...highPrioritySession,
            datetime: lowestPriority.datetime, // Takes the freed slot
        },
    };
}

// ─── Build Max-Heap from a sessions array ─────────────────────────────────────
export function buildPriorityQueue(sessions, patients = []) {
    const heap = new MaxHeap();

    for (const session of sessions) {
        const patient = patients.find(
            p => p.id === session.patient_id || p.uid === session.patient_id
        );

        const { totalScore, breakdown } = calculatePriorityScore({
            severityScore:      session.severity_score      || patient?.severity_score      || 5,
            feedbackEscalation: session.feedback_escalation || false,
            feedbackMultiplier: session.feedback_escalation ? (session.feedback_multiplier || 2.5) : 1.0,
            dosha:              patient?.dosha || session.dosha || "",
            slotDatetime:       session.datetime,
            createdAt:          session.created_at || session.createdAt,
        });

        heap.insert({
            sessionId:     session.id,
            patientId:     session.patient_id,
            patientName:   session.patient_name || patient?.name || "Unknown",
            therapy:       session.therapy,
            datetime:      session.datetime,
            status:        session.status,
            priorityScore: totalScore,
            breakdown,
            dosha:         patient?.dosha || session.dosha || "",
        });
    }

    return heap;
}
