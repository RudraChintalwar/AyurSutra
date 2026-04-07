import { admin } from "../middleware/auth.js";

const db = admin.firestore();

const IST_TZ = "Asia/Kolkata";
const IST_OFFSET_MIN = 330;

// Fixed canonical slot grid (90 minutes, 09:00–18:00, lunch 13:30–14:00 IST)
const CANONICAL_SLOTS_IST = [
    { hour: 9, minute: 0 },
    { hour: 10, minute: 30 },
    { hour: 12, minute: 0 },
    { hour: 14, minute: 0 },
    { hour: 15, minute: 30 },
];

function dateToISTDayKey(d) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: IST_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}

export function istDayKeyFromIso(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return dateToISTDayKey(d);
}

function makeUtcIsoFromIstParts({ year, month, day, hour, minute }) {
    const utcMs = Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MIN * 60000;
    return new Date(utcMs).toISOString();
}

function istPartsFromDayKey(dayKey) {
    const [y, m, d] = String(dayKey || "").split("-").map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return { year: y, month: m, day: d };
}

function canonicalSlotIsosForDayKey(dayKey) {
    const parts = istPartsFromDayKey(dayKey);
    if (!parts) return [];
    return CANONICAL_SLOTS_IST.map((st) =>
        makeUtcIsoFromIstParts({
            year: parts.year,
            month: parts.month,
            day: parts.day,
            hour: st.hour,
            minute: st.minute,
        })
    );
}

function istDayUtcRange(dayKey) {
    const parts = istPartsFromDayKey(dayKey);
    if (!parts) return null;
    // Start of IST day => UTC = IST - 5:30
    const start = makeUtcIsoFromIstParts({
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: 0,
        minute: 0,
    });
    // End of IST day (23:59:59.999 IST) -> compute via next day 00:00 minus 1ms
    const next = makeUtcIsoFromIstParts({
        year: parts.year,
        month: parts.month,
        day: parts.day + 1,
        hour: 0,
        minute: 0,
    });
    const endMs = new Date(next).getTime() - 1;
    return { startIso: start, endIso: new Date(endMs).toISOString() };
}

function nextIstDayKey(dayKey) {
    // Use UTC noon to avoid DST issues (IST has no DST anyway).
    const parts = istPartsFromDayKey(dayKey);
    if (!parts) return "";
    const noonUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
    return dateToISTDayKey(new Date(noonUtc + 24 * 60 * 60 * 1000));
}

function isBlockingSessionDoc(s) {
    if (!s) return false;
    if (!s.datetime) return false;
    const status = String(s.status || "").toLowerCase();
    if (["cancelled", "completed", "rejected"].includes(status)) return false;
    return true;
}

function toPriorityNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 50;
}

/**
 * Single deterministic scheduler — PRIORITY QUEUE PER DAY.
 *
 * Rules:
 * - Fetch all blocking sessions for doctor+day.
 * - Merge with incomingEntries.
 * - Sort priority DESC, createdAt ASC.
 * - Assign canonical slots (09:00,10:30,12:00,14:00,15:30 IST).
 * - Overflow carries to next day internally.
 *
 * STRICT OWNERSHIP:
 * - Existing sessions are UPDATED (never duplicated).
 * - New sessions are created once.
 *
 * @param {string} doctorId
 * @param {string} dayKeyIST "YYYY-MM-DD" in Asia/Kolkata
 * @param {Array<{sessionId?: string|null, appointmentId?: string|null, baseDoc?: object, priorityScore: number, createdAt?: string|null}>} incomingEntries
 * @param {{ maxDays?: number }} opts
 */
export async function rebuildDoctorDayQueue(doctorId, dayKeyIST, incomingEntries = [], opts = {}) {
    const maxDays = Math.max(1, Number(opts.maxDays) || 60);
    if (!doctorId) {
        const err = new Error("doctorId required");
        err.statusCode = 400;
        throw err;
    }
    if (!dayKeyIST) {
        const err = new Error("dayKeyIST required");
        err.statusCode = 400;
        throw err;
    }

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    // Normalize incoming entries shape.
    const carry = (incomingEntries || []).map((e) => ({
        sessionId: e?.sessionId || null,
        appointmentId: e?.appointmentId || null,
        baseDoc: e?.baseDoc || null, // required for new sessions
        priorityScore: toPriorityNumber(e?.priorityScore),
        createdAtMs: e?.createdAt ? new Date(e.createdAt).getTime() : nowMs,
    }));

    /** @type {Array<{sessionId: string, oldDatetime: string|null, newDatetime: string, dayKeyIST: string, slot_index: number}>} */
    const changed = [];
    /** @type {string[]} */
    const createdSessionIds = [];

    await db.runTransaction(async (tx) => {
        let currentDayKey = dayKeyIST;
        /** @type {Array<any>} */
        let currentCarry = carry;

        for (let step = 0; step < maxDays && currentCarry.length > 0; step++) {
            // Query existing sessions for the doctor (single-field query avoids composite index requirements).
            // Filter down to current IST day in-memory.
            const q = db.collection("sessions").where("practitioner_id", "==", doctorId);
            const snap = await tx.get(q);
            const existing = [];
            snap.forEach((doc) => {
                const s = doc.data() || {};
                if (!isBlockingSessionDoc(s)) return;
                // Guard: only include sessions that are actually on this IST day.
                if (istDayKeyFromIso(s.datetime) !== currentDayKey) return;
                const createdAt = s.created_at || s.createdAt || s.datetime || nowIso;
                existing.push({
                    sessionId: doc.id,
                    ref: doc.ref,
                    appointmentId: s.appointment_id || null,
                    priorityScore: toPriorityNumber(s.totalPriorityScore ?? s.priority),
                    createdAtMs: new Date(createdAt).getTime(),
                    oldDatetime: s.datetime || null,
                    baseDoc: null,
                });
            });

            // Merge (existing + carry that is trying to be scheduled now)
            const entries = existing.concat(currentCarry);

            // Sort by priority DESC, createdAt ASC.
            entries.sort((a, b) => {
                if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
                return (a.createdAtMs || 0) - (b.createdAtMs || 0);
            });

            const slots = canonicalSlotIsosForDayKey(currentDayKey);
            if (slots.length === 0) {
                const err = new Error("No canonical slots for dayKeyIST");
                err.statusCode = 400;
                throw err;
            }

            const nextCarry = [];

            for (let i = 0; i < entries.length; i++) {
                const e = entries[i];
                if (i < slots.length) {
                    const newDatetime = slots[i];
                    const slot_index = i;

                    if (e.sessionId) {
                        const ref = e.ref || db.collection("sessions").doc(e.sessionId);
                        const oldDatetime = e.oldDatetime || null;
                        const patch = {
                            datetime: newDatetime,
                            ist_day_key: currentDayKey,
                            slot_index,
                            priorityScoreSnapshot: e.priorityScore,
                            totalPriorityScore: e.priorityScore,
                            priority: e.priorityScore,
                            updated_at: nowIso,
                        };
                        if (oldDatetime && oldDatetime !== newDatetime) {
                            patch.auto_rescheduled = true;
                            patch.auto_rescheduled_from = oldDatetime;
                            patch.auto_rescheduled_at = nowIso;
                        }
                        tx.update(ref, patch);
                        if (!oldDatetime || oldDatetime !== newDatetime) {
                            changed.push({ sessionId: e.sessionId, oldDatetime, newDatetime, dayKeyIST: currentDayKey, slot_index });
                        }
                    } else {
                        // New session must have baseDoc.
                        if (!e.baseDoc || typeof e.baseDoc !== "object") {
                            const err = new Error("baseDoc required for new session creation");
                            err.statusCode = 400;
                            throw err;
                        }
                        const ref = db.collection("sessions").doc();
                        createdSessionIds.push(ref.id);
                        tx.set(ref, {
                            ...e.baseDoc,
                            practitioner_id: doctorId,
                            appointment_id: e.appointmentId || e.baseDoc.appointment_id || null,
                            datetime: newDatetime,
                            ist_day_key: currentDayKey,
                            slot_index,
                            priorityScoreSnapshot: e.priorityScore,
                            totalPriorityScore: e.priorityScore,
                            priority: e.priorityScore,
                            duration_minutes: 90,
                            created_at: e.baseDoc.created_at || nowIso,
                            updated_at: nowIso,
                        });
                        changed.push({ sessionId: ref.id, oldDatetime: null, newDatetime, dayKeyIST: currentDayKey, slot_index });
                    }
                } else {
                    // Overflow moves to next day internally (same session doc, no duplicates).
                    nextCarry.push({
                        sessionId: e.sessionId || null,
                        appointmentId: e.appointmentId || null,
                        baseDoc: e.baseDoc || null,
                        priorityScore: e.priorityScore,
                        createdAtMs: e.createdAtMs || nowMs,
                        // preserve oldDatetime for change detection when we eventually assign
                        oldDatetime: e.oldDatetime || null,
                        ref: e.ref,
                    });
                }
            }

            currentCarry = nextCarry.map((x) => ({
                sessionId: x.sessionId,
                appointmentId: x.appointmentId,
                baseDoc: x.baseDoc,
                priorityScore: x.priorityScore,
                createdAtMs: x.createdAtMs,
                oldDatetime: x.oldDatetime || null,
                ref: x.ref,
            }));

            if (currentCarry.length > 0) {
                currentDayKey = nextIstDayKey(currentDayKey);
            }
        }

        if (currentCarry.length > 0) {
            const err = new Error("No slots available within scheduling horizon");
            err.statusCode = 409;
            throw err;
        }
    });

    return { changed, createdSessionIds };
}

