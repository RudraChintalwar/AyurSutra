/**
 * First-class slot occupancy index (doctor + minute bucket).
 * Admin/API writes only; used for audit and future conflict queries.
 * Sessions + appointments remain authoritative; this mirrors confirmed intent.
 */
export const SCHEDULE_SLOT_BLOCKS = "schedule_slot_blocks";

/** @returns {string|null} */
export function blockDocId(doctorId, iso) {
    if (!doctorId || !iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    const minuteKey = Math.floor(t / 60000);
    return `${doctorId}_${minuteKey}`;
}

/** @param {FirebaseFirestore.WriteBatch} batch */
function parseDurationMinutes(durationMinutes) {
    const n = Number(durationMinutes);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
    return null;
}

function occupancyStartIsos(startIso, durationMinutes, stepMinutes = 30) {
    const dur = parseDurationMinutes(durationMinutes);
    if (!startIso || !dur) return [];

    const startMs = new Date(startIso).getTime();
    if (Number.isNaN(startMs)) return [];

    // Occupy from start up to (but not including) end boundary.
    // Example: 90 min covers +0, +30, +60.
    const stepMs = stepMinutes * 60000;
    const count = Math.ceil(dur / stepMinutes);
    const out = [];
    for (let i = 0; i < count; i++) {
        out.push(new Date(startMs + i * stepMs).toISOString());
    }
    return out;
}

export function addDeletesForDoctorSlots(batch, db, doctorId, isos, durationMinutes = null) {
    for (const iso of isos || []) {
        const occStarts = occupancyStartIsos(iso, durationMinutes);
        const toDelete = occStarts.length > 0 ? occStarts : [iso];
        for (const delIso of toDelete) {
            const id = blockDocId(doctorId, delIso);
            if (id) batch.delete(db.collection(SCHEDULE_SLOT_BLOCKS).doc(id));
        }
    }
}

/**
 * @param {FirebaseFirestore.WriteBatch} batch
 * @param {{ doctorId: string, iso: string, appointmentId: string, sessionId: string, patientId: string, priority: number, therapy?: string, durationMinutes?: number, status?: string, updatedAt?: string }} payload
 */
export function addOccupancyWrite(batch, db, payload) {
    const {
        doctorId,
        iso,
        appointmentId,
        sessionId,
        patientId,
        priority,
        therapy,
        durationMinutes = null,
        status = "pending_review",
        updatedAt,
    } = payload;

    const dur =
        parseDurationMinutes(durationMinutes) ??
        (String(therapy || "").includes("Vamana") ? 120 : 90);

    const starts = occupancyStartIsos(iso, dur);
    for (const startIso of starts) {
        const id = blockDocId(doctorId, startIso);
        if (!id) continue;
        batch.set(db.collection(SCHEDULE_SLOT_BLOCKS).doc(id), {
            doctorId,
            startIso,
            appointmentId,
            sessionId,
            patientId: String(patientId),
            priority: Number(priority) || 0,
            therapy: therapy || null,
            durationMinutes: dur,
            status,
            updatedAt: updatedAt || new Date().toISOString(),
        });
    }
}
