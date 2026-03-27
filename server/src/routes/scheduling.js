import express from "express";
import Groq from "groq-sdk";
import { calculatePriorityScore, buildPriorityQueue, bumpAndReschedule, MaxHeap, BUMP_EMERGENCY_MIN_SCORE } from "../utils/priorityQueue.js";
import { sendEmail } from "./notifications.js";
import { admin } from "../middleware/auth.js";
import * as slotBlocks from "../services/slotBlockService.js";
import {
    insertAyurSutraCalendarEventForUser,
    insertAyurSutraCalendarEventWithAccessToken,
    removeSessionCalendarEventsFromGoogle,
} from "../utils/googleCalendarUser.js";
import { verifyFirebaseIdToken } from "../middleware/firebaseAuth.js";
import { requireDoctor } from "../middleware/requireDoctor.js";

// Firestore instance for direct writes
const firestoreDb = admin.firestore();

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

function buildHeuristicRecommendation({ dosha = "", severityScore = 5, reason = "", symptoms = [] }) {
    const sev = Math.max(1, Math.min(10, Number(severityScore) || 5));
    const symptomCount = Array.isArray(symptoms) ? symptoms.length : 0;
    const sessionsRecommended =
        sev >= 9 ? 6 :
        sev >= 8 ? 5 :
        sev >= 6 ? 4 :
        sev >= 4 ? 3 : 2;
    const spacingDays =
        sev >= 9 ? 3 :
        sev >= 7 ? 4 :
        sev >= 5 ? 5 :
        sev >= 3 ? 6 : 7;
    const d = String(dosha || "").toLowerCase();
    const therapy =
        d.includes("pitta") ? "Virechana" :
        d.includes("kapha") ? "Vamana" :
        d.includes("vata") ? "Basti" :
        "Abhyanga";
    const priorityScore = Math.max(35, Math.min(100, Math.round((sev * 6.5) + Math.min(symptomCount * 2, 12))));
    return {
        therapy,
        sessions_recommended: sessionsRecommended,
        spacing_days: spacingDays,
        priority_score: priorityScore,
        explanation: `Based on reported severity (${sev}/10) and dosha profile, ${therapy} is recommended.${reason ? ` Focus area: ${reason}.` : ""}`,
        confidence: 72,
        precautions_pre: ["Stay hydrated", "Follow light satvic diet", "Sleep adequately before session"],
        precautions_post: ["Avoid heavy meals for 24h", "Rest and hydrate", "Report adverse symptoms promptly"],
        clinical_summary: `Heuristic recommendation generated from symptom severity and dosha pattern. Severity estimated at ${sev}/10 with ${sessionsRecommended} sessions spaced ${spacingDays} day(s) apart.`,
    };
}

function assertBumpOwnership(bumped, inserted, { doctorUid, patientUid }) {
    const bDoc = bumped.practitioner_id || bumped.doctorId;
    const iDoc = inserted.practitioner_id || inserted.doctorId;
    if (!bDoc || !iDoc || bDoc !== iDoc) return false;
    if (doctorUid) return bDoc === doctorUid;
    if (patientUid) return (inserted.patient_id || inserted.patientId) === patientUid;
    return false;
}

function minuteKey(iso) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.floor(t / 60000);
}

// Fixed offset for Asia/Kolkata (no DST).
const IST_OFFSET_MIN = 330;
function dateToISTParts(d) {
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
}

function makeUtcIsoFromIstParts({ year, month, day, hour, minute }) {
    const utcMs = Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MIN * 60000;
    return new Date(utcMs).toISOString();
}

async function getDoctorBlockedMinuteKeys(doctorId) {
    if (!doctorId) return new Set();
    const snap = await firestoreDb
        .collection(slotBlocks.SCHEDULE_SLOT_BLOCKS)
        .where("doctorId", "==", doctorId)
        .get();
    const keys = new Set();
    snap.forEach((d) => {
        const data = d.data() || {};
        const iso = data.startIso;
        const baseKey = minuteKey(iso);
        if (baseKey === null) return;

        // Backfill compatibility: earlier versions only blocked the start minute.
        // Expand blocked start times according to duration minutes.
        const dur =
            Number(data.durationMinutes ?? data.duration_minutes) ||
            (String(data.therapy || "").includes("Vamana") ? 120 : 90);

        const stepMs = 30 * 60000;
        const startMs = new Date(iso).getTime();
        if (Number.isNaN(startMs)) {
            keys.add(baseKey);
            return;
        }
        const count = Math.ceil(dur / 30);
        for (let i = 0; i < count; i++) {
            const nextIso = new Date(startMs + i * stepMs).toISOString();
            const nextKey = minuteKey(nextIso);
            if (nextKey !== null) keys.add(nextKey);
        }
    });
    return keys;
}

async function buildDoctorCandidateSlotsAfter(doctorId, afterIso, days = 14) {
    const afterMs = new Date(afterIso).getTime();
    if (Number.isNaN(afterMs)) return [];
    const blocked = await getDoctorBlockedMinuteKeys(doctorId);

    const out = [];
    // Generate 30-min slots within 9:00–17:00 IST, skip weekends.
    const startDate = new Date(afterMs);
    for (let i = 0; i <= days; i++) {
        const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const ist = dateToISTParts(d);

        // Weekend skip (compute from IST day)
        const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short" }).format(d);
        if (weekday === "Sat" || weekday === "Sun") continue;

        for (let hour = 9; hour < 17; hour++) {
            for (const minute of [0, 30]) {
                const iso = makeUtcIsoFromIstParts({
                    year: ist.year,
                    month: ist.month,
                    day: ist.day,
                    hour,
                    minute,
                });
                const ms = new Date(iso).getTime();
                if (ms <= afterMs) continue;
                const k = minuteKey(iso);
                if (k === null || blocked.has(k)) continue;
                out.push(iso);
            }
        }
    }
    return out;
}

async function applyBumpToFirestore(bumpResult, auth = {}) {
    const bumpedId = bumpResult?.bumpedSession?.sessionId || bumpResult?.bumpedSession?.id;
    const insertedId = bumpResult?.insertedSession?.sessionId || bumpResult?.insertedSession?.id;
    const newDatetime = bumpResult?.bumpedSession?.newDatetime;
    const insertedDatetime = bumpResult?.insertedSession?.datetime;

    if (!bumpedId || !insertedId || !newDatetime || !insertedDatetime) {
        const err = new Error("Invalid bump payload for persistence");
        err.statusCode = 400;
        throw err;
    }

    const bumpedRef = firestoreDb.collection("sessions").doc(bumpedId);
    const insertedRef = firestoreDb.collection("sessions").doc(insertedId);
    const [bumpedSnap, insertedSnap] = await Promise.all([bumpedRef.get(), insertedRef.get()]);
    if (!bumpedSnap.exists || !insertedSnap.exists) {
        const err = new Error("Bump session(s) not found");
        err.statusCode = 404;
        throw err;
    }

    const bumped = bumpedSnap.data();
    const inserted = insertedSnap.data();

    const bumpedDurationMinutes =
        Number(bumped?.duration_minutes ?? bumped?.durationMinutes) ||
        (String(bumped?.therapy || "").includes("Vamana") ? 120 : 90);
    const insertedDurationMinutes =
        Number(inserted?.duration_minutes ?? inserted?.durationMinutes) ||
        (String(inserted?.therapy || "").includes("Vamana") ? 120 : 90);

    const { doctorUid, patientUid } = auth;
    if (doctorUid || patientUid) {
        if (!assertBumpOwnership(bumped, inserted, { doctorUid, patientUid })) {
            const err = new Error("Not authorized to apply this bump");
            err.statusCode = 403;
            throw err;
        }
    }

    const now = new Date().toISOString();
    const batch = firestoreDb.batch();

    const bumpedDoctorId = bumped.practitioner_id || bumped.doctorId;
    if (bumpedDoctorId) {
        slotBlocks.addDeletesForDoctorSlots(
            batch,
            firestoreDb,
            bumpedDoctorId,
            [bumped.datetime],
            bumpedDurationMinutes
        );
        slotBlocks.addOccupancyWrite(batch, firestoreDb, {
            doctorId: bumpedDoctorId,
            iso: newDatetime,
            appointmentId: bumped.appointment_id || null,
            sessionId: bumpedId,
            patientId: bumped.patient_id || bumped.patientId || "",
            priority: Number(bumped.totalPriorityScore ?? bumped.priority) || 50,
            therapy: bumped.therapy || null,
            durationMinutes: bumpedDurationMinutes,
            status: "reschedule_requested",
            updatedAt: now,
        });
    }

    const insertedDoctorId = inserted.practitioner_id || inserted.doctorId;
    if (insertedDoctorId) {
        slotBlocks.addDeletesForDoctorSlots(
            batch,
            firestoreDb,
            insertedDoctorId,
            [inserted.datetime],
            insertedDurationMinutes
        );
        slotBlocks.addOccupancyWrite(batch, firestoreDb, {
            doctorId: insertedDoctorId,
            iso: insertedDatetime,
            appointmentId: inserted.appointment_id || null,
            sessionId: insertedId,
            patientId: inserted.patient_id || inserted.patientId || "",
            priority: Number(inserted.totalPriorityScore ?? inserted.priority) || 50,
            therapy: inserted.therapy || null,
            durationMinutes: insertedDurationMinutes,
            status: inserted.status || "confirmed",
            updatedAt: now,
        });
    }

    batch.update(bumpedRef, {
        status: "reschedule_requested",
        bumped_reason: bumpResult?.bumpedSession?.reason || "Rescheduled due to higher-priority case",
        original_datetime: bumped.datetime,
        datetime: newDatetime,
        updated_at: now,
    });
    batch.update(insertedRef, {
        datetime: insertedDatetime,
        priority_bump_applied_at: now,
        updated_at: now,
    });
    await batch.commit();

    return { bumpedId, insertedId, newDatetime, insertedDatetime };
}

async function assertDoctorOwnsHighPrioritySession(highPrioritySession, doctorUid) {
    const sid = highPrioritySession?.sessionId || highPrioritySession?.id;
    if (!sid || !doctorUid) {
        const err = new Error("highPrioritySession.sessionId required");
        err.statusCode = 400;
        throw err;
    }
    const snap = await firestoreDb.collection("sessions").doc(sid).get();
    if (!snap.exists) {
        const err = new Error("Session not found");
        err.statusCode = 404;
        throw err;
    }
    if (snap.data().practitioner_id !== doctorUid) {
        const err = new Error("Not authorized to bump for this session");
        err.statusCode = 403;
        throw err;
    }
}

async function putEventOnUserCalendar(uid, basePayload, legacyAccessToken = null) {
    let ev = await insertAyurSutraCalendarEventForUser(uid, basePayload);
    if (ev.eventId) return ev;
    if (legacyAccessToken) {
        ev = await insertAyurSutraCalendarEventWithAccessToken(legacyAccessToken, basePayload);
    }
    return ev;
}

async function createInAppNotification({ userId, title, body, sender = "system", senderRole = "system" }) {
    if (!userId) return;
    await firestoreDb.collection("notifications").add({
        user_id: userId,
        recipient_id: userId,
        recipient_role: "user",
        title,
        body,
        sender,
        sender_role: senderRole,
        channel: "in-app",
        type: "message",
        read: false,
        datetime: new Date().toISOString(),
    });
}

// ─── Asset Inventory (Mock physical constraint DB) ────────
const ASSET_INVENTORY = {
    "Virechana": { room: "Detox Room A", specializedTherapists: ["Dr. Sharma", "Dr. Iyer"] },
    "Vamana": { room: "Emesis Suite", specializedTherapists: ["Dr. Patel"] },
    "Basti": { room: "Enema Care Room", specializedTherapists: ["Dr. Verma", "Dr. Singh"] },
    "Nasya": { room: "Head & Neck Clinic", specializedTherapists: ["Dr. Rao"] },
    "Shirodhara": { room: "Relaxation Suite", specializedTherapists: ["Dr. Nair", "Dr. Menon"] },
    "Abhyanga": { room: "Massage Therapy Room", specializedTherapists: ["Dr. Kaur", "Dr. Das"] }
};

// ═══════════════════════════════════════════════════════════
// PHASE 1: PATIENT INTAKE — ML Prediction + Clinical Summary
// ═══════════════════════════════════════════════════════════

router.post("/predict", verifyFirebaseIdToken, async (req, res) => {
    try {
        const { symptoms: symptomsRaw, dosha, age, gender, reason } = req.body;
        const symptoms = Array.isArray(symptomsRaw) ? symptomsRaw : [];

        // 1. Call ML service for therapy prediction
        let mlPrediction = null;
        try {
            const mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    symptoms: symptoms.map((s) => s.name).join(", ") || "unspecified",
                    dosha: dosha || "Unknown",
                    age: age || 35,
                    gender: gender || "Unknown",
                }),
            });
            mlPrediction = await mlResponse.json();
        } catch (err) {
            console.log("ML service unavailable, using Groq fallback:", err.message);
        }

        // 2. Severity score (important):
        // - The UI sends symptom slider scores (s.score 1-10).
        // - Previously we called the RF classifier using only symptom names (no scores),
        //   and we often ended up with severity_score=5, causing priorityResult=38 always.
        // - We now incorporate the max slider severity first, and only use the classifier
        //   if it produces a higher value.
        const sliderSeverities = symptoms
            .map((s) => Number(s?.score))
            .filter((n) => Number.isFinite(n) && n > 0);
        const sliderMaxSeverity = sliderSeverities.length > 0 ? Math.max(...sliderSeverities) : null;

        let severityScore = sliderMaxSeverity ?? 5;
        try {
            const sevResponse = await fetch(`${ML_SERVICE_URL}/classify-severity`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symptoms: symptoms.map(s => s.name).join(", ") || "unspecified", dosha: dosha || "Unknown" }),
            });
            const sevData = await sevResponse.json();
            const classifierSeverity = Number(sevData?.severity_score);
            if (Number.isFinite(classifierSeverity) && classifierSeverity > 0) {
                severityScore = Math.max(severityScore, classifierSeverity);
            }
        } catch (e) {
            console.log("RF Classifier unavailable, using dynamic severity from sliders:", e.message);
            // severityScore already initialized from sliders above; keep it.
        }

        // 3. Use Groq LLM for comprehensive recommendation
        const symptomText = (symptoms.length
            ? symptoms.map((s) => `${s.name} (severity: ${s.score}/10)`)
            : ["No structured symptoms provided"]
        ).join(", ");

        const prompt = `You are an expert Ayurvedic Panchakarma physician. Based on the following patient data, provide a treatment recommendation.

Patient Data:
- Dosha Constitution: ${dosha || "Unknown"}
- Age: ${age || "Not specified"}
- Gender: ${gender || "Not specified"}
- Symptoms: ${symptomText}
- Reason for visit: ${reason || "General wellness"}
${mlPrediction ? `- ML Model Prediction: ${JSON.stringify(mlPrediction.predictions)}` : ""}

Respond in this exact JSON format:
{
  "therapy": "<primary Panchakarma therapy name>",
  "sessions_recommended": <number between 2-7>,
  "spacing_days": <number between 3-10>,
  "priority_score": <number between 30-100>,
  "explanation": "<2-3 sentence explanation of why this therapy is recommended>",
  "confidence": <number between 70-95>,
  "precautions_pre": ["<pre-procedure precaution 1>", "<precaution 2>", "<precaution 3>"],
  "precautions_post": ["<post-procedure care 1>", "<care 2>", "<care 3>"],
  "clinical_summary": "<A 3-4 sentence professional clinical summary for the doctor reviewing this case. Include the key findings, symptom analysis, and rationale for the recommended therapy.>"
}`;

        let recommendation = null;
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
                max_tokens: 600,
                response_format: { type: "json_object" },
            });
            recommendation = JSON.parse(
                completion.choices[0]?.message?.content || "{}"
            );
        } catch (groqErr) {
            console.error("Groq recommendation unavailable, using heuristic fallback:", groqErr.message);
            recommendation = buildHeuristicRecommendation({ dosha, severityScore, reason, symptoms });
        }

        // 4. Calculate initial priority score
        const priorityResult = calculatePriorityScore({
            severityScore: severityScore,
            feedbackEscalation: false,
            feedbackMultiplier: 1.0,
            dosha: dosha || "",
            slotDatetime: null,
            createdAt: new Date().toISOString(),
        });

        const heuristic = buildHeuristicRecommendation({ dosha, severityScore, reason, symptoms });
        res.json({
            success: true,
            recommendation: {
                ...recommendation,
                // Keep these fully severity-driven to avoid static/fake values from LLM defaults.
                sessions_recommended: heuristic.sessions_recommended,
                spacing_days: heuristic.spacing_days,
                priority_score: priorityResult.totalScore,
                severity_score: severityScore,
            },
            mlPrediction: mlPrediction?.predictions || null,
            priorityResult,
        });
    } catch (error) {
        console.error("Prediction error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to generate recommendation",
        });
    }
});

// ═══════════════════════════════════════════════════════════
// PHASE 1: SLOT GENERATION with Asset Allocation
// ═══════════════════════════════════════════════════════════

router.post("/slots", verifyFirebaseIdToken, async (req, res) => {
    try {
        const { practitionerId, spacingDays, sessionsNeeded, startDate, therapy, durationMinutes } = req.body;

        if (!practitionerId) {
            return res.status(400).json({ success: false, error: "practitionerId required" });
        }

        const therapyKey = therapy || "General";
        const requiredAssets = ASSET_INVENTORY[therapyKey] || {
            room: "General Panchakarma Room",
            specializedTherapists: ["Available General Staff"],
        };

        const actualSpacing = Math.max(1, parseInt(spacingDays, 10) || 3);
        const totalNeeded = Math.max(1, parseInt(sessionsNeeded, 10) || 3);
        const durationBlocked = durationMinutes ? Number(durationMinutes) : 90;

        // Start from tomorrow (keeps behavior close to previous endpoint).
        let cursor = new Date(startDate || Date.now());
        cursor.setDate(cursor.getDate() + 1);

        // Look-ahead window: enough to satisfy spacing-based picks.
        const lookaheadDays = Math.max(14, actualSpacing * totalNeeded + 7);

        const slots = [];

        for (let i = 0; i < totalNeeded; i++) {
            const available = await buildDoctorCandidateSlotsAfter(practitionerId, cursor.toISOString(), lookaheadDays);

            if (!available || available.length === 0) break;

            const chosenIso = available[0];
            const assignedTherapist =
                requiredAssets.specializedTherapists[i % requiredAssets.specializedTherapists.length] ||
                requiredAssets.specializedTherapists[0];

            slots.push({
                datetime: chosenIso,
                allocatedRoom: requiredAssets.room,
                assignedTherapist,
                durationBlocked,
            });

            // Advance cursor by spacingDays (keep the chosen time-of-day).
            const next = new Date(chosenIso);
            next.setDate(next.getDate() + actualSpacing);
            cursor = next;
        }

        if (slots.length < totalNeeded) {
            return res.status(409).json({
                success: false,
                error: "Not enough available slots to satisfy spacing requirements",
                slots: slots.map((s) => s.datetime),
            });
        }

        res.json({
            success: true,
            slots: slots.map((s) => s.datetime),
            assetDetails: slots,
        });
    } catch (error) {
        console.error("Slot generation error:", error);
        res.status(500).json({ success: false, error: "Failed to generate slots" });
    }
});

// ═══════════════════════════════════════════════════════════
// PHASE 2: DOCTOR REVIEW — Approve / Modify / Reject
// Persists to Firestore (authoritative), optional Google Calendar, email.
// :id = Firestore sessions/{id} document ID.
// ═══════════════════════════════════════════════════════════

router.post("/appointments/:id/review", verifyFirebaseIdToken, requireDoctor, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            action,
            doctorName,
            modifiedTherapy,
            modifiedSessions,
            modifiedDatetime,
            doctorAccessToken,
        } = req.body;
        const doctorId = req.firebaseUid;
        if (!["approved", "modified", "rejected"].includes(action)) {
            return res.status(400).json({ success: false, error: "Invalid action. Use: approved, modified, rejected" });
        }

        const sessionRef = firestoreDb.collection("sessions").doc(id);
        const snap = await sessionRef.get();
        if (!snap.exists) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        const s = snap.data();

        if (s.practitioner_id && s.practitioner_id !== doctorId) {
            return res.status(403).json({ success: false, error: "Not authorized to review this session" });
        }

        const now = new Date().toISOString();
        const baseReview = {
            doctor_approval: action,
            approved_at: now,
            approved_by: doctorId,
            approved_by_name: doctorName || "Doctor",
            reviewed_at: now,
        };

        if (action === "rejected") {
            if (s.gcal_event_id_doctor || s.gcal_event_id_patient) {
                let doctorLegacy = null;
                let patientLegacy = null;
                const dSnap = await firestoreDb.collection("users").doc(doctorId).get();
                doctorLegacy = dSnap.exists ? dSnap.data()?.googleAccessToken : null;
                if (s.patient_id) {
                    const pSnap = await firestoreDb.collection("users").doc(s.patient_id).get();
                    patientLegacy = pSnap.exists ? pSnap.data()?.googleAccessToken : null;
                }
                await removeSessionCalendarEventsFromGoogle(s, {
                    doctorLegacyToken: doctorAccessToken || doctorLegacy,
                    patientLegacyToken: patientLegacy,
                });
            }
            await sessionRef.update({
                ...baseReview,
                status: "rejected",
                gcal_event_id_doctor: null,
                gcal_event_id_patient: null,
                gcal_html_link_doctor: null,
                gcal_html_link_patient: null,
            });
            const currentDoctorId = s.practitioner_id || s.doctorId;
            if (currentDoctorId && s.datetime) {
                const b = firestoreDb.batch();
                const rejectDurationMin =
                    Number(s.duration_minutes) ||
                    (String(s.therapy || "").includes("Vamana") ? 120 : 90);
                slotBlocks.addDeletesForDoctorSlots(
                    b,
                    firestoreDb,
                    currentDoctorId,
                    [s.datetime],
                    rejectDurationMin
                );
                await b.commit();
            }
            if (s.patient_email) {
                try {
                    await sendEmail({
                        to: s.patient_email,
                        subject: `Session update — ${s.therapy || "Panchakarma"}`,
                        html: `<p>Namaste ${s.patient_name || "Patient"},</p>
                            <p>Your requested session could not be confirmed at this time. Please open AyurSutra to choose another time or contact the clinic.</p>`,
                    });
                } catch (e) {
                    console.error("Rejection email failed:", e.message);
                }
            }
            try {
                await createInAppNotification({
                    userId: s.patient_id,
                    title: "Session update",
                    body: `Your ${s.therapy || "session"} request could not be confirmed. Please pick another slot.`,
                    sender: doctorId,
                    senderRole: "doctor",
                });
            } catch (notifErr) {
                console.error("Rejection in-app notification failed:", notifErr.message);
            }
            return res.json({
                success: true,
                sessionId: id,
                status: "rejected",
                message: "Session rejected",
            });
        }

        let finalTherapy = s.therapy || "Panchakarma";
        let finalDatetime = s.datetime;
        if (action === "modified") {
            if (modifiedTherapy) finalTherapy = modifiedTherapy;
            if (modifiedDatetime) finalDatetime = new Date(modifiedDatetime).toISOString();
        }

        const durationMin = Number(s.duration_minutes) || 90;
        const startMs = new Date(finalDatetime).getTime();
        if (Number.isNaN(startMs)) {
            return res.status(400).json({ success: false, error: "Invalid session datetime" });
        }
        const endIso = new Date(startMs + durationMin * 60000).toISOString();

        const calendarPatch = {};
        const doctorUserSnap = await firestoreDb.collection("users").doc(doctorId).get();
        const doctorEmail = doctorUserSnap.exists ? doctorUserSnap.data()?.email : null;
        const doctorLegacyToken =
            doctorAccessToken ||
            (doctorUserSnap.exists ? doctorUserSnap.data()?.googleAccessToken : null);

        let patientUserSnap = null;
        let patientLegacyToken = null;
        if (s.patient_id) {
            patientUserSnap = await firestoreDb.collection("users").doc(s.patient_id).get();
            patientLegacyToken = patientUserSnap.exists
                ? patientUserSnap.data()?.googleAccessToken
                : null;
        }

        if (s.gcal_event_id_doctor || s.gcal_event_id_patient) {
            await removeSessionCalendarEventsFromGoogle(s, {
                doctorLegacyToken: doctorLegacyToken,
                patientLegacyToken: patientLegacyToken,
            });
        }

        const payloadDoctor = {
            summary: `${finalTherapy} — ${s.patient_name || "Patient"}`,
            description:
                `Your clinic session.\nPatient: ${s.patient_name || "Patient"}\n` +
                `Therapy: ${finalTherapy}\n` +
                `This event is only on your Google Calendar — you will get reminders from Google.`,
            startIso: finalDatetime,
            endIso,
        };
        const evDoc = await putEventOnUserCalendar(doctorId, payloadDoctor, doctorLegacyToken);
        if (evDoc.eventId) calendarPatch.gcal_event_id_doctor = evDoc.eventId;
        if (evDoc.htmlLink) calendarPatch.gcal_html_link_doctor = evDoc.htmlLink;

        if (s.patient_id) {
            const payloadPatient = {
                summary: `${finalTherapy} — Dr. ${doctorName || "Practitioner"}`,
                description:
                    `Your AyurSutra session.\n` +
                    `Therapy: ${finalTherapy}\n` +
                    `Practitioner: Dr. ${doctorName || "your practitioner"}\n` +
                    `This event is only on your Google Calendar — you will get reminders from Google.`,
                startIso: finalDatetime,
                endIso,
            };
            const evPt = await putEventOnUserCalendar(
                s.patient_id,
                payloadPatient,
                patientLegacyToken
            );
            if (evPt.eventId) calendarPatch.gcal_event_id_patient = evPt.eventId;
            if (evPt.htmlLink) calendarPatch.gcal_html_link_patient = evPt.htmlLink;
        }

        const sessionUpdate = {
            ...baseReview,
            status: "confirmed",
            therapy: finalTherapy,
            datetime: finalDatetime,
            ...calendarPatch,
        };
        if (action === "modified" && typeof modifiedSessions === "number") {
            sessionUpdate.sessions_recommended_override = modifiedSessions;
        }

        await sessionRef.update(sessionUpdate);
        const currentDoctorId = s.practitioner_id || s.doctorId;
        if (currentDoctorId) {
            const b = firestoreDb.batch();
            if (s.datetime && s.datetime !== finalDatetime) {
                slotBlocks.addDeletesForDoctorSlots(b, firestoreDb, currentDoctorId, [s.datetime], durationMin);
            }
            slotBlocks.addOccupancyWrite(b, firestoreDb, {
                doctorId: currentDoctorId,
                iso: finalDatetime,
                appointmentId: s.appointment_id || null,
                sessionId: id,
                patientId: s.patient_id || "",
                priority: Number(s.totalPriorityScore ?? s.priority) || 50,
                therapy: finalTherapy,
                durationMinutes: durationMin,
                status: "confirmed",
                updatedAt: now,
            });
            await b.commit();
        }

        if (s.appointment_id) {
            await firestoreDb.collection("appointments").doc(s.appointment_id).set(
                {
                    status: "approved",
                    lastReviewedSessionId: id,
                    lastReviewAction: action,
                    updatedAt: now,
                },
                { merge: true }
            );
        }

        if (s.patient_email) {
            try {
                await sendEmail({
                    to: s.patient_email,
                    subject: `Session confirmed — ${finalTherapy}`,
                    html: `<p>Namaste ${s.patient_name || "Patient"},</p>
                        <p>Your session is <b>confirmed</b> for <b>${new Date(finalDatetime).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            dateStyle: "medium",
                            timeStyle: "short",
                        })}</b> (India time).</p>
                        <p>Please arrive 15 minutes early. 🙏</p>`,
                });
            } catch (e) {
                console.error("Confirmation email failed:", e.message);
            }
        }
        try {
            await createInAppNotification({
                userId: s.patient_id,
                title: "Session confirmed",
                body: `Your ${finalTherapy} session is confirmed for ${new Date(finalDatetime).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                })}.`,
                sender: doctorId,
                senderRole: "doctor",
            });
        } catch (notifErr) {
            console.error("Confirmation in-app notification failed:", notifErr.message);
        }

        const refreshed = await sessionRef.get();
        const data = refreshed.data();

        res.json({
            success: true,
            sessionId: id,
            status: "confirmed",
            session: { id, ...data },
            updateData: sessionUpdate,
            message: `Session ${action} successfully`,
        });
    } catch (error) {
        console.error("Review error:", error);
        res.status(500).json({ success: false, error: "Failed to process review" });
    }
});

// ═══════════════════════════════════════════════════════════
// PHASE 3: CONFLICT CHECK & AUTO-BUMP
// ═══════════════════════════════════════════════════════════

router.post("/check-conflicts", verifyFirebaseIdToken, requireDoctor, async (req, res) => {
    try {
        const { highPrioritySession } = req.body;

        if (!highPrioritySession) {
            return res.status(400).json({ success: false, error: "highPrioritySession required" });
        }

        await assertDoctorOwnsHighPrioritySession(highPrioritySession, req.firebaseUid);

        const sid = highPrioritySession?.sessionId || highPrioritySession?.id;
        const srcSnap = await firestoreDb.collection("sessions").doc(sid).get();
        if (!srcSnap.exists) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        const src = srcSnap.data();
        const priorityScore = Number(src.totalPriorityScore ?? src.priority ?? 50);
        const effectivePriority = Number.isFinite(priorityScore) ? priorityScore : 50;
        const doctorId = src.practitioner_id;
        const dt = src.datetime;
        if (!doctorId || !dt) {
            return res.status(400).json({ success: false, error: "Session missing practitioner_id/datetime" });
        }

        if (effectivePriority >= BUMP_EMERGENCY_MIN_SCORE) {
            const scheduledSnap = await firestoreDb
                .collection("sessions")
                .where("practitioner_id", "==", doctorId)
                .where("status", "in", ["confirmed", "scheduled", "pending_review"])
                .get();
            const scheduledSessions = [];
            scheduledSnap.forEach((d) => scheduledSessions.push({ id: d.id, ...d.data() }));

            const availableSlots = await buildDoctorCandidateSlotsAfter(doctorId, dt, 14);
            const result = bumpAndReschedule(
                {
                    ...src,
                    sessionId: sid,
                    priorityScore: effectivePriority,
                    patientEmail: src.patient_email,
                    patientName: src.patient_name,
                },
                scheduledSessions.map((s) => ({
                    ...s,
                    sessionId: s.id,
                    priorityScore: Number(s.totalPriorityScore ?? s.priority) || 50,
                })),
                availableSlots
            );

            if (result.bumped) {
                // Send dual notifications
                const formatDT = (dt) => new Date(dt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

                // 1. Notify bumped patient
                if (result.bumpedSession.patientEmail || result.bumpedSession.patient_email || result.bumpedSession.email) {
                    try {
                        await sendEmail({
                            to: result.bumpedSession.patientEmail || result.bumpedSession.patient_email || result.bumpedSession.email,
                            subject: "⚠️ Urgent: Your Session Has Been Rescheduled",
                            html: `<p>Namaste,</p>
                                <p>Your <b>${result.bumpedSession.therapy}</b> session has been rescheduled to accommodate an acute care requirement.</p>
                                <p><b>New Time:</b> ${result.bumpedSession.newDatetime ? formatDT(result.bumpedSession.newDatetime) : 'Please check your dashboard'}</p>
                                <p>We sincerely apologize for the inconvenience. 🙏</p>`
                        });
                    } catch (emailErr) {
                        console.error("Failed to email bumped patient:", emailErr.message);
                    }
                }

                // 2. Notify high-priority patient
                if (result.insertedSession.patientEmail || result.insertedSession.patient_email || result.insertedSession.email) {
                    try {
                        await sendEmail({
                            to: result.insertedSession.patientEmail || result.insertedSession.patient_email || result.insertedSession.email,
                            subject: "🌿 Emergency Priority Slot Confirmed",
                            html: `<p>Namaste,</p>
                                <p>An urgent priority slot has been secured for your <b>${result.insertedSession.therapy}</b> session.</p>
                                <p><b>Confirmed Time:</b> ${formatDT(result.insertedSession.datetime)}</p>
                                <p>Please arrive 15 minutes early. 🙏</p>`
                        });
                    } catch (emailErr) {
                        console.error("Failed to email high-priority patient:", emailErr.message);
                    }
                }
            }

            return res.json({ success: true, ...result });
        }

        res.json({ success: true, bumped: false, reason: "Priority not high enough for bump or no conflicts" });
    } catch (error) {
        console.error("Conflict check error:", error);
        const code = error.statusCode || 500;
        res.status(code).json({
            success: false,
            error: error.message || "Failed to check conflicts",
        });
    }
});

// Persist the bump result returned by /check-conflicts.
router.post("/apply-bump", verifyFirebaseIdToken, requireDoctor, async (req, res) => {
    try {
        const { bumpResult } = req.body;
        if (!bumpResult?.bumped) {
            return res.status(400).json({ success: false, error: "No bumped result to apply" });
        }
        const persisted = await applyBumpToFirestore(bumpResult, { doctorUid: req.firebaseUid });
        res.json({ success: true, persisted });
    } catch (error) {
        console.error("Apply bump error:", error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message || "Failed to apply bump",
        });
    }
});

// ═══════════════════════════════════════════════════════════
// PHASE 4: FEEDBACK ESCALATION — Emergency Reschedule
// ═══════════════════════════════════════════════════════════

router.post("/feedback-escalation", verifyFirebaseIdToken, async (req, res) => {
    try {
        const { sessionId, patientId, patientName, patientEmail, therapy, feedback, currentSeverity, dosha } = req.body;

        if (!sessionId || typeof sessionId !== "string") {
            return res.status(400).json({ success: false, error: "sessionId required" });
        }
        const escalationSessSnap = await firestoreDb.collection("sessions").doc(sessionId).get();
        if (!escalationSessSnap.exists) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        if (escalationSessSnap.data().patient_id !== req.firebaseUid) {
            return res.status(403).json({ success: false, error: "Forbidden" });
        }

        // 1. Analyze feedback with LLM
        let llmAnalysis = null;
        try {
            const prompt = `You are an Ayurvedic physician reviewing urgent post-therapy feedback. The patient reports adverse effects.

Patient: ${patientName || "Patient"}
Therapy: ${therapy || "Panchakarma"}
Feedback: ${JSON.stringify(feedback)}

Determine the urgency and respond in this exact JSON format:
{
  "action": "<one of: emergency_followup, increase_priority, add_session, monitor>",
  "urgency_level": "<critical, high, moderate>",
  "explanation": "<1-2 sentence explanation for both patient and doctor>",
  "new_severity_score": <number 1-10>,
  "care_instructions": ["<instruction 1>", "<instruction 2>"]
}`;

            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.3-70b-versatile",
                temperature: 0.2,
                max_tokens: 300,
                response_format: { type: "json_object" },
            });

            llmAnalysis = JSON.parse(completion.choices[0]?.message?.content || "{}");
        } catch (err) {
            console.error("LLM analysis failed, using defaults:", err.message);
            llmAnalysis = {
                action: "emergency_followup",
                urgency_level: "high",
                explanation: "Adverse effects detected. Immediate follow-up recommended.",
                new_severity_score: 9,
                care_instructions: ["Rest immediately", "Contact doctor if symptoms worsen"]
            };
        }

        // 2. Recalculate priority with escalation
        const newSeverity = llmAnalysis.new_severity_score || Math.min((currentSeverity || 5) + 3, 10);
        const escalatedPriority = calculatePriorityScore({
            severityScore: newSeverity,
            feedbackEscalation: true,
            feedbackMultiplier: 2.5,
            dosha: dosha || "",
            slotDatetime: null,
            createdAt: new Date().toISOString(),
        });

        // 3. Build session update payload
        const feedbackNow = new Date().toISOString();
        const feedbackDoc =
            feedback && typeof feedback === "object"
                ? {
                      submitted_at: feedbackNow,
                      symptom_scores: feedback.symptomScores || feedback.symptom_scores || {},
                      notes: feedback.notes || "",
                      side_effects: feedback.sideEffects || [],
                      via_escalation: true,
                  }
                : { submitted_at: feedbackNow, via_escalation: true };

        const sessionUpdate = {
            feedback_escalation: true,
            feedback_multiplier: 2.5,
            severity_score: newSeverity,
            totalPriorityScore: escalatedPriority.totalScore,
            priority: escalatedPriority.totalScore,
            escalation_reason: llmAnalysis.explanation,
            escalated_at: feedbackNow,
            feedback: feedbackDoc,
            feedback_submitted_at: feedbackNow,
        };

        // 4. Attempt emergency bump if score is critical
        let bumpResult = { bumped: false };
        const baseSession = escalationSessSnap.data();
        const baseDoctorId = baseSession.practitioner_id;
        if (escalatedPriority.totalScore >= BUMP_EMERGENCY_MIN_SCORE && baseDoctorId) {
            const emergencySession = {
                sessionId,
                patientId,
                patientName,
                patientEmail,
                therapy,
                datetime: new Date().toISOString(), // ASAP
                priorityScore: escalatedPriority.totalScore,
                email: patientEmail,
            };

            const scheduledSnap = await firestoreDb
                .collection("sessions")
                .where("practitioner_id", "==", baseDoctorId)
                .where("status", "in", ["confirmed", "scheduled", "pending_review"])
                .get();
            const scheduledSessions = [];
            scheduledSnap.forEach((d) => scheduledSessions.push({ id: d.id, ...d.data() }));

            const candidateSlots = await buildDoctorCandidateSlotsAfter(baseDoctorId, emergencySession.datetime, 14);
            bumpResult = bumpAndReschedule(
                emergencySession,
                scheduledSessions.map((s) => ({
                    ...s,
                    sessionId: s.id,
                    priorityScore: Number(s.totalPriorityScore ?? s.priority) || 50,
                })),
                candidateSlots
            );

            if (bumpResult.bumped) {
                // Send dual notifications
                const formatDT = (dt) => new Date(dt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

                if (bumpResult.bumpedSession.patientEmail || bumpResult.bumpedSession.patient_email || bumpResult.bumpedSession.email) {
                    try {
                        await sendEmail({
                            to: bumpResult.bumpedSession.patientEmail || bumpResult.bumpedSession.patient_email || bumpResult.bumpedSession.email,
                            subject: "⚠️ Session Rescheduled — Emergency Protocol",
                            html: `<p>Namaste,</p><p>Your <b>${bumpResult.bumpedSession.therapy}</b> session has been rescheduled due to a medical emergency.</p>
                                <p><b>New Time:</b> ${bumpResult.bumpedSession.newDatetime ? formatDT(bumpResult.bumpedSession.newDatetime) : 'Check your dashboard'}</p>
                                <p>We apologize for the inconvenience. 🙏</p>`
                        });
                    } catch (e) { console.error("Bump email failed:", e.message); }
                }

                if (patientEmail) {
                    try {
                        await sendEmail({
                            to: patientEmail,
                            subject: "🚨 Emergency Follow-Up Scheduled",
                            html: `<p>Namaste ${patientName},</p>
                                <p>Based on your adverse reaction report, an <b>emergency follow-up</b> has been scheduled.</p>
                                <p><b>Time:</b> ${formatDT(bumpResult.insertedSession.datetime)}</p>
                                <p>${llmAnalysis.care_instructions?.join(". ") || ""}</p>
                                <p>Please arrive early. 🙏</p>`
                        });
                    } catch (e) { console.error("Emergency email failed:", e.message); }
                }
                try {
                    await applyBumpToFirestore(bumpResult, { patientUid: req.firebaseUid });
                } catch (persistBumpErr) {
                    console.error("Emergency bump persist failed:", persistBumpErr.message);
                }
            }
        }

        let escalationPersisted = false;
        if (sessionId && typeof sessionId === "string") {
            try {
                await firestoreDb.collection("sessions").doc(sessionId).update(sessionUpdate);
                escalationPersisted = true;
            } catch (persistErr) {
                console.error("Feedback escalation Firestore update failed:", persistErr.message);
            }
        }

        res.json({
            success: true,
            sessionUpdate,
            llmAnalysis,
            escalatedPriority,
            bumpResult,
            escalationPersisted,
        });
    } catch (error) {
        console.error("Feedback escalation error:", error);
        res.status(500).json({ success: false, error: "Failed to process feedback escalation" });
    }
});

// ═══════════════════════════════════════════════════════════
// EXISTING: Feedback Processing (non-emergency)
// ═══════════════════════════════════════════════════════════

router.post("/feedback", verifyFirebaseIdToken, async (req, res) => {
    try {
        const { sessionId, patientName, therapy, feedback, currentPlan } = req.body;

        if (sessionId && typeof sessionId === "string") {
            const fbSnap = await firestoreDb.collection("sessions").doc(sessionId).get();
            if (!fbSnap.exists) {
                return res.status(404).json({ success: false, error: "Session not found" });
            }
            if (fbSnap.data().patient_id !== req.firebaseUid) {
                return res.status(403).json({ success: false, error: "Forbidden" });
            }
        }

        const prompt = `You are an Ayurvedic physician reviewing post-session feedback. Based on the patient's response, determine if the treatment plan should be adjusted.

Session Details:
- Patient: ${patientName}
- Therapy: ${therapy}
- Current Plan: ${JSON.stringify(currentPlan)}

Patient Feedback:
- Symptom Scores: ${JSON.stringify(feedback.symptomScores)}
- Notes: ${feedback.notes}
- Side Effects: ${feedback.sideEffects?.join(", ") || "None reported"}

Respond in this exact JSON format:
{
  "action": "<one of: no_change, add_session, modify_spacing, increase_priority, decrease_priority>",
  "explanation": "<brief explanation for the patient and doctor>",
  "updated_priority_score": <number or null>,
  "additional_sessions": <number or 0>,
  "new_spacing_days": <number or null>,
  "care_instructions": ["<instruction 1>", "<instruction 2>"]
}`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            max_tokens: 400,
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(
            completion.choices[0]?.message?.content || "{}"
        );

        res.json({ success: true, result });
    } catch (error) {
        console.error("Feedback processing error:", error);
        res.status(500).json({ success: false, error: "Failed to process feedback" });
    }
});

// ═══════════════════════════════════════════════════════════
// EXISTING: Priority Score Calculator
// ═══════════════════════════════════════════════════════════

router.post("/calculate-priority", async (req, res) => {
    try {
        const { severityScore, feedbackEscalation, feedbackMultiplier, dosha, slotDatetime, createdAt } = req.body;

        let severity = severityScore;
        if (!severity && req.body.symptoms) {
            try {
                const rfResponse = await fetch(`${ML_SERVICE_URL}/classify-severity`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ symptoms: req.body.symptoms, dosha: dosha || "Unknown" }),
                });
                const rfData = await rfResponse.json();
                severity = rfData.severity_score || 5;
            } catch (e) {
                severity = 5;
            }
        }

        const result = calculatePriorityScore({
            severityScore: severity || 5,
            feedbackEscalation: feedbackEscalation || false,
            feedbackMultiplier: feedbackMultiplier || 1.0,
            dosha: dosha || "",
            slotDatetime: slotDatetime || null,
            createdAt: createdAt || null,
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error("Priority calculation error:", error);
        res.status(500).json({ success: false, error: "Failed to calculate priority" });
    }
});

// ═══════════════════════════════════════════════════════════
// EXISTING: Priority Queue Builder
// ═══════════════════════════════════════════════════════════

router.post("/priority-queue", verifyFirebaseIdToken, requireDoctor, async (req, res) => {
    try {
        const { sessions, patients } = req.body;

        if (!sessions || !Array.isArray(sessions)) {
            return res.status(400).json({ success: false, error: "Sessions array required" });
        }

        const heap = buildPriorityQueue(sessions, patients || []);
        const sortedQueue = heap.toSortedArray();

        res.json({
            success: true,
            queue: sortedQueue,
            stats: {
                total: sortedQueue.length,
                highPriority: sortedQueue.filter((s) => s.priorityScore >= 80).length,
                mediumPriority: sortedQueue.filter((s) => s.priorityScore >= 60 && s.priorityScore < 80).length,
                lowPriority: sortedQueue.filter((s) => s.priorityScore < 60).length,
            },
        });
    } catch (error) {
        console.error("Priority queue build error:", error);
        res.status(500).json({ success: false, error: "Failed to build priority queue" });
    }
});

// ═══════════════════════════════════════════════════════════
// EXISTING: Bump & Reschedule (direct call)
// ═══════════════════════════════════════════════════════════

router.post("/bump", verifyFirebaseIdToken, requireDoctor, async (req, res) => {
    try {
        const { highPrioritySession, scheduledSessions, availableSlots } = req.body;

        if (!highPrioritySession || !scheduledSessions) {
            return res.status(400).json({ success: false, error: "highPrioritySession and scheduledSessions required" });
        }

        const result = bumpAndReschedule(highPrioritySession, scheduledSessions, availableSlots || []);

        if (result.bumped) {
            const formatDT = (dt) => new Date(dt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

            if (result.bumpedSession.patientEmail || result.bumpedSession.patient_email || result.bumpedSession.email) {
                try {
                    await sendEmail({
                        to: result.bumpedSession.patientEmail || result.bumpedSession.patient_email || result.bumpedSession.email,
                        subject: "⚠️ Urgent Update: Session Rescheduled",
                        html: `<p>Namaste,</p><p>Your session for <b>${result.bumpedSession.therapy}</b> has been rescheduled.</p>
                               <p><b>New Time:</b> ${result.bumpedSession.newDatetime ? formatDT(result.bumpedSession.newDatetime) : 'Check your dashboard'}</p>
                               <p>We apologize for the inconvenience. 🙏</p>`
                    });
                } catch (e) { console.error("Bump email failed:", e.message); }
            }

            if (result.insertedSession.patientEmail || result.insertedSession.patient_email || result.insertedSession.email) {
                try {
                    await sendEmail({
                        to: result.insertedSession.patientEmail || result.insertedSession.patient_email || result.insertedSession.email,
                        subject: "🌿 High-Priority Session Confirmed",
                        html: `<p>Namaste,</p><p>A priority slot has been secured for your <b>${result.insertedSession.therapy}</b> session.</p>
                               <p><b>Time:</b> ${formatDT(result.insertedSession.datetime)}</p><p>Please arrive 15 minutes early. 🙏</p>`
                    });
                } catch (e) { console.error("Priority email failed:", e.message); }
            }
        }

        res.json({ success: true, ...result });
    } catch (error) {
        console.error("Bump error:", error);
        res.status(500).json({ success: false, error: "Failed to bump/reschedule" });
    }
});

// ═══════════════════════════════════════════════════════════
// EXISTING: ML Analysis (Severity + Sessions)
// ═══════════════════════════════════════════════════════════

router.post("/ml-analysis", async (req, res) => {
    try {
        const { symptoms, dosha, age, gender } = req.body;
        let severityResult = null;
        let sessionPrediction = null;

        try {
            const sevResponse = await fetch(`${ML_SERVICE_URL}/classify-severity`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symptoms, dosha: dosha || "Unknown" }),
            });
            severityResult = await sevResponse.json();
        } catch (e) {
            console.log("RF Classifier unavailable:", e.message);
        }

        try {
            const sessResponse = await fetch(`${ML_SERVICE_URL}/predict-sessions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    severity: severityResult?.severity_score || 5,
                    dosha: dosha || "Unknown",
                    age: age || 35,
                    gender: gender || "Unknown",
                }),
            });
            sessionPrediction = await sessResponse.json();
        } catch (e) {
            console.log("RF Regressor unavailable:", e.message);
        }

        res.json({
            success: true,
            severity: severityResult,
            sessionPrediction,
        });
    } catch (error) {
        console.error("ML analysis error:", error);
        res.status(500).json({ success: false, error: "ML analysis failed" });
    }
});

// ═══════════════════════════════════════════════════════════
// PHASE 1: INTAKE PERSISTENCE — Store intake + triage + sessions
// ═══════════════════════════════════════════════════════════

router.post("/intake", verifyFirebaseIdToken, async (req, res) => {
    try {
        const {
            patientId,
            patientName,
            patientEmail,
            phone,
            reason,
            dosha,
            age,
            gender,
            healthHistory,
            symptoms,
            recommendation,
            scheduledSlots,
            priorityResult,
            doctorId,    // FIX #8: accept assigned doctor from request body
            doctorName,  // FIX #8
        } = req.body;

        if (!patientId) {
            return res.status(400).json({ success: false, error: "patientId is required" });
        }

        // Security: patients can only create intake for themselves.
        if (req.firebaseUid && patientId !== req.firebaseUid) {
            return res.status(403).json({ success: false, error: "Forbidden: patientId mismatch" });
        }

        // Optional hardening: if the user profile already has an email, require consistency.
        const userSnap = await firestoreDb.collection("users").doc(patientId).get();
        const profileEmail = userSnap.exists ? userSnap.data()?.email || userSnap.data()?.patient_email : null;
        if (profileEmail && patientEmail && String(patientEmail).trim().toLowerCase() !== String(profileEmail).trim().toLowerCase()) {
            return res.status(403).json({ success: false, error: "Forbidden: patientEmail mismatch" });
        }

        const now = new Date().toISOString();

        // 1. Create intakeSubmission document
        const intakeRef = firestoreDb.collection("intakeSubmissions").doc();
        const intakeDoc = {
            patientId,
            patientName: patientName || "Patient",
            patientEmail: patientEmail || "",
            phone: phone || "",
            reason: reason || "",
            dosha: dosha || "Unknown",
            age: age || null,
            gender: gender || "Unknown",
            healthHistory: healthHistory || {},
            symptoms: symptoms || [],
            recommendation: recommendation || {},
            priorityResult: priorityResult || {},
            triageScore: recommendation?.severity_score || 5,
            urgencyLevel: (recommendation?.severity_score || 5) >= 7
                ? "high" : (recommendation?.severity_score || 5) >= 4
                    ? "moderate" : "mild",
            status: "submitted",
            createdAt: now,
        };
        await intakeRef.set(intakeDoc);

        // 2. Update user profile with recommendation + symptoms
        const userRef = firestoreDb.collection("users").doc(patientId);
        const profileUpdate = {
            reason_for_visit: reason || "",
            symptoms: (symptoms || []).map(s => ({ name: s.name, score: s.score || 5 })),
            llm_recommendation: recommendation ? {
                therapy: recommendation.therapy || "General",
                sessions_recommended: recommendation.sessions_recommended || 3,
                spacing_days: recommendation.spacing_days || 7,
                priority_score: recommendation.totalPriorityScore || recommendation.priority_score || 50,
                explanation: recommendation.explanation || "",
            } : null,
            healthHistory: healthHistory || {},
            lastIntakeAt: now,
        };
        await userRef.set(profileUpdate, { merge: true });

        // 3. Appointment aggregate (enables server-side collision checks vs intake-only sessions)
        const sessionIds = [];
        const slots = scheduledSlots || [];
        let appointmentId = null;
        const apptPriority = Number(
            recommendation?.totalPriorityScore ?? recommendation?.priority_score ?? priorityResult?.totalScore
        ) || 50;

        if (slots.length > 0 && doctorId) {
            const appointmentRef = firestoreDb.collection("appointments").doc();
            appointmentId = appointmentRef.id;
            await appointmentRef.set({
                patientId,
                patientName: patientName || "Patient",
                patientEmail: patientEmail || "",
                doctorId,
                doctorName: doctorName || "",
                therapy: recommendation?.therapy || "Panchakarma",
                scheduledSlots: slots,
                totalSessions: slots.length,
                intakeId: intakeRef.id,
                status: "pending",
                priority: apptPriority,
                totalPriorityScore: apptPriority,
                severity: recommendation?.severity_score || 5,
                dosha: dosha || "Unknown",
                reason: reason || "",
                createdAt: now,
            });
        }

        // 4. Session documents for each scheduled slot
        for (let i = 0; i < slots.length; i++) {
            const sessionRef = firestoreDb.collection("sessions").doc();
            const sessionDoc = {
                patient_id: patientId,
                patient_name: patientName || "Patient",
                patient_email: patientEmail || "",
                practitioner_id: doctorId || null,
                doctor_name: doctorName || null,
                appointment_id: appointmentId,
                therapy: recommendation?.therapy || "Panchakarma",
                datetime: slots[i],
                session_number: i + 1,
                total_sessions: slots.length,
                duration_minutes: recommendation?.therapy?.includes("Vamana") ? 120 : 90,
                status: "pending_review",
                doctor_approval: "pending",
                severity_score: recommendation?.severity_score || 5,
                priority: apptPriority,
                totalPriorityScore: apptPriority,
                dosha: dosha || "Unknown",
                reason: reason || "",
                intake_id: intakeRef.id,
                clinical_summary: recommendation?.clinical_summary || "",
                precautions_pre: recommendation?.precautions_pre || [],
                precautions_post: recommendation?.precautions_post || [],
                feedback_escalation: false,
                feedback_multiplier: 1.0,
                created_at: now,
            };
            await sessionRef.set(sessionDoc);
            sessionIds.push(sessionRef.id);
        }

        // 5. Send confirmation email if email is available
        if (patientEmail) {
            try {
                const formatDT = (dt) => new Date(dt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short"
                });

                await sendEmail({
                    to: patientEmail,
                    subject: "🌿 AyurSutra: Your Intake Has Been Submitted",
                    html: `<p>Namaste ${patientName},</p>
                        <p>Your health intake has been submitted successfully.</p>
                        <p><b>Recommended Therapy:</b> ${recommendation?.therapy || "Pending"}</p>
                        <p><b>Sessions:</b> ${slots.length} sessions starting ${slots[0] ? formatDT(slots[0]) : "TBD"}</p>
                        <p><b>Status:</b> Pending Doctor Review</p>
                        <p>A doctor will review your intake and confirm your sessions shortly. 🙏</p>`
                });
            } catch (emailErr) {
                console.error("Intake confirmation email failed:", emailErr.message);
            }
        }

        res.json({
            success: true,
            intakeId: intakeRef.id,
            appointmentId,
            sessionIds,
            message: `Intake submitted with ${sessionIds.length} sessions pending review`,
        });
    } catch (error) {
        console.error("Intake persistence error:", error);
        res.status(500).json({ success: false, error: "Failed to persist intake data" });
    }
});

export default router;
