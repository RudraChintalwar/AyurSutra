/**
 * Session mutations — authoritative writes + slot index + calendar cleanup.
 */
import { admin } from "../middleware/auth.js";
import * as slotBlocks from "../services/slotBlockService.js";
import { removeSessionCalendarEventsFromGoogle } from "../utils/googleCalendarUser.js";
import { sendEmail } from "../routes/notifications.js";
import { rebuildDoctorDayQueue, istDayKeyFromIso } from "../services/doctorDayQueue.js";

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

async function createInAppNotification({ userId, title, body, sender = "system" }) {
    if (!userId) return;
    await db.collection("notifications").add({
        user_id: userId,
        recipient_id: userId,
        recipient_role: "user",
        title,
        body,
        sender,
        sender_role: sender,
        channel: "in-app",
        type: "message",
        read: false,
        datetime: new Date().toISOString(),
    });
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
        const proposedDatetimeRaw = req.body?.proposedDatetime || null;
        const proposedDatetime = proposedDatetimeRaw ? new Date(proposedDatetimeRaw).toISOString() : null;
        const now = new Date().toISOString();

        await ref.update({
            status: "reschedule_requested",
            reschedule_reason: reason,
            proposed_datetime: proposedDatetime,
            reschedule_requested_at: now,
            previous_status_before_reschedule: s.status || "scheduled",
            updated_at: now,
        });

        // Notify assigned doctor when patient requests reschedule
        const doctorId = s.practitioner_id;
        if (doctorId) {
            try {
                const doctorSnap = await db.collection("users").doc(doctorId).get();
                const doctorEmail = doctorSnap.exists ? doctorSnap.data()?.email : null;
                if (doctorEmail) {
                    await sendEmail({
                        to: doctorEmail,
                        subject: `Reschedule Requested — ${s.therapy || "Session"}`,
                        html: `<p>Patient <b>${s.patient_name || "Patient"}</b> requested to reschedule the session.</p>
                               <p><b>Current slot:</b> ${new Date(s.datetime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</p>
                               ${proposedDatetime ? `<p><b>Requested slot:</b> ${new Date(proposedDatetime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</p>` : ""}
                               <p><b>Reason:</b> ${reason}</p>`,
                    });
                }
                await createInAppNotification({
                    userId: doctorId,
                    title: "Reschedule requested",
                    body: `${s.patient_name || "A patient"} requested reschedule for ${s.therapy || "session"}${proposedDatetime ? " with a proposed new time." : "."}`,
                    sender: "patient",
                });
            } catch (notifyErr) {
                console.error("rescheduleRequest notification failed:", notifyErr.message);
            }
        }

        const refreshed = await ref.get();
        res.json({ success: true, session: { id, ...refreshed.data() } });
    } catch (e) {
        console.error("sessions.rescheduleRequest error:", e);
        res.status(500).json({ success: false, error: "Failed to request reschedule" });
    }
}

export async function rescheduleReview(req, res) {
    try {
        const { id } = req.params;
        const role = await userRole(req.firebaseUid);
        const dg = requireDoctor(role);
        if (!dg.ok) return res.status(dg.code).json({ success: false, error: dg.error });

        const ref = db.collection("sessions").doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        const s = snap.data();
        const acc = assertSessionAccess(s, req.firebaseUid, role);
        if (!acc.ok) return res.status(acc.code).json({ success: false, error: acc.error });

        const action = req.body?.action;
        if (!["approved", "rejected"].includes(action)) {
            return res.status(400).json({ success: false, error: "action must be approved or rejected" });
        }
        const reviewNote = req.body?.reviewNote || "";
        const proposed = req.body?.proposedDatetime || s.proposed_datetime || null;
        const SLOT_DURATION_MINUTES = 90;
        const approvedDatetime = action === "approved" && proposed ? new Date(proposed).toISOString() : null;
        const now = new Date().toISOString();

        const oldDatetime = s.datetime || null;
        const patch = {
            reschedule_reviewed_at: now,
            reschedule_reviewed_by: req.firebaseUid,
            reschedule_review_note: reviewNote,
            updated_at: now,
            proposed_datetime: null,
        };
        if (action === "approved") {
            if (!approvedDatetime) {
                return res.status(400).json({ success: false, error: "proposedDatetime is required for approval" });
            }

            // Enforce strict doctor slot grid (IST): 09:00, 10:30, 14:00, 15:30 with 90-min sessions
            // and lunch break from 13:00-14:00. Patients must never be rescheduled into 30-min drift slots.
            const IST_OFFSET_MIN = 330;
            const dateToISTParts = (d) => {
                const parts = new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Asia/Kolkata",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                }).formatToParts(d);
                const get = (t) => parts.find((p) => p.type === t)?.value;
                return {
                    year: Number(get("year")),
                    month: Number(get("month")),
                    day: Number(get("day")),
                    hour: Number(get("hour")),
                    minute: Number(get("minute")),
                };
            };
            const makeUtcIsoFromIstParts = ({ year, month, day, hour, minute }) => {
                const utcMs = Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MIN * 60000;
                return new Date(utcMs).toISOString();
            };
            const isWeekendIST = (iso) => {
                const d = new Date(iso);
                if (Number.isNaN(d.getTime())) return false;
                const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short" }).format(d);
                return weekday === "Sat" || weekday === "Sun";
            };
            const allowedStarts = [
                { hour: 9, minute: 0 },
                { hour: 10, minute: 30 },
                { hour: 12, minute: 0 },
                { hour: 14, minute: 0 },
                { hour: 15, minute: 30 },
            ];
            const normalizeToGrid = (inputIso) => {
                const inMs = new Date(inputIso).getTime();
                if (Number.isNaN(inMs)) return null;
                const inputIst = dateToISTParts(new Date(inMs));

                // Try same IST day first, snapping forward to the next allowed start.
                for (const st of allowedStarts) {
                    const candidate = makeUtcIsoFromIstParts({
                        year: inputIst.year,
                        month: inputIst.month,
                        day: inputIst.day,
                        hour: st.hour,
                        minute: st.minute,
                    });
                    const cMs = new Date(candidate).getTime();
                    if (cMs < inMs) continue;
                    if (isWeekendIST(candidate)) continue;

                    const startMin = st.hour * 60 + st.minute;
                    const endMin = startMin + SLOT_DURATION_MINUTES;
                    const overlapsLunch = startMin < 14 * 60 && endMin > (13 * 60 + 30);
                    const outsideWork = startMin < 9 * 60 || endMin > 18 * 60;
                    if (outsideWork || overlapsLunch) continue;
                    return candidate;
                }

                // Otherwise, roll forward day-by-day up to 14 days.
                for (let add = 1; add <= 14; add++) {
                    const nextDay = new Date(inMs + add * 24 * 60 * 60 * 1000);
                    const ist = dateToISTParts(nextDay);
                    for (const st of allowedStarts) {
                        const candidate = makeUtcIsoFromIstParts({
                            year: ist.year,
                            month: ist.month,
                            day: ist.day,
                            hour: st.hour,
                            minute: st.minute,
                        });
                        if (isWeekendIST(candidate)) continue;
                        return candidate;
                    }
                }
                return null;
            };

            const normalizedApproved = normalizeToGrid(approvedDatetime);
            if (!normalizedApproved) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid approved datetime (must align to 09:00, 10:30, 12:00, 14:00, 15:30 IST grid)",
                });
            }

            // Use normalized grid iso
            patch.datetime = normalizedApproved;
            patch.reschedule_approved = true;
            patch.reschedule_rejected = false;
            patch.status = "confirmed";
            // Clear proposed datetime metadata handled below.
            patch.proposed_datetime = null;

            // Keep oldDatetime tracking; actual patch below uses patch.datetime.
        } else {
            patch.status = s.previous_status_before_reschedule || "scheduled";
            patch.reschedule_approved = false;
            patch.reschedule_rejected = true;
        }
        await ref.update(patch);

        // SINGLE SOURCE OF TRUTH: day queue rebuild (no slotBlocks / no direct slot writes).
        if (action === "approved" && s.practitioner_id && patch.datetime) {
            try {
                const oldDay = oldDatetime ? istDayKeyFromIso(oldDatetime) : "";
                const newDay = istDayKeyFromIso(patch.datetime);
                if (oldDay) {
                    await rebuildDoctorDayQueue(s.practitioner_id, oldDay, [], { maxDays: 60 });
                }
                if (newDay) {
                    await rebuildDoctorDayQueue(
                        s.practitioner_id,
                        newDay,
                        [
                            {
                                sessionId: id,
                                priorityScore: Number(s.totalPriorityScore ?? s.priority) || 50,
                                createdAt: s.created_at || s.createdAt || now,
                            },
                        ],
                        { maxDays: 60 }
                    );
                }
            } catch (qErr) {
                console.error("rescheduleReview rebuildDoctorDayQueue failed:", qErr.message);
            }
        }

        // Notify patient (email + in-app)
        let patientEmail = s.patient_email || null;
        if (!patientEmail && s.patient_id) {
            try {
                const pSnap = await db.collection("users").doc(s.patient_id).get();
                patientEmail = pSnap.exists ? pSnap.data()?.email || pSnap.data()?.patient_email || null : null;
            } catch (e) {
                console.error("rescheduleReview patient lookup failed:", e.message);
            }
        }
        if (patientEmail) {
            try {
                if (action === "approved") {
                    await sendEmail({
                        to: patientEmail,
                        subject: `Reschedule Approved — ${s.therapy || "Session"}`,
                        html: `<p>Your reschedule request was approved.</p>
                               <p><b>New slot:</b> ${new Date(patch.datetime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</p>`,
                    });
                } else {
                    await sendEmail({
                        to: patientEmail,
                        subject: `Reschedule Request Update — ${s.therapy || "Session"}`,
                        html: `<p>Your reschedule request could not be approved.</p>
                               <p><b>Current slot remains:</b> ${new Date(s.datetime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</p>`,
                    });
                }
            } catch (e) {
                console.error("rescheduleReview patient email failed:", e.message);
            }
        }
        await createInAppNotification({
            userId: s.patient_id,
            title: action === "approved" ? "Reschedule approved" : "Reschedule rejected",
            body:
                action === "approved"
                    ? `Your ${s.therapy || "session"} was moved to ${new Date(patch.datetime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}.`
                    : `Your reschedule request for ${s.therapy || "session"} was not approved.`,
            sender: "doctor",
        });

        const refreshed = await ref.get();
        res.json({ success: true, session: { id, ...refreshed.data() } });
    } catch (e) {
        console.error("sessions.rescheduleReview error:", e);
        res.status(500).json({ success: false, error: "Failed to review reschedule request" });
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
