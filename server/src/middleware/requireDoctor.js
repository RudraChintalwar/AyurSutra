import { admin } from "./auth.js";

const db = admin.firestore();

/** After verifyFirebaseIdToken — requires users/{uid}.role === "doctor". */
export async function requireDoctor(req, res, next) {
    try {
        const snap = await db.collection("users").doc(req.firebaseUid).get();
        if (!snap.exists) {
            return res.status(403).json({ success: false, error: "Doctor access required" });
        }
        const data = snap.data() || {};
        const role = data.role;
        const looksDoctor =
            !!data.license ||
            !!data.specialization ||
            !!data.clinicAddress ||
            (Array.isArray(data.supportedTherapies) && data.supportedTherapies.length > 0);

        if (role !== "doctor" && !looksDoctor) {
            return res.status(403).json({ success: false, error: "Doctor access required" });
        }
        next();
    } catch (e) {
        console.error("requireDoctor:", e.message);
        return res.status(500).json({ success: false, error: "Authorization failed" });
    }
}
