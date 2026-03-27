/**
 * Session mutations — authoritative writes + slot index + calendar cleanup.
 */
import { admin } from "../middleware/auth.js";
import * as slotBlocks from "../services/slotBlockService.js";
import { removeSessionCalendarEventsFromGoogle } from "../utils/googleCalendarUser.js";

const db = admin.firestore();

async function userRole(uid) {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (data.role) return data.role;
    const looksDoctor =
        !!data.license ||
        !!data.specialization ||
        !!data.clinicAddress ||
        (Array.isArray(data.supportedTherapies) && data.supportedTherapies.length > 0);
    if (looksDoctor) return "doctor";
    const looksPatient =
        !!data.dosha ||
        !!data.reason_for_visit ||
        (Array.isArray(data.symptoms) && data.symptoms.length > 0) ||
        !!data.llm_recommendation;
    if (looksPatient) return "patient";
    return null;
}

function assertSessionAccess(session, uid, role) {
    if (!session) return { ok: false, code: 404, error: "Session not found" };
    const ownPatient = session.patient_id === uid;
    const ownDoctor = session.practitioner_id === uid;
    if (ownPatient) return { ok: true };
    if (ownDoctor) return { ok: true };
    return { ok: false, code: 403, error: "Forbidden" };
}

function requireDoctor(role) {
    if (role !== "doctor") return { ok: false, code: 403, error: "Doctor only" };
    return { ok: true };
}

function requirePatient(session, uid) {
    if (session.patient_id !== uid) return { ok: false, code: 403, error: "Patient only" };
    return { ok: true };
}

async function loadLegacyCalendarTokens(session) {
    let doctorLegacy = null;
    let patientLegacy = null;
    if (session.practitioner_id) {
        const d = await db.collection("users").doc(session.practitioner_id).get();
        doctorLegacy = d.exists ? d.data()?.googleAccessToken : null;
    }
    if (session.patient_id) {
        const p = await db.collection("users").doc(session.patient_id).get();
        patientLegacy = p.exists ? p.data()?.googleAccessToken : null;
    }
    return { doctorLegacy, patientLegacy };
}

async function clearCalendarIfLinked(session) {
    if (!session?.gcal_event_id_doctor && !session?.gcal_event_id_patient) return;
    const { doctorLegacy, patientLegacy } = await loadLegacyCalendarTokens(session);
    await removeSessionCalendarEventsFromGoogle(session, {
        doctorLegacyToken: doctorLegacy,
        patientLegacyToken: patientLegacy,
    });
}

async function deleteSlotBlockForSession(session) {
    const doctorId = session.practitioner_id;
    const iso = session.datetime || session.scheduled_date;
    if (!doctorId || !iso) return;
    const durationMinutes =
        Number(session.duration_minutes ?? session.durationMinutes) ||
        (String(session.therapy || "").includes("Vamana") ? 120 : 90);
    const batch = db.batch();
    slotBlocks.addDeletesForDoctorSlots(batch, db, doctorId, [iso], durationMinutes);
    await batch.commit();
}

export async function complete(req, res) {
    try {
        const { id } = req.params;
        const role = await userRole(req.firebaseUid);
        const gate = requireDoctor(role);
        if (!gate.ok) return res.status(gate.code).json({ success: false, error: gate.error });

        const ref = db.collection("sessions").doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        const s = snap.data();
        const acc = assertSessionAccess(s, req.firebaseUid, role);
        if (!acc.ok) return res.status(acc.code).json({ success: false, error: acc.error });

        const doctorNotes = (req.body?.doctorNotes ?? "").trim();
        const now = new Date().toISOString();

        await clearCalendarIfLinked(s);
        await deleteSlotBlockForSession(s);

        await ref.update({
            status: "completed",
            completed_at: now,
            doctor_notes: doctorNotes,
            completed_by: req.firebaseUid,
            gcal_event_id_doctor: null,
            gcal_event_id_patient: null,
            gcal_html_link_doctor: null,
            gcal_html_link_patient: null,
            updated_at: now,
        });

        const refreshed = await ref.get();
        res.json({ success: true, session: { id, ...refreshed.data() } });
    } catch (e) {
        console.error("sessions.complete error:", e);
        res.status(500).json({ success: false, error: "Failed to complete session" });
    }
}

export async function cancel(req, res) {
    try {
        const { id } = req.params;
        const role = await userRole(req.firebaseUid);
        const ref = db.collection("sessions").doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        const s = snap.data();
        const acc = assertSessionAccess(s, req.firebaseUid, role);
        if (!acc.ok) return res.status(acc.code).json({ success: false, error: acc.error });

        const cancelReason =
            req.body?.cancelReason ||
            (role === "doctor" ? "Cancelled by doctor" : "Cancelled by patient");
        const now = new Date().toISOString();

        await clearCalendarIfLinked(s);
        await deleteSlotBlockForSession(s);

        await ref.update({
            status: "cancelled",
            cancelled_at: now,
            cancelled_by: req.firebaseUid,
            cancel_reason: cancelReason,
            gcal_event_id_doctor: null,
            gcal_event_id_patient: null,
            gcal_html_link_doctor: null,
            gcal_html_link_patient: null,
            updated_at: now,
        });

        const refreshed = await ref.get();
        res.json({ success: true, session: { id, ...refreshed.data() } });
    } catch (e) {
        console.error("sessions.cancel error:", e);
        res.status(500).json({ success: false, error: "Failed to cancel session" });
    }
}

export async function rescheduleRequest(req, res) {
    try {
        const { id } = req.params;
        const role = await userRole(req.firebaseUid);
        const ref = db.collection("sessions").doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        const s = snap.data();
        const acc = assertSessionAccess(s, req.firebaseUid, role);
        if (!acc.ok) return res.status(acc.code).json({ success: false, error: acc.error });

        const pg = requirePatient(s, req.firebaseUid);
        if (!pg.ok) return res.status(pg.code).json({ success: false, error: pg.error });

        const reason =
            req.body?.rescheduleReason || "Patient requested to reschedule this session";
        const now = new Date().toISOString();

        await ref.update({
            status: "reschedule_requested",
            reschedule_reason: reason,
            updated_at: now,
        });

        const refreshed = await ref.get();
        res.json({ success: true, session: { id, ...refreshed.data() } });
    } catch (e) {
        console.error("sessions.rescheduleRequest error:", e);
        res.status(500).json({ success: false, error: "Failed to request reschedule" });
    }
}

const FEEDBACK_MERGE_KEYS = new Set([
    "feedback",
    "feedback_submitted_at",
    "feedback_escalation",
    "feedback_multiplier",
    "severity_score",
    "totalPriorityScore",
    "priority",
    "escalation_reason",
    "escalated_at",
]);

export async function patientFeedback(req, res) {
    try {
        const { id } = req.params;
        const role = await userRole(req.firebaseUid);
        const ref = db.collection("sessions").doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        const s = snap.data();
        const acc = assertSessionAccess(s, req.firebaseUid, role);
        if (!acc.ok) return res.status(acc.code).json({ success: false, error: acc.error });

        const pg = requirePatient(s, req.firebaseUid);
        if (!pg.ok) return res.status(pg.code).json({ success: false, error: pg.error });

        const patch = {};
        const body = req.body || {};
        for (const k of FEEDBACK_MERGE_KEYS) {
            if (body[k] !== undefined) patch[k] = body[k];
        }
        if (body.sessionUpdate && typeof body.sessionUpdate === "object") {
            for (const [k, v] of Object.entries(body.sessionUpdate)) {
                if (FEEDBACK_MERGE_KEYS.has(k)) patch[k] = v;
            }
        }

        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ success: false, error: "No allowed feedback fields" });
        }
        patch.updated_at = new Date().toISOString();

        await ref.update(patch);
        const refreshed = await ref.get();
        res.json({ success: true, session: { id, ...refreshed.data() } });
    } catch (e) {
        console.error("sessions.patientFeedback error:", e);
        res.status(500).json({ success: false, error: "Failed to save feedback" });
    }
}

export async function removeSession(req, res) {
    try {
        const { id } = req.params;
        const role = await userRole(req.firebaseUid);
        const gate = requireDoctor(role);
        if (!gate.ok) return res.status(gate.code).json({ success: false, error: gate.error });

        const ref = db.collection("sessions").doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        const s = snap.data();
        const acc = assertSessionAccess(s, req.firebaseUid, role);
        if (!acc.ok) return res.status(acc.code).json({ success: false, error: acc.error });

        await clearCalendarIfLinked(s);
        await deleteSlotBlockForSession(s);
        await ref.delete();

        res.json({ success: true, deletedId: id });
    } catch (e) {
        console.error("sessions.removeSession error:", e);
        res.status(500).json({ success: false, error: "Failed to delete session" });
    }
}
