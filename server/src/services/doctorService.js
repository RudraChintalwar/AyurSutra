/**
 * Doctor domain — business logic (MVC: Model + rules live here; routes are thin).
 * Handles onboarding, proximity search, and prioritized booking with collision bump.
 */
import { admin } from "../middleware/auth.js";
import { calculatePriorityScore } from "../utils/priorityQueue.js";
import * as slotBlocks from "./slotBlockService.js";

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
    const requestedSlotTimes = Array.isArray(scheduledSlots) ? scheduledSlots : [];
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

    const bumpMessage = "A critical case required your time slot. Please reschedule.";
    const appointmentsToBump = new Map();
    const orphanSessionsToBump = new Map();

    const apptSnap = await db
        .collection("appointments")
        .where("doctorId", "==", doctorId)
        .where("status", "in", ACTIVE_APPOINTMENT_STATUSES)
        .get();

    apptSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const intersection = appointmentSlotIntersections(requestedSlotTimes, data.scheduledSlots || []);
        if (intersection.length > 0) {
            appointmentsToBump.set(docSnap.id, {
                id: docSnap.id,
                ref: docSnap.ref,
                data,
                collisionSlots: intersection,
                existingPriority: numericPriorityFromFirestore(data),
            });
        }
    });

    const sessSnap = await db
        .collection("sessions")
        .where("practitioner_id", "==", doctorId)
        .where("status", "in", BLOCKING_SESSION_STATUSES)
        .get();

    sessSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const dt = data.datetime || data.scheduled_date;
        if (!dt) return;
        if (String(data.patient_id) === String(patientId)) return;
        if (!requestedSlotConflictsWithTime(requestedSlotTimes, dt)) return;

        const apptId = data.appointment_id;
        if (apptId) {
            if (!appointmentsToBump.has(apptId)) {
                appointmentsToBump.set(apptId, {
                    id: apptId,
                    ref: db.collection("appointments").doc(apptId),
                    data: null,
                    collisionSlots: [dt],
                    existingPriority: numericPriorityFromFirestore(data),
                    fromSession: docSnap.id,
                });
            }
        } else {
            orphanSessionsToBump.set(docSnap.id, {
                id: docSnap.id,
                ref: docSnap.ref,
                data,
                existingPriority: numericPriorityFromFirestore(data),
            });
        }
    });

    async function promoteSessionToOrphanIfNeeded(entry) {
        if (!entry.fromSession) return;
        const sd = await db.collection("sessions").doc(entry.fromSession).get();
        if (!sd.exists) return;
        const d = sd.data();
        orphanSessionsToBump.set(sd.id, {
            id: sd.id,
            ref: sd.ref,
            data: d,
            existingPriority: numericPriorityFromFirestore(d),
        });
    }

    for (const [apptId, entry] of [...appointmentsToBump.entries()]) {
        if (entry.data != null) continue;
        const apptDoc = await db.collection("appointments").doc(apptId).get();
        if (!apptDoc.exists) {
            await promoteSessionToOrphanIfNeeded(entry);
            appointmentsToBump.delete(apptId);
            continue;
        }
        const ad = apptDoc.data();
        if (!ACTIVE_APPOINTMENT_STATUSES.includes(ad.status)) {
            await promoteSessionToOrphanIfNeeded(entry);
            appointmentsToBump.delete(apptId);
            continue;
        }
        entry.data = ad;
        entry.existingPriority = numericPriorityFromFirestore(ad);
        const fromApptSlots = appointmentSlotIntersections(requestedSlotTimes, ad.scheduledSlots || []);
        if (fromApptSlots.length > 0) {
            entry.collisionSlots = fromApptSlots;
        }
    }

    for (const [, slot] of appointmentsToBump) {
        if (trustedPriority <= slot.existingPriority) {
            const err = new Error(
                "Time slot collision detected with a higher or equal priority patient."
            );
            err.statusCode = 409;
            err.collidedSlots = slot.collisionSlots || [];
            throw err;
        }
    }
    for (const [, slot] of orphanSessionsToBump) {
        if (trustedPriority <= slot.existingPriority) {
            const err = new Error(
                "Time slot collision detected with a higher or equal priority patient."
            );
            err.statusCode = 409;
            err.collidedSlots = [slot.data?.datetime];
            throw err;
        }
    }

    const bumpedAppointments = [];
    const batch = db.batch();
    const durationMinutesForNewSession = String(therapy).includes("Vamana") ? 120 : 90;

    for (const [, slot] of appointmentsToBump) {
        const freeIsos = slot.data?.scheduledSlots?.length
            ? slot.data.scheduledSlots
            : slot.collisionSlots || [];
        const delDuration =
            String(slot.data?.therapy || therapy).includes("Vamana") ? 120 : 90;
        slotBlocks.addDeletesForDoctorSlots(batch, db, doctorId, freeIsos, delDuration);
    }
    for (const [, slot] of orphanSessionsToBump) {
        const dt = slot.data?.datetime || slot.data?.scheduled_date;
        if (!dt) continue;
        const parsed = Number(slot.data?.duration_minutes ?? slot.data?.durationMinutes);
        const delDuration =
            Number.isFinite(parsed) && parsed > 0
                ? parsed
                : String(slot.data?.therapy || therapy).includes("Vamana")
                  ? 120
                  : 90;
        slotBlocks.addDeletesForDoctorSlots(batch, db, doctorId, [dt], delDuration);
    }

    for (const [apptId, slot] of appointmentsToBump) {
        batch.update(slot.ref, {
            status: "reschedule_required",
            bumpedByPriority: true,
            bumpMessage,
            bumpedAt: now,
        });
        bumpedAppointments.push({ ...slot.data, id: apptId, patientEmail: slot.data?.patientEmail });

        const related = await db.collection("sessions").where("appointment_id", "==", apptId).get();
        related.forEach((sd) => {
            batch.update(sd.ref, {
                status: "reschedule_requested",
                bumpedByPriority: true,
                bumpMessage,
                doctor_approval: "pending",
            });
        });
    }

    for (const [, slot] of orphanSessionsToBump) {
        batch.update(slot.ref, {
            status: "reschedule_requested",
            bumpedByPriority: true,
            bumpMessage,
            doctor_approval: "pending",
        });
    }

    const appointmentRef = db.collection("appointments").doc();
    const appointmentDoc = {
        patientId,
        patientName: patientName || "Patient",
        patientEmail: patientEmail || "",
        doctorId,
        doctorName: doctorName || "",
        clinicName: clinicName || "",
        therapy,
        scheduledSlots: requestedSlotTimes,
        totalSessions: requestedSlotTimes.length,
        intakeId: intakeId || null,
        status: "pending",
        priority: trustedPriority,
        totalPriorityScore: trustedPriority,
        severity: Number(severity) || 5,
        dosha: dosha || "Unknown",
        reason: reason || "",
        createdAt: now,
    };
    batch.set(appointmentRef, appointmentDoc);

    const sessionIds = [];
    for (let i = 0; i < requestedSlotTimes.length; i++) {
        const sessionRef = db.collection("sessions").doc();
        sessionIds.push(sessionRef.id);
        slotBlocks.addOccupancyWrite(batch, db, {
            doctorId,
            iso: requestedSlotTimes[i],
            appointmentId: appointmentRef.id,
            sessionId: sessionRef.id,
            patientId,
            priority: trustedPriority,
            therapy,
            durationMinutes: durationMinutesForNewSession,
            status: "pending_review",
            updatedAt: now,
        });
        batch.set(sessionRef, {
            patient_id: patientId,
            patient_name: patientName || "Patient",
            patient_email: patientEmail || "",
            practitioner_id: doctorId,
            doctor_name: doctorName || "",
            clinic_name: clinicName || "",
            appointment_id: appointmentRef.id,
            intake_id: intakeId || null,
            therapy,
            datetime: requestedSlotTimes[i],
            session_number: i + 1,
            total_sessions: requestedSlotTimes.length,
            duration_minutes: durationMinutesForNewSession,
            status: "pending_review",
            doctor_approval: "pending",
            priority: trustedPriority,
            totalPriorityScore: trustedPriority,
            severity_score: Number(severity) || 5,
            dosha: dosha || "Unknown",
            reason: reason || "",
            clinical_summary: clinical_summary || "",
            precautions_pre: precautions_pre || [],
            precautions_post: precautions_post || [],
            feedback_escalation: false,
            feedback_multiplier: 1.0,
            created_at: now,
        });
    }

    await batch.commit();

    try {
        const notificationsModules = await import("../routes/notifications.js");
        const sendEmail = notificationsModules.sendEmail;
        if (sendEmail) {
            for (const bumped of bumpedAppointments) {
                if (bumped.patientEmail) {
                    await sendEmail({
                        to: bumped.patientEmail,
                        subject: `🌿 Schedule Update Required — ${bumped.therapy || therapy}`,
                        html: `<p>Namaste ${bumped.patientName},</p>
                                <p>Due to a higher-priority clinical need, Dr. ${doctorName} has had to reschedule your upcoming <b>${bumped.therapy || therapy}</b> session(s).</p>
                                <p>Please log in to your dashboard to select new times.</p>`,
                    });
                }
            }
            for (const [, os] of orphanSessionsToBump) {
                const em = os.data?.patient_email;
                if (em) {
                    await sendEmail({
                        to: em,
                        subject: `🌿 Schedule Update Required`,
                        html: `<p>Namaste ${os.data?.patient_name || "Patient"},</p>
                                <p>A higher-priority case required your time slot. Please choose a new time in your dashboard.</p>`,
                    });
                }
            }
        }
    } catch (bumpErr) {
        console.error("Bump notifications failed:", bumpErr.message);
    }

    try {
        const doctorDoc = await db.collection("users").doc(doctorId).get();
        const doctorEmail = doctorDoc.exists ? doctorDoc.data()?.email : null;
        if (doctorEmail) {
            const notificationsModules = await import("../routes/notifications.js");
            const sendEmail = notificationsModules.sendEmail;
            if (sendEmail) {
                await sendEmail({
                    to: doctorEmail,
                    subject: `🌿 New Booking Request — ${patientName}`,
                    html: `<p>Namaste Dr. ${doctorName},</p>
                            <p><b>${patientName}</b> has requested <b>${therapy}</b>.</p>
                            <p><b>Computed priority (server):</b> ${trustedPriority} | <b>Sessions:</b> ${requestedSlotTimes.length}</p>
                            <p>Please review and approve or decline from your dashboard.</p>`,
                });
            }
        }
    } catch (notifErr) {
        console.error("Doctor notification failed:", notifErr.message);
    }

    return {
        appointmentId: appointmentRef.id,
        sessionIds,
        trustedPriority,
    };
}
