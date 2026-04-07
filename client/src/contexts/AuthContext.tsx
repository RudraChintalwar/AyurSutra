import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ─── Types ───────────────────────────────────────────────
export type UserRole = "patient" | "doctor" | "admin" | null;

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  // Patient-specific
  dosha?: string;
  doshaScores?: { vata: number; pitta: number; kapha: number };
  healthScore?: number;
  age?: number;
  gender?: string;
  quizCompleted?: boolean;
  reason_for_visit?: string;
  symptoms?: Array<{ name: string; score: number }>;
  llm_recommendation?: {
    therapy: string;
    sessions_recommended: number;
    spacing_days: number;
    priority_score: number;
    explanation: string;
  };
  // Doctor-specific
  license?: string;
  specialization?: string;
  clinicAddress?: string;
  therapiesOffered?: string[];
  supportedTherapies?: string[];
  expertiseSymptoms?: string[];
  rating?: number;
  yearsOfExperience?: number;
  isAdmin?: boolean;
  
  // Location Data
  location?: string;
  geolocation?: { lat: number; lng: number };

  /** @deprecated Use calendar link flow; not stored in Firestore anymore */
  googleAccessToken?: string;
  /** Set by server after /api/calendar/oauth/callback */
  calendarSyncConnected?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  role: UserRole;
  loading: boolean;
  signInWithGoogle: () => Promise<{ isNewUser: boolean }>;
  registerWithGoogle: (
    role: UserRole,
    profileData: Partial<UserProfile>
  ) => Promise<{ alreadyExists: boolean }>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  getGoogleAccessToken: () => string | null;
  /** Opens Google OAuth to store refresh token server-side (primary calendar + notifications). */
  linkGoogleCalendar: () => Promise<void>;
  /** Clears server-stored tokens and calendarSyncConnected. */
  unlinkGoogleCalendar: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// ─── Helper: Firestore write with timeout ────────────────
const firestoreWriteWithTimeout = async (
  ref: ReturnType<typeof doc>,
  data: Record<string, unknown>,
  options?: { merge: boolean },
  timeoutMs = 5000
): Promise<boolean> => {
  try {
    // Strip undefined values to prevent Firestore validation errors
    const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined) acc[key] = value;
      return acc;
    }, {} as Record<string, unknown>);

    await Promise.race([
      options ? setDoc(ref, cleanedData, options) : setDoc(ref, cleanedData),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firestore timeout")), timeoutMs)
      ),
    ]);
    return true;
  } catch (err) {
    console.error("Firestore write failed:", err);
    throw err; // Actually throw to fail signup!
  }
};

// ─── Provider ────────────────────────────────────────────
interface AuthProviderProps {
  children: ReactNode;
}

// Google Auth Provider with Calendar scope (Firebase Auth)
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
// Avoid forcing account-picker on every login; keeps returning-user flow stable.
googleProvider.setCustomParameters({ prompt: "consent" });

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  const deriveRoleFromDoc = (data: Record<string, any>): UserRole => {
    if (data?.role === "doctor" || data?.role === "patient" || data?.role === "admin") return data.role;
    const looksDoctor =
      !!data?.license ||
      !!data?.specialization ||
      !!data?.clinicAddress ||
      (Array.isArray(data?.supportedTherapies) && data.supportedTherapies.length > 0);
    if (looksDoctor) return "doctor";
    const looksPatient =
      !!data?.dosha ||
      !!data?.reason_for_visit ||
      (Array.isArray(data?.symptoms) && data.symptoms.length > 0) ||
      !!data?.llm_recommendation;
    if (looksPatient) return "patient";
    const looksAdmin =
      data?.isAdmin === true ||
      String(data?.email || "").toLowerCase() ===
        String(import.meta.env.VITE_EMART_ADMIN_EMAIL || "").toLowerCase();
    if (looksAdmin) return "admin";
    return null;
  };

  // Fetch user profile from Firestore (with timeout)
  const fetchUserProfile = async (
    fbUser: FirebaseUser
  ): Promise<UserProfile | null> => {
    try {
      // Note: Removed tight 3000ms timeout. Firebase cold starts or slow networks can easily 
      // exceed 3s, falsely triggering "user not found" for returning valid Google Login users.
      const result = await getDoc(doc(db, "users", fbUser.uid));

      if (result && result.exists()) {
        const data = result.data();
        const resolvedRole = deriveRoleFromDoc(data);
        if (data.googleAccessToken) {
          setGoogleAccessToken(data.googleAccessToken);
        } else {
          setGoogleAccessToken(null);
        }
        return {
          uid: fbUser.uid,
          name: data.name || fbUser.displayName || "User",
          email: data.email || fbUser.email || "",
          role: resolvedRole,
          avatar: data.avatar || fbUser.photoURL || undefined,
          phone: data.phone,
          dosha: data.dosha,
          doshaScores: data.doshaScores,
          healthScore: data.healthScore,
          age: data.age,
          gender: data.gender,
          quizCompleted: data.quizCompleted,
          reason_for_visit: data.reason_for_visit,
          symptoms: data.symptoms,
          llm_recommendation: data.llm_recommendation,
          license: data.license,
          specialization: data.specialization,
          googleAccessToken: data.googleAccessToken,
          calendarSyncConnected: data.calendarSyncConnected === true,
          location: data.location,
          geolocation: data.geolocation,
          clinicAddress: data.clinicAddress,
          therapiesOffered: data.therapiesOffered,
          supportedTherapies: data.supportedTherapies,
          expertiseSymptoms: data.expertiseSymptoms,
          rating: data.rating,
          yearsOfExperience: data.yearsOfExperience,
          isAdmin: data.isAdmin === true,
        };
      }
      return null;
    } catch (error) {
      console.warn("Error fetching user profile (will use defaults):", error);
      return null;
    }
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        const profile = await fetchUserProfile(fbUser);
        if (profile) {
          setUser(profile);
          setRole(profile.role);
        } else {
          // User exists in Auth but not in Firestore (new Google sign-in)
          setUser({
            uid: fbUser.uid,
            name: fbUser.displayName || "User",
            email: fbUser.email || "",
            role: null,
            avatar: fbUser.photoURL || undefined,
          });
          setRole(null);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
        setRole(null);
        setGoogleAccessToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─── Auth Methods ────────────────────────────────────

  /** Sign in with Google (returning users) */
  const signInWithGoogleFn = async (): Promise<{ isNewUser: boolean }> => {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || null;

    // Check if user has a Firestore profile with a role
    // Important: Do this BEFORE writing the token to avoid creating an empty skeleton document!
    const profile = await fetchUserProfile(result.user);
    
    if (!profile || !profile.role) {
      // New user: Do not write the token yet (signup will do it).
      // Sign them out of the returning flow so they go through the proper signup flow.
      await firebaseSignOut(auth);
      setUser(null);
      setRole(null);
      setFirebaseUser(null);
      setGoogleAccessToken(null);
      return { isNewUser: true };
    }

    if (token) {
      setGoogleAccessToken(token);
    }

    return { isNewUser: false };
  };

  /** Register with Google (new users — collects profile data first, then triggers popup) */
  const registerWithGoogle = async (
    selectedRole: UserRole,
    profileData: Partial<UserProfile>
  ): Promise<{ alreadyExists: boolean }> => {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || null;

    if (token) {
      setGoogleAccessToken(token);
    }

    const fbUser = result.user;

    // Check if user already has a complete profile in Firestore
    const existingProfile = await fetchUserProfile(fbUser);
    if (existingProfile && existingProfile.role) {
      // User already has an account — set state and return flag
      setUser(existingProfile);
      setRole(existingProfile.role);
      setFirebaseUser(fbUser);
      return { alreadyExists: true };
    }

    // Write full profile to Firestore
    const profileToSave: Record<string, unknown> = {
      name: profileData.name || fbUser.displayName || "User",
      email: fbUser.email || "",
      role: selectedRole,
      avatar: fbUser.photoURL || undefined,
      phone: profileData.phone || undefined,
      age: profileData.age || undefined,
      gender: profileData.gender || undefined,
      location: profileData.location || undefined,
      geolocation: profileData.geolocation || undefined,
      createdAt: serverTimestamp(),
    };

    // Doctor-specific fields  
    if (selectedRole === "doctor") {
      profileToSave.license = profileData.license || "";
      profileToSave.specialization = profileData.specialization || "";
      profileToSave.clinicAddress = profileData.clinicAddress || undefined;
    }

    await firestoreWriteWithTimeout(
      doc(db, "users", fbUser.uid),
      profileToSave
    );

    // Update local state immediately
    const newProfile: UserProfile = {
      uid: fbUser.uid,
      name: (profileData.name || fbUser.displayName || "User") as string,
      email: fbUser.email || "",
      role: selectedRole,
      avatar: fbUser.photoURL || undefined,
      phone: profileData.phone,
      age: profileData.age,
      gender: profileData.gender,
      license: profileData.license,
      specialization: profileData.specialization,
      calendarSyncConnected: false,
      location: profileData.location,
      geolocation: profileData.geolocation,
      clinicAddress: profileData.clinicAddress,
    };
    setUser(newProfile);
    setRole(selectedRole);
    setFirebaseUser(fbUser);
    return { alreadyExists: false };
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setGoogleAccessToken(null);
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!firebaseUser) return;
    const userRef = doc(db, "users", firebaseUser.uid);
    const updateData: Record<string, unknown> = { ...data };
    delete updateData.uid;

    await firestoreWriteWithTimeout(userRef, updateData, { merge: true });

    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...data };
    });
    if (data.role) {
      setRole(data.role as UserRole);
    }
  };

  const getGoogleAccessToken = () => googleAccessToken;

  const refreshProfile = async () => {
    if (!firebaseUser) return;
    const profile = await fetchUserProfile(firebaseUser);
    if (profile) {
      setUser(profile);
      setRole(profile.role);
    }
  };

  const linkGoogleCalendar = async () => {
    if (!firebaseUser) {
      throw new Error("Not signed in");
    }
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
    const idToken = await firebaseUser.getIdToken(true);
    const res = await fetch(`${API_URL}/api/calendar/oauth/start`, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Could not start Google Calendar linking");
    }
    if (data.authUrl) {
      window.location.href = data.authUrl;
    }
  };

  const unlinkGoogleCalendar = async () => {
    if (!firebaseUser) {
      throw new Error("Not signed in");
    }
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
    const idToken = await firebaseUser.getIdToken(true);
    const res = await fetch(`${API_URL}/api/calendar/disconnect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Could not disconnect Google Calendar");
    }
    await refreshProfile();
  };

  const devTestLogin = async (role: "patient" | "doctor", testIdx: number = 1) => {
    const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import("firebase/auth");
    const email = `${role}${testIdx}@testayursutra.com`;
    const password = "testpassword123";
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const profile = {
          name: `Test ${role === 'doctor' ? 'Doc' : 'Patient'} ${testIdx}`,
          email,
          role,
          age: 30,
          gender: "Other",
          ...(role === 'doctor' ? { license: `DOC-TEST-${testIdx}` } : {})
        };
        await firestoreWriteWithTimeout(doc(db, "users", cred.user.uid), profile);
        // Force state update
        setUser({ uid: cred.user.uid, ...profile } as UserProfile);
        setRole(role);
      } else {
        throw e;
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        role,
        loading,
        signInWithGoogle: signInWithGoogleFn,
        registerWithGoogle,
        logout,
        updateUserProfile,
        getGoogleAccessToken,
        linkGoogleCalendar,
        unlinkGoogleCalendar,
        refreshProfile,
        devTestLogin,
      } as any}
    >
      {children}
    </AuthContext.Provider>
  );
};
