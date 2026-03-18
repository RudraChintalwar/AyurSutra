import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ─── Types ───────────────────────────────────────────────
export type UserRole = "patient" | "doctor" | null;

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
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  role: UserRole;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  registerPatient: (
    email: string,
    password: string,
    name: string
  ) => Promise<void>;
  registerDoctor: (
    email: string,
    password: string,
    name: string,
    license: string,
    specialization: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
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
    await Promise.race([
      options ? setDoc(ref, data, options) : setDoc(ref, data),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firestore timeout")), timeoutMs)
      ),
    ]);
    return true;
  } catch (err) {
    console.warn("Firestore write failed (will continue):", err);
    return false;
  }
};

// ─── Provider ────────────────────────────────────────────
interface AuthProviderProps {
  children: ReactNode;
}

const googleProvider = new GoogleAuthProvider();

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from Firestore (with timeout)
  const fetchUserProfile = async (
    fbUser: FirebaseUser
  ): Promise<UserProfile | null> => {
    try {
      const result = await Promise.race([
        getDoc(doc(db, "users", fbUser.uid)),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);

      if (result && result.exists()) {
        const data = result.data();
        return {
          uid: fbUser.uid,
          name: data.name || fbUser.displayName || "User",
          email: data.email || fbUser.email || "",
          role: data.role || "patient",
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
          // User exists in Auth but not in Firestore
          // Could be: new Google sign-up, or Firestore is unavailable
          // Set a basic profile from Firebase Auth data
          setUser({
            uid: fbUser.uid,
            name: fbUser.displayName || "User",
            email: fbUser.email || "",
            role: null, // null role = needs profile completion OR Firestore unavailable
            avatar: fbUser.photoURL || undefined,
          });
          setRole(null);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─── Auth Methods ────────────────────────────────────
  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const registerPatient = async (
    email: string,
    password: string,
    name: string
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Try to write to Firestore, but don't block if it fails
    await firestoreWriteWithTimeout(doc(db, "users", cred.user.uid), {
      name,
      email,
      role: "patient",
      createdAt: serverTimestamp(),
    });
    // Update local state immediately regardless of Firestore
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      name,
      email,
      role: "patient",
    };
    setUser(newProfile);
    setRole("patient");
    setFirebaseUser(cred.user);
  };

  const registerDoctor = async (
    email: string,
    password: string,
    name: string,
    license: string,
    specialization: string
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Try to write to Firestore, but don't block if it fails
    await firestoreWriteWithTimeout(doc(db, "users", cred.user.uid), {
      name,
      email,
      role: "doctor",
      license,
      specialization,
      createdAt: serverTimestamp(),
    });
    // Update local state immediately regardless of Firestore
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      name,
      email,
      role: "doctor",
      license,
      specialization,
    };
    setUser(newProfile);
    setRole("doctor");
    setFirebaseUser(cred.user);
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!firebaseUser) return;
    const userRef = doc(db, "users", firebaseUser.uid);
    const updateData: Record<string, unknown> = { ...data };
    delete updateData.uid; // don't write uid into the doc

    // Try Firestore write with timeout
    await firestoreWriteWithTimeout(userRef, updateData, { merge: true });

    // ALWAYS update local state regardless of Firestore success
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...data };
    });
    if (data.role) {
      setRole(data.role as UserRole);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        role,
        loading,
        login,
        loginWithGoogle,
        registerPatient,
        registerDoctor,
        logout,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};