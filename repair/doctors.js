import express from 'express';
import { admin } from '../middleware/auth.js';
import { calculatePriorityScore } from '../utils/priorityQueue.js'; // ISSUE C FIX: recompute priority server-side

const db = admin.firestore();
const router = express.Router();

/**
 * Mock Geocoding Utility
 * Converts an address structured object into latitude and longitude coordinates.
 */
function mockGeocode(addressObj) {
    // Generate deterministic pseudo-random coordinates bounded generally in India region
    // for demonstration/testability purposes.
    let seed = 0;
    if (addressObj && addressObj.city) {
        for (let i = 0; i < addressObj.city.length; i++) {
            seed += addressObj.city.charCodeAt(i);
        }
    }
    
    // Base coordinates roughly somewhere in Central India (e.g. Nagpur area)
    const baseLat = 21.1458;
    const baseLng = 79.0882;
    
    // Adding variations to spread clinics out
    const latOffset = ((seed % 100) / 100) * 10 - 5; // -5 to +5 degrees
    const lngOffset = ((seed % 50) / 50) * 10 - 5;
    
    return {
        lat: Number((baseLat + latOffset).toFixed(4)),
        lng: Number((baseLng + lngOffset).toFixed(4))
    };
}

/**
 * Utility Function: Haversine Distance
 * Calculates distance between two geospatial points in km.
 */
function calculateDistanceKM(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ═══════════════════════════════════════════════════════════
// DOCTOR ONBOARDING API
// POST /api/doctors/register
// ═══════════════════════════════════════════════════════════
router.post('/register', async (req, res) => {
    try {
        // eKYC payload captured during signup flow
        const {
            uid,
            name,
            email,
            clinicName,
            clinicAddress, // { street, area, city, state, pincode }
            gender,
            yearsOfExperience,
            supportedTherapies, // e.g. ["Virechana", "Vamana", "Shirodhara"]
        } = req.body;

        if (!uid || !name || !supportedTherapies || !clinicAddress) {
            return res.status(400).json({ error: "Missing required onboarding fields" });
        }

        // Convert the detailed address into Geo-Coordinates
        const geolocation = mockGeocode(clinicAddress);

        const doctorProfile = {
            role: 'doctor',
            name,
            email,
            clinicName,
            clinicAddress,
            geolocation,
            gender,
            yearsOfExperience: Number(yearsOfExperience) || 0,
            supportedTherapies,
            rating: 5.0, // Default starting rating
            verificationStatus: 'verified', // Auto-verifying in demo
            createdAt: new Date().toISOString()
        };

        // Write to Firebase overriding any existing temp shell
        await db.collection('users').doc(uid).set(doctorProfile, { merge: true });

        res.status(201).json({ 
            success: true, 
            message: "Doctor Multi-Tenant Clinic Registered", 
            geolocation 
        });

    } catch (e) {
        console.error("Doctor Registration Error:", e);
        res.status(500).json({ error: "Failed to onboard doctor profile" });
    }
});

// ═══════════════════════════════════════════════════════════
// PATIENT SMART DOCTOR SEARCH API
// GET /api/doctors/search
// ═══════════════════════════════════════════════════════════
router.get('/search', async (req, res) => {
    try {
        const { 
            requiredTherapy,  // Enforced constraint (from ML)
            city,             // Text match fallback
            lat, lng,         // Patient geolocation 
            radiusKm = 50,    // Spatial expansion limit
            gender,           // Patient preference
            minRating         // Quality constraint filter
        } = req.query;

        // Base Query: Must be a verified doctor
        let queryRef = db.collection('users').where('role', '==', 'doctor');

        // Note: Firebase Firestore allows only one array-contains or IN per query.
        // It's highly optimized to filter the exact therapy first since therapy availability is a hard stop constraint.
        if (requiredTherapy) {
            // Check if the doctor's supported skill array has the ML-suggested treatment
            queryRef = queryRef.where('supportedTherapies', 'array-contains', requiredTherapy);
        }

        // Filter Gender cleanly
        if (gender && gender !== 'Any') {
            queryRef = queryRef.where('gender', '==', gender);
        }

        const snapshot = await queryRef.get();
        let doctors = [];

        snapshot.forEach(doc => {
            const data = doc.data();

            // Software filtering for compound constraints
            
            // 1. Min Rating
            if (minRating && data.rating < Number(minRating)) return;

            // 2. City Text-Match Filter (if specific coordinates aren't used)
            if (city && data.clinicAddress && data.clinicAddress.city !== city) {
                // Allows partial case-insensitive match just in case
                if (!data.clinicAddress.city.toLowerCase().includes(city.toLowerCase())) return;
            }

            let distance = null;

            // 3. Radius Geolocation filtering
            if (lat && lng && data.geolocation) {
                distance = calculateDistanceKM(
                    Number(lat), Number(lng),
                    data.geolocation.lat, data.geolocation.lng
                );

                if (distance > Number(radiusKm)) return;
            }

            doctors.push({
                doctorId: doc.id,
                name: data.name,
                clinicName: data.clinicName || 'AyurSutra Network Clinic',
                address: data.clinicAddress,
                distanceKm: distance ? Number(distance.toFixed(1)) : null,
                rating: data.rating,
                experience: data.yearsOfExperience,
                gender: data.gender,
                therapies: data.supportedTherapies
            });
        });

        // Final Sort by Proximity (or rating if no proximity provided)
        doctors.sort((a, b) => {
            if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
            return b.rating - a.rating;
        });

        res.json({ success: true, count: doctors.length, doctors });

    } catch (e) {
        console.error("Doctor Smart Search Error:", e);
        res.status(500).json({ error: "Failed to search network" });
    }
});

// ═══════════════════════════════════════════════════════════
// PATIENT BOOKING REQUEST
// POST /api/doctors/book
// ═══════════════════════════════════════════════════════════
router.post('/book', async (req, res) => {
    try {
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
            priority,
            severity,
            dosha,
            reason,
        } = req.body;

        if (!patientId || !doctorId || !therapy) {
            return res.status(400).json({ error: "Missing required booking fields (patientId, doctorId, therapy)" });
        }

        const now = new Date().toISOString();

        // ─── ISSUE C FIX: Recompute priority server-side ─────────────────────
        // Before: used `priority` directly from req.body — any client could send
        // priority:100 and bump every existing patient.
        // After: recalculate using the canonical formula. The client-sent
        // severity (1-10) and dosha are the only inputs we trust from the body;
        // everything else is derived here.
        const { totalScore: computedPriority } = calculatePriorityScore({
            severityScore:      Number(severity) || 5,
            feedbackEscalation: false,  // new bookings start with no escalation
            feedbackMultiplier: 1.0,
            dosha:              dosha || '',
            slotDatetime:       (scheduledSlots || [])[0] || null,
            createdAt:          now,
        });
        // Use computed value — ignore any priority sent by the client
        const trustedPriority = computedPriority;
        const requestedSlotTimes = scheduledSlots || [];
        let bumpedAppointments = [];
        
        if (requestedSlotTimes.length > 0) {
            // Check for existing approved or pending appointments for this doctor at these exact times
            const existingAppointmentsRef = db.collection('appointments')
                .where('doctorId', '==', doctorId)
                .where('status', 'in', ['approved', 'pending']);
                
            const existingSnap = await existingAppointmentsRef.get();
            const collisions = [];
            
            existingSnap.docs.forEach(doc => {
                const data = doc.data();
                // Find intersection of requested slots and existing slots
                const intersection = (data.scheduledSlots || []).filter(slot => requestedSlotTimes.includes(slot));
                if (intersection.length > 0) {
                    collisions.push({ id: doc.id, ...data, collisionSlots: intersection });
                }
            });

            // Priority checking — uses server-computed trustedPriority, not client-sent value
            for (const collision of collisions) {
                const existingPriority = collision.priority || 50;
                
                if (trustedPriority > existingPriority) {
                    bumpedAppointments.push(collision);
                    await db.collection('appointments').doc(collision.id).update({ 
                        status: 'reschedule_required',
                        bumpedByPriority: true,
                        bumpMessage: 'A critical case required your time slot. Please reschedule.'
                    });
                } else {
                    return res.status(409).json({ 
                        error: "Time slot collision detected with a higher or equal priority patient.",
                        collidedSlots: collision.collisionSlots 
                    });
                }
            }
        }

        // 2. Create appointment document
        const appointmentRef = db.collection('appointments').doc();
        const appointmentDoc = {
            patientId,
            patientName: patientName || 'Patient',
            patientEmail: patientEmail || '',
            doctorId,
            doctorName: doctorName || '',
            clinicName: clinicName || '',
            therapy,
            scheduledSlots: requestedSlotTimes,
            totalSessions: requestedSlotTimes.length,
            intakeId: intakeId || null,
            status: 'pending',
            priority: trustedPriority,        // ISSUE C FIX: server-computed, not client-sent
            totalPriorityScore: trustedPriority,
            severity: Number(severity) || 5,
            dosha: dosha || 'Unknown',
            reason: reason || '',
            createdAt: now,
        };
        await appointmentRef.set(appointmentDoc);

        // 3. Update existing session docs to assign practitioner_id
        if (patientId) {
            const sessionsSnap = await db.collection('sessions')
                .where('patient_id', '==', patientId)
                .where('status', '==', 'pending_review')
                .get();

            const batch = db.batch();
            sessionsSnap.docs.forEach(sessionDoc => {
                batch.update(sessionDoc.ref, {
                    practitioner_id: doctorId,
                    doctor_name: doctorName || '',
                    clinic_name: clinicName || '',
                    appointment_id: appointmentRef.id,
                });
            });
            await batch.commit();
        }

        // 4. Send notification to bumped patients (if any)
        try {
            const notificationsModules = await import('./notifications.js');
            const sendEmail = notificationsModules.sendEmail;
            if (sendEmail) {
                for (const bumped of bumpedAppointments) {
                    if (bumped.patientEmail) {
                        await sendEmail({
                            to: bumped.patientEmail,
                            subject: `🌿 Schedule Update Required — ${bumped.therapy}`,
                            html: `<p>Namaste ${bumped.patientName},</p>
                                <p>Due to a critical Ayurvedic emergency, Dr. ${doctorName} has had to reschedule your upcoming <b>${bumped.therapy}</b> session(s).</p>
                                <p>Please log in to your dashboard to select new comfortable times.</p>`
                        });
                    }
                }
            }
        } catch (bumpErr) {
            console.error("Bump notifications failed:", bumpErr.message);
        }

        // 3. Send notification to doctor (best-effort)
        try {
            const doctorDoc = await db.collection('users').doc(doctorId).get();
            const doctorEmail = doctorDoc.exists ? doctorDoc.data()?.email : null;
            if (doctorEmail) {
                // Fire-and-forget notification
                const notificationsModules = await import('./notifications.js');
                const sendEmail = notificationsModules.sendEmail;
                if (sendEmail) {
                    await sendEmail({
                    to: doctorEmail,
                    subject: `🌿 New Booking Request — ${patientName}`,
                    html: `<p>Namaste Dr. ${doctorName},</p>
                        <p><b>${patientName}</b> has requested a <b>${therapy}</b> session.</p>
                        <p><b>Priority:</b> ${priority || 'N/A'} | <b>Sessions:</b> ${(scheduledSlots || []).length}</p>
                        <p>Please review and approve/decline from your dashboard. 🙏</p>`
                    });
                }
            }
        } catch (notifErr) {
            console.error("Doctor notification failed:", notifErr.message);
        }

        res.status(201).json({
            success: true,
            appointmentId: appointmentRef.id,
            message: `Booking request sent to ${doctorName || 'doctor'} for ${therapy}`,
        });

    } catch (e) {
        console.error("Booking Error:", e);
        res.status(500).json({ error: "Failed to create booking" });
    }
});

export default router;
