import { initializeApp, getApps, getApp } from "firebase/app";
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate that all required config values are present
const requiredKeys = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
] as const;
for (const key of requiredKeys) {
    if (!firebaseConfig[key]) {
        console.error(
            `Missing Firebase config: ${key}. Check your .env file.`
        );
    }
}

// Initialize Firebase (prevent duplicate initialization)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Auth with local persistence
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

// Firestore
export const db = getFirestore(app);

// Storage
export const storage = getStorage(app);

export default app;
