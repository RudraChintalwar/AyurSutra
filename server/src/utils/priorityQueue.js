/**
 * AyurSutra — Priority Queue System
 *
 * Max-Heap priority queue with weighted scoring:
 *   40% Base Severity (from RF Classifier)
 *   35% Feedback / Escalation Factor
 *   15% Dosha Time-Block Matching
 *   10% Wait-Time Decay
 *
 * Also includes a "bump" function for high-priority rescheduling.
 */

// ─── Max-Heap Data Structure ─────────────────────────────
export class MaxHeap {
    constructor() {
        this.heap = [];
    }

    _parent(i) {
        return Math.floor((i - 1) / 2);
    }
    _left(i) {
        return 2 * i + 1;
    }
    _right(i) {
        return 2 * i + 2;
    }

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

        if (l < n && this.heap[l].priorityScore > this.heap[largest].priorityScore) {
            largest = l;
        }
        if (r < n && this.heap[r].priorityScore > this.heap[largest].priorityScore) {
            largest = r;
        }
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

    peek() {
        return this.heap.length > 0 ? this.heap[0] : null;
    }

    size() {
        return this.heap.length;
    }

    // Get all items sorted by priority (descending)
    toSortedArray() {
        return [...this.heap].sort((a, b) => b.priorityScore - a.priorityScore);
    }

    // Find the item with the lowest priority
    findMin() {
        if (this.heap.length === 0) return null;
        let min = this.heap[0];
        for (const item of this.heap) {
            if (item.priorityScore < min.priorityScore) min = item;
        }
        return min;
    }

    // Remove a specific item by session ID
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

// ─── Dosha Time-Block Optimization ───────────────────────
// Kapha: 6 AM – 10 AM (morning)
// Pitta: 10 AM – 2 PM (midday)
// Vata: 2 PM – 6 PM (afternoon)
const DOSHA_TIME_BLOCKS = {
    kapha: { start: 6, end: 10, label: "6 AM – 10 AM (Morning)" },
    pitta: { start: 10, end: 14, label: "10 AM – 2 PM (Midday)" },
    vata: { start: 14, end: 18, label: "2 PM – 6 PM (Afternoon)" },
};

function getDoshaTimeBonus(dosha, slotDatetime) {
    if (!dosha || !slotDatetime) return 0;
    const doshaLower = dosha.toLowerCase();
    const hour = new Date(slotDatetime).getHours();

    for (const [doshaType, block] of Object.entries(DOSHA_TIME_BLOCKS)) {
        if (doshaLower.includes(doshaType) && hour >= block.start && hour < block.end) {
            return 100; // Full bonus (will be weighted at 15%)
        }
    }
    return 0; // No match
}

// ─── Wait-Time Decay Calculation ─────────────────────────
// +2 points per 24 hours unscheduled (max 20 points)
function getWaitTimeDecay(createdAt) {
    if (!createdAt) return 0;
    const hoursWaiting = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    const daysWaiting = hoursWaiting / 24;
    return Math.min(Math.round(daysWaiting * 2), 20); // Cap at 20
}

// ─── Weighted Priority Score Calculator ──────────────────
// 40% severity + 35% feedback + 15% dosha-time + 10% wait-decay
export function calculatePriorityScore({
    severityScore = 5, // 1-10 from RF Classifier
    feedbackEscalation = false, // true if adverse side effects
    feedbackMultiplier = 1.0, // 1.0 normal, 2.5 for adverse
    dosha = "",
    slotDatetime = null,
    createdAt = null,
}) {
    // Base Severity: scale 1-10 → 0-100, weight 40%
    const baseSeverity = Math.min(severityScore * 10, 100) * 0.4;

    // Feedback/Escalation: weight 35%
    let feedbackScore;
    if (feedbackEscalation) {
        feedbackScore = 100 * feedbackMultiplier * 0.35; // Massive boost
    } else {
        feedbackScore = 50 * 0.35; // Neutral baseline
    }

    // Dosha Time-Block: weight 15%
    const doshaBonus = getDoshaTimeBonus(dosha, slotDatetime) * 0.15;

    // Wait-Time Decay: weight 10%
    const waitDecay = getWaitTimeDecay(createdAt) * 0.1 * 5; // Scale up for impact

    const totalScore = Math.round(baseSeverity + feedbackScore + doshaBonus + waitDecay);

    return {
        totalScore: Math.min(totalScore, 100),
        breakdown: {
            baseSeverity: Math.round(baseSeverity * 10) / 10,
            feedbackScore: Math.round(feedbackScore * 10) / 10,
            doshaBonus: Math.round(doshaBonus * 10) / 10,
            waitDecay: Math.round(waitDecay * 10) / 10,
        },
    };
}

// ─── Bump & Reschedule Function ──────────────────────────
// If a high-priority patient (>85) needs a slot and clinic is full:
// 1. Find the lowest-priority patient on that day
// 2. Reassign them to next available day
// 3. Return both affected sessions
export function bumpAndReschedule(highPrioritySession, scheduledSessions, availableSlots = []) {
    if (highPrioritySession.priorityScore <= 85) {
        return { bumped: false, reason: "Priority score not high enough for bump (needs >85)" };
    }

    // Find sessions on the same day
    const targetDate = new Date(highPrioritySession.datetime).toDateString();
    const sameDaySessions = scheduledSessions.filter(
        (s) => new Date(s.datetime).toDateString() === targetDate && s.status === "scheduled"
    );

    if (sameDaySessions.length === 0) {
        return { bumped: false, reason: "No sessions to bump on that day" };
    }

    // Find the lowest-priority session on that day
    let lowestPriority = sameDaySessions[0];
    for (const session of sameDaySessions) {
        if ((session.priorityScore || session.priority || 50) < (lowestPriority.priorityScore || lowestPriority.priority || 50)) {
            lowestPriority = session;
        }
    }

    // Only bump if high-priority is actually higher
    if (highPrioritySession.priorityScore <= (lowestPriority.priorityScore || lowestPriority.priority || 50)) {
        return { bumped: false, reason: "High-priority session is not higher than any existing session" };
    }

    // Find the next available slot for the bumped patient
    const nextSlot = availableSlots.find((slot) => {
        const slotDate = new Date(slot);
        return slotDate > new Date(highPrioritySession.datetime);
    });

    return {
        bumped: true,
        bumpedSession: {
            ...lowestPriority,
            newDatetime: nextSlot || null,
            reason: `Rescheduled due to higher-priority patient (Score: ${highPrioritySession.priorityScore})`,
        },
        insertedSession: {
            ...highPrioritySession,
            datetime: lowestPriority.datetime, // Takes the bumped slot
        },
    };
}

// ─── Build Max-Heap from sessions array ──────────────────
export function buildPriorityQueue(sessions, patients = []) {
    const heap = new MaxHeap();

    for (const session of sessions) {
        const patient = patients.find(
            (p) => p.id === session.patient_id || p.uid === session.patient_id
        );

        const { totalScore, breakdown } = calculatePriorityScore({
            severityScore: session.severity_score || patient?.severity_score || 5,
            feedbackEscalation: session.feedback_escalation || false,
            feedbackMultiplier: session.feedback_escalation ? 2.5 : 1.0,
            dosha: patient?.dosha || session.dosha || "",
            slotDatetime: session.datetime,
            createdAt: session.created_at,
        });

        heap.insert({
            sessionId: session.id,
            patientId: session.patient_id,
            patientName: session.patient_name || patient?.name || "Unknown",
            therapy: session.therapy,
            datetime: session.datetime,
            status: session.status,
            priorityScore: totalScore,
            breakdown,
            dosha: patient?.dosha || "",
        });
    }

    return heap;
}
