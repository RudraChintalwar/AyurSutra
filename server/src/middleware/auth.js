import admin from "firebase-admin";
import fs from "fs";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const hasEnvCert =
        process.env.FIREBASE_PRIVATE_KEY &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PROJECT_ID;

    if (serviceAccountPath) {
        try {
            const raw = fs.readFileSync(serviceAccountPath, "utf8");
            const json = JSON.parse(raw);
            admin.initializeApp({
                credential: admin.credential.cert(json),
            });
        } catch (e) {
            // Fall through to other options, but keep a helpful log.
            console.error(
                "[FirebaseAdmin] Failed to load FIREBASE_SERVICE_ACCOUNT_PATH:",
                e.message
            );
        }
    }

    if (!admin.apps.length && hasEnvCert) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
    }

    if (!admin.apps.length && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // ADC using a service account JSON file path
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
    }

    if (!admin.apps.length) {
        // Last-resort init (Auth may work, Firestore will not without credentials)
        admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || "ayursutra-3311d",
        });
        console.warn(
            "[FirebaseAdmin] Initialized without credentials. Firestore/Admin writes will fail. " +
                "Set FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_* cert env vars."
        );
    }
}

/**
 * Express middleware to verify Firebase Auth ID Tokens
 */
export const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Missing or invalid authorization header',
            });
        }

        const token = authHeader.split('Bearer ')[1];
        
        // Verify token with Firebase Admin
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Attach user info to request
        req.user = decodedToken;
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: Token verification failed',
        });
    }
};

export { admin };
