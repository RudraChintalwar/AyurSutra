/**
 * Doctors HTTP layer — delegates to doctorService (MVC: Controller).
 */
import * as doctorService from "../services/doctorService.js";

export async function register(req, res) {
    try {
        const { uid } = req.body || {};
        if (uid && req.firebaseUid && uid !== req.firebaseUid) {
            return res.status(403).json({ error: "Forbidden: uid mismatch" });
        }
        const { geolocation } = await doctorService.registerDoctor(req.body);
        res.status(201).json({
            success: true,
            message: "Doctor Multi-Tenant Clinic Registered",
            geolocation,
        });
    } catch (e) {
        console.error("Doctor Registration Error:", e);
        if (e.statusCode === 400) {
            return res.status(400).json({ error: e.message });
        }
        res.status(500).json({ error: "Failed to onboard doctor profile" });
    }
}

export async function search(req, res) {
    try {
        const broad =
            req.query.broad === "1" ||
            req.query.broad === "true" ||
            String(req.query.broad).toLowerCase() === "yes";
        const doctors = await doctorService.searchDoctors(req.query, { broad });
        res.json({ success: true, count: doctors.length, doctors });
    } catch (e) {
        console.error("Doctor Smart Search Error:", e);
        res.status(500).json({ error: "Failed to search network" });
    }
}

export async function book(req, res) {
    try {
        const { patientId } = req.body || {};
        if (!patientId) {
            return res.status(400).json({ error: "patientId is required" });
        }
        if (req.firebaseUid && patientId !== req.firebaseUid) {
            return res.status(403).json({ error: "Forbidden: patientId mismatch" });
        }

        const {
            doctorName,
            patientName,
            therapy,
        } = req.body;

        const {
            appointmentId,
            sessionIds,
        } = await doctorService.bookPatientRequest(req.body);

        res.status(201).json({
            success: true,
            appointmentId,
            sessionIds,
            message: `Booking request sent to ${doctorName || "doctor"} for ${therapy}`,
        });
    } catch (e) {
        console.error("Booking Error:", e);
        if (e.statusCode === 400) {
            return res.status(400).json({ error: e.message });
        }
        if (e.statusCode === 409) {
            return res.status(409).json({
                error: e.message,
                collidedSlots: e.collidedSlots || [],
            });
        }
        res.status(500).json({ error: "Failed to create booking" });
    }
}

export async function bookByDoctor(req, res) {
    try {
        const {
            doctorId,
            patientId,
            patientName,
            therapy,
        } = req.body || {};

        if (!patientId || !doctorId) {
            return res.status(400).json({ error: "patientId and doctorId are required" });
        }
        if (req.firebaseUid && doctorId !== req.firebaseUid) {
            return res.status(403).json({ error: "Forbidden: doctorId mismatch" });
        }

        const {
            appointmentId,
            sessionIds,
        } = await doctorService.bookPatientRequest(req.body);

        res.status(201).json({
            success: true,
            appointmentId,
            sessionIds,
            message: `Doctor booked ${therapy} for ${patientName || "patient"}`,
        });
    } catch (e) {
        console.error("Doctor Booking Error:", e);
        if (e.statusCode === 400) {
            return res.status(400).json({ error: e.message });
        }
        if (e.statusCode === 409) {
            return res.status(409).json({
                error: e.message,
                collidedSlots: e.collidedSlots || [],
            });
        }
        res.status(500).json({ error: "Failed to create doctor booking" });
    }
}
