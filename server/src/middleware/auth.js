import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    if (process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
    } else {
        // Fallback for default credentials (e.g. deployed to GCP)
        admin.initializeApp();
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
