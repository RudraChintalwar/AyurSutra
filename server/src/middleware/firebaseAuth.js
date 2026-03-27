import { admin } from "./auth.js";

/** Verifies Firebase ID token; sets req.firebaseUid. */
export async function verifyFirebaseIdToken(req, res, next) {
    try {
        const h = req.headers.authorization;
        if (!h?.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, error: "Missing Authorization Bearer token" });
        }
        const decoded = await admin.auth().verifyIdToken(h.slice(7));
        req.firebaseUid = decoded.uid;
        next();
    } catch (e) {
        return res.status(401).json({ success: false, error: "Invalid or expired Firebase ID token" });
    }
}
