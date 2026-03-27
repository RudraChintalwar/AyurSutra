import { admin } from "./auth.js";

const db = admin.firestore();

/** After verifyFirebaseIdToken — requires users/{uid}.role === "patient". */
export async function requirePatient(req, res, next) {
    try {
        const snap = await db.collection("users").doc(req.firebaseUid).get();
        if (!snap.exists) {
            return res.status(403).json({ success: false, error: "Patient access required" });
        }
        const data = snap.data() || {};
        const role = data.role;
        const looksPatient =
            !!data.dosha ||
            !!data.reason_for_visit ||
            (Array.isArray(data.symptoms) && data.symptoms.length > 0) ||
            !!data.llm_recommendation;

        if (role !== "patient" && !looksPatient) {
            return res.status(403).json({ success: false, error: "Patient access required" });
        }
        next();
    } catch (e) {
        console.error("requirePatient:", e.message);
        return res.status(500).json({ success: false, error: "Authorization failed" });
    }
}

