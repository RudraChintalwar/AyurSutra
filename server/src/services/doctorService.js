/**
 * Doctor domain — business logic (MVC: Model + rules live here; routes are thin).
 * Handles onboarding, proximity search, and prioritized booking with collision bump.
 */
import { admin } from "../middleware/auth.js";
import { calculatePriorityScore } from "../utils/priorityQueue.js";
import * as slotBlocks from "./slotBlockService.js";
import { rebuildDoctorDayQueue, istDayKeyFromIso } from "./doctorDayQueue.js";

const db = admin.firestore();

/** Mock geocode for structured addresses (demo / tests). */
export function mockGeocode(addressObj) {
    let seed = 0;
    if (addressObj && addressObj.city) {
        for (let i = 0; i < addressObj.city.length; i++) {
            seed += addressObj.city.charCodeAt(i);
        }
    }
    const baseLat = 21.1458;
    const baseLng = 79.0882;
    const latOffset = ((seed % 100) / 100) * 10 - 5;
    const lngOffset = ((seed % 50) / 50) * 10 - 5;
    return {
        lat: Number((baseLat + latOffset).toFixed(4)),
        lng: Number((baseLng + lngOffset).toFixed(4)),
    };
}

export function calculateDistanceKM(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const THIRTY_MIN_MS = 30 * 60 * 1000;
const SLOT_DURATION_MINUTES = 90;
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const LUNCH_START_HOUR = 13;
const LUNCH_START_MINUTE = 30; // 1:30 PM
const LUNCH_END_HOUR = 14;
export const BLOCKING_SESSION_STATUSES = ["pending_review", "confirmed", "scheduled", "reschedule_requested"];
export const ACTIVE_APPOINTMENT_STATUSES = ["pending", "approved"];

export function numericPriorityFromFirestore(doc) {
    const n = Number(doc?.totalPriorityScore ?? doc?.priority);
    if (Number.isFinite(n)) return n;
    return 50;
}

function minuteKey(iso) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.floor(t / 60000);
}

function addOccupiedDurationMinuteKeys(occupiedKeys, startIso, durationMinutes = SLOT_DURATION_MINUTES) {
    const startMs = new Date(startIso).getTime();
    if (Number.isNaN(startMs)) return;
    const steps = Math.ceil(durationMinutes / 30);
    for (let i = 0; i < steps; i++) {
        const iso = new Date(startMs + i * THIRTY_MIN_MS).toISOString();
        const k = minuteKey(iso);
        if (k !== null) occupiedKeys.add(k);
    }
}

function isValidDoctorSlotStart(iso, durationMinutes = SLOT_DURATION_MINUTES) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(d);
    const startHour = Number(parts.find((p) => p.type === "hour")?.value || "0");
    const startMin = Number(parts.find((p) => p.type === "minute")?.value || "0");
    const start = startHour * 60 + startMin;
    const end = start + durationMinutes;
    const workStart = WORK_START_HOUR * 60;
    const workEnd = WORK_END_HOUR * 60;
    const lunchStart = LUNCH_START_HOUR * 60 + LUNCH_START_MINUTE;
    const lunchEnd = LUNCH_END_HOUR * 60;

    // Strict grid enforcement (prevents 09:30 / 10:00 drift).
    // With 90-min sessions and lunch 13:30–14:00, valid starts are:
    // 09:00, 10:30, 12:00, 14:00, 15:30 (IST).
    const allowedStartMinutes = [9 * 60, 10 * 60 + 30, 12 * 60, 14 * 60, 15 * 60 + 30];
    if (!allowedStartMinutes.includes(start)) return false;

    if (start < workStart || end > workEnd) return false;
    const overlapsLunch = start < lunchEnd && end > lunchStart;
    if (overlapsLunch) return false;
    return true;
}

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

function calendarDayKeyIST(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}

function isWeekendIST(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const weekday = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
    }).format(d);
    return weekday === "Sat" || weekday === "Sun";
}

/**
 * Normalize any arbitrary datetime to the next valid doctor slot start (IST)
 * based on the strict 90-minute grid: 09:00, 10:30, 12:00, 14:00, 15:30.
 * Skips weekends and enforces lunch/work rules via isValidDoctorSlotStart().
 */
function normalizeToDoctorGridIso(inputIso, durationMinutes = SLOT_DURATION_MINUTES) {
    const inMs = new Date(inputIso).getTime();
    if (Number.isNaN(inMs)) return null;
    const inputNormalized = new Date(inMs).toISOString();
    if (!isWeekendIST(inputNormalized) && isValidDoctorSlotStart(inputNormalized, durationMinutes)) {
        return inputNormalized;
    }

    const allowedStarts = [
        { hour: 9, minute: 0 },
        { hour: 10, minute: 30 },
        { hour: 12, minute: 0 },
        { hour: 14, minute: 0 },
        { hour: 15, minute: 30 },
    ];

    // Try same IST day first (>= input time).
    const ist = dateToISTParts(new Date(inMs));
    for (const st of allowedStarts) {
        const candidate = makeUtcIsoFromIstParts({
            year: ist.year,
            month: ist.month,
            day: ist.day,
            hour: st.hour,
            minute: st.minute,
        });
        const cMs = new Date(candidate).getTime();
        if (cMs < inMs) continue;
        if (isWeekendIST(candidate)) continue;
        if (!isValidDoctorSlotStart(candidate, durationMinutes)) continue;
        return candidate;
    }

    // Otherwise, roll forward using the canonical next-slot finder.
    const empty = new Set();
    return nextAvailableDoctorSlotAfter(inputNormalized, empty, durationMinutes);
}

function dayGridSlotsForIso(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return [];
    const ist = dateToISTParts(d);
    const allowedStarts = [
        { hour: 9, minute: 0 },
        { hour: 10, minute: 30 },
        { hour: 12, minute: 0 },
        { hour: 14, minute: 0 },
        { hour: 15, minute: 30 },
    ];
    return allowedStarts.map((st) =>
        makeUtcIsoFromIstParts({
            year: ist.year,
            month: ist.month,
            day: ist.day,
            hour: st.hour,
            minute: st.minute,
        })
    );
}

function nextAvailableDoctorSlotAfter(afterIso, occupiedKeys, durationMinutes = SLOT_DURATION_MINUTES) {
    const afterMs = new Date(afterIso).getTime();
    if (Number.isNaN(afterMs)) return null;
    const searchStart = afterMs + THIRTY_MIN_MS;
    // Strict 90-minute slot grid (no 30-minute starts):
    // Work: 9:00–18:00, Lunch: 13:30–14:00
    // Valid starts: 09:00, 10:30, 12:00, 14:00, 15:30
    const allowedStarts = [
        { hour: 9, minute: 0 },
        { hour: 10, minute: 30 },
        { hour: 12, minute: 0 },
        { hour: 14, minute: 0 },
        { hour: 15, minute: 30 },
    ];

    // Search up to 60 days to guarantee fallback.
    for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
        const day = new Date(searchStart + dayOffset * 24 * 60 * 60 * 1000);
        const ist = dateToISTParts(day);

        // Weekend skip (clinic closed).
        const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short" }).format(day);
        if (weekday === "Sat" || weekday === "Sun") continue;

        for (const st of allowedStarts) {
            const iso = makeUtcIsoFromIstParts({
                year: ist.year,
                month: ist.month,
                day: ist.day,
                hour: st.hour,
                minute: st.minute,
            });
            const cMs = new Date(iso).getTime();
            if (cMs <= afterMs) continue;
            if (!isValidDoctorSlotStart(iso, durationMinutes)) continue;

            const testKeys = new Set();
            addOccupiedDurationMinuteKeys(testKeys, iso, durationMinutes);
            const blocked = [...testKeys].some((k) => occupiedKeys.has(k));
            if (!blocked) return iso;
        }
    }

    return null;
}

export function requestedSlotConflictsWithTime(requestedSlotISOs, existingISO) {
    const t0 = new Date(existingISO).getTime();
    if (Number.isNaN(t0)) return false;
    const keyB = minuteKey(existingISO);
    return requestedSlotISOs.some((rs) => {
        const t = new Date(rs).getTime();
        if (Number.isNaN(t)) return false;
        if (keyB !== null && minuteKey(rs) === keyB) return true;
        return Math.abs(t - t0) < THIRTY_MIN_MS;
    });
}

export function appointmentSlotIntersections(requestedSlots, existingSlots) {
    const reqKeys = new Set(requestedSlots.map(minuteKey).filter((k) => k !== null));
    return (existingSlots || []).filter((s) => {
        const k = minuteKey(s);
        return k !== null && reqKeys.has(k);
    });
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

function therapyMatchesDoctor(data, requiredTherapy) {
    if (!requiredTherapy) return true;
    const nt = String(requiredTherapy).toLowerCase().trim();
    const list = (data.supportedTherapies || data.therapiesOffered || []).map((t) =>
        String(t).toLowerCase()
    );
    if (list.some((t) => t.includes(nt) || nt.includes(t))) return true;
    const spec = data.specialization;
    if (!spec) return false;
    const specs = typeof spec === "string" ? spec.split(",") : spec;
    return specs.some((s) => String(s).toLowerCase().includes(nt));
}

export async function registerDoctor(body) {
    const {
        uid,
        name,
        email,
        clinicName,
        clinicAddress,
        gender,
        yearsOfExperience,
        supportedTherapies,
    } = body;

    if (!uid || !name || !supportedTherapies || !clinicAddress) {
        const err = new Error("Missing required onboarding fields");
        err.statusCode = 400;
        throw err;
    }

    const geolocation = mockGeocode(clinicAddress);

    const doctorProfile = {
        role: "doctor",
        name,
        email,
        clinicName,
        clinicAddress,
        geolocation,
        gender,
        yearsOfExperience: Number(yearsOfExperience) || 0,
        supportedTherapies,
        rating: 5.0,
        verificationStatus: "verified",
        createdAt: new Date().toISOString(),
    };

    await db.collection("users").doc(uid).set(doctorProfile, { merge: true });
    return { geolocation };
}

/**
 * @param {object} query - req.query
 * @param {{ broad?: boolean }} opts - broad=true skips Firestore array-contains therapy filter (signup path often has empty supportedTherapies)
 */
export async function searchDoctors(query, opts = {}) {
    const {
        requiredTherapy,
        city,
        lat,
        lng,
        radiusKm = 50,
        gender,
        minRating,
    } = query;
    const broad = opts.broad === true || query.broad === "1" || query.broad === "true";

    let queryRef = db.collection("users").where("role", "==", "doctor");

    if (requiredTherapy && !broad) {
        queryRef = queryRef.where("supportedTherapies", "array-contains", requiredTherapy);
    }

    if (gender && gender !== "Any") {
        queryRef = queryRef.where("gender", "==", gender);
    }

    const snapshot = await queryRef.get();
    const doctors = [];

    snapshot.forEach((doc) => {
        const data = doc.data();

        if (requiredTherapy && broad && !therapyMatchesDoctor(data, requiredTherapy)) return;

        if (minRating && data.rating < Number(minRating)) return;

        if (city) {
            const cityNeedle = String(city).toLowerCase();
            const clinicAddr = data.clinicAddress;
            const clinicCity =
                typeof clinicAddr === "string" ? clinicAddr : clinicAddr?.city || "";
            if (!String(clinicCity).toLowerCase().includes(cityNeedle)) return;
        }

        let distance = null;
        if (lat && lng && data.geolocation) {
            distance = calculateDistanceKM(Number(lat), Number(lng), data.geolocation.lat, data.geolocation.lng);
            if (distance > Number(radiusKm)) return;
        }

        doctors.push({
            doctorId: doc.id,
            name: data.name,
            clinicName: data.clinicName || "AyurSutra Network Clinic",
            address: data.clinicAddress,
            distanceKm: distance ? Number(distance.toFixed(1)) : null,
            rating: data.rating,
            experience: data.yearsOfExperience,
            gender: data.gender,
            therapies: data.supportedTherapies || data.therapiesOffered || [],
        });
    });

    doctors.sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        return (b.rating || 0) - (a.rating || 0);
    });

    return doctors;
}

export async function bookPatientRequest(body) {
    const {
        patientId,
        patientName,
        patientEmail,
        doctorId,
        doctorName,
        clinicName,
        therapy,
        scheduledSlots,
        intakeId,
        severity,
        dosha,
        reason,
        clinical_summary,
        precautions_pre,
        precautions_post,
    } = body;

    if (!patientId || !doctorId || !therapy) {
        const err = new Error("Missing required booking fields (patientId, doctorId, therapy)");
        err.statusCode = 400;
        throw err;
    }

    const now = new Date().toISOString();
    const requestedSlotTimesRaw = Array.isArray(scheduledSlots) ? scheduledSlots : [];
    const requestedSlotTimes = requestedSlotTimesRaw
        .map((s) => normalizeToDoctorGridIso(String(s), SLOT_DURATION_MINUTES))
        .filter(Boolean);
    if (requestedSlotTimes.length === 0) {
        const err = new Error("At least one scheduled slot is required");
        err.statusCode = 400;
        throw err;
    }

    const { totalScore: computedPriority } = calculatePriorityScore({
        severityScore: Number(severity) || 5,
        feedbackEscalation: false,
        feedbackMultiplier: 1.0,
        dosha: dosha || "",
        slotDatetime: requestedSlotTimes[0] || null,
        createdAt: now,
    });
    const trustedPriority = computedPriority;
    // SINGLE SOURCE OF TRUTH: day-wise priority queue rebuild.
    // We create ONE appointment, then create sessions via rebuildDoctorDayQueue per intended day.
    const appointmentRef = db.collection("appointments").doc();

    // Compute intended days from requested slots (already spacing-driven by /scheduling/slots).
    const intended = requestedSlotTimes
        .map((iso, idx) => ({ iso, idx, dayKey: istDayKeyFromIso(iso) }))
        .filter((x) => x.dayKey);

    if (intended.length === 0) {
        const err = new Error("Unable to compute intended IST day keys for slots");
        err.statusCode = 400;
        throw err;
    }

    // Persist appointment shell first (slots filled after queue rebuild).
    await appointmentRef.set({
        patientId,
        patientName: patientName || "Patient",
        patientEmail: patientEmail || "",
        doctorId,
        doctorName: doctorName || "",
        clinicName: clinicName || "",
        therapy,
        scheduledSlots: [],
        totalSessions: intended.length,
        intakeId: intakeId || null,
        status: "pending",
        priority: trustedPriority,
        totalPriorityScore: trustedPriority,
        severity: Number(severity) || 5,
        dosha: dosha || "Unknown",
        reason: reason || "",
        createdAt: now,
        updatedAt: now,
    });

    // Group incoming sessions by intended IST day key.
    const byDay = new Map();
    for (const it of intended) {
        const arr = byDay.get(it.dayKey) || [];
        arr.push(it);
        byDay.set(it.dayKey, arr);
    }

    const createdSessionIds = [];
    const allChanged = [];

    // Process days in chronological order for stability.
    const dayKeys = [...byDay.keys()].sort();
    for (const dayKey of dayKeys) {
        const items = (byDay.get(dayKey) || []).sort((a, b) => a.idx - b.idx);
        const incomingEntries = items.map((x) => ({
            appointmentId: appointmentRef.id,
            priorityScore: trustedPriority,
            createdAt: now,
            baseDoc: {
                patient_id: patientId,
                patient_name: patientName || "Patient",
                patient_email: patientEmail || "",
                practitioner_id: doctorId,
                doctor_name: doctorName || "",
                clinic_name: clinicName || "",
                appointment_id: appointmentRef.id,
                intake_id: intakeId || null,
                therapy,
                duration_minutes: 90,
                status: "pending_review",
                doctor_approval: "pending",
                severity_score: Number(severity) || 5,
                dosha: dosha || "Unknown",
                reason: reason || "",
                clinical_summary: clinical_summary || "",
                precautions_pre: precautions_pre || [],
                precautions_post: precautions_post || [],
                feedback_escalation: false,
                feedback_multiplier: 1.0,
                session_number: x.idx + 1,
                total_sessions: intended.length,
                created_at: now,
            },
        }));

        const res = await rebuildDoctorDayQueue(doctorId, dayKey, incomingEntries);
        createdSessionIds.push(...(res.createdSessionIds || []));
        allChanged.push(...(res.changed || []));
    }

    // Update appointment scheduledSlots from created session docs.
    // (Source of truth is sessions.datetime; no separate slot state.)
    const sessSnap2 = await db
        .collection("sessions")
        .where("appointment_id", "==", appointmentRef.id)
        .get();
    const slots = [];
    sessSnap2.forEach((d) => {
        const s = d.data() || {};
        if (s.datetime) slots.push(String(s.datetime));
    });
    slots.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    await appointmentRef.update({
        scheduledSlots: slots,
        totalSessions: slots.length,
        updatedAt: now,
    });

    // Notify auto-rescheduled patients (diff-based).
    try {
        const notificationsModules = await import("../routes/notifications.js");
        const sendEmail = notificationsModules.sendEmail;
        for (const c of allChanged) {
            if (!c.oldDatetime || c.oldDatetime === c.newDatetime) continue;
            const sSnap = await db.collection("sessions").doc(c.sessionId).get();
            if (!sSnap.exists) continue;
            const s = sSnap.data() || {};
            const pEmail = s.patient_email || null;
            const pId = s.patient_id || null;
            const pName = s.patient_name || "Patient";
            const th = s.therapy || "session";
            if (sendEmail && pEmail) {
                await sendEmail({
                    to: pEmail,
                    subject: `🌿 Session Auto-Rescheduled — ${th}`,
                    html: `<p>Namaste ${pName},</p>
                          <p>Your <b>${th}</b> session was moved due to a higher-priority case.</p>
                          <p><b>Previous:</b> ${new Date(c.oldDatetime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</p>
                          <p><b>New:</b> ${new Date(c.newDatetime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</p>
                          <p>If this does not work for you, you can request a reschedule in the app.</p>`,
                });
            }
            if (pId) {
                await createInAppNotification({
                    userId: pId,
                    title: "Session auto-rescheduled",
                    body: `Your ${th} session moved to ${new Date(c.newDatetime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}.`,
                    sender: "system",
                });
            }
        }
    } catch (e) {
        console.error("Auto-reschedule notifications failed:", e.message);
    }

    // Doctor notification for new booking
    try {
        const doctorDoc = await db.collection("users").doc(doctorId).get();
        const doctorEmail = doctorDoc.exists ? doctorDoc.data()?.email : null;
        const notificationsModules = await import("../routes/notifications.js");
        const sendEmail = notificationsModules.sendEmail;
        if (sendEmail && doctorEmail) {
            await sendEmail({
                to: doctorEmail,
                subject: `🌿 New Booking Request — ${patientName}`,
                html: `<p>Namaste Dr. ${doctorName || "Practitioner"},</p>
                       <p><b>${patientName || "Patient"}</b> requested <b>${therapy}</b>.</p>
                       <p><b>Priority (server):</b> ${trustedPriority} | <b>Sessions:</b> ${intended.length}</p>
                       <p>Please review and approve/decline from your dashboard.</p>`,
            });
        }
        await createInAppNotification({
            userId: doctorId,
            title: "New booking request",
            body: `${patientName || "Patient"} requested ${therapy}.`,
            sender: "patient",
        });
    } catch (e) {
        console.error("Doctor notification failed:", e.message);
    }

    return {
        appointmentId: appointmentRef.id,
        sessionIds: createdSessionIds,
        trustedPriority,
    };
}
