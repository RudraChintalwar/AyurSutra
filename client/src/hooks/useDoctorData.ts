import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dob?: string;
  gender?: string;
  role: string;
  dosha?: string;
  reason_for_visit?: string;
  symptoms?: any[];
  llm_recommendation?: any;
  avatar?: string;
  [key: string]: any;
}

export interface Session {
  id: string;
  patient_id: string;
  patient_name?: string;
  practitioner_id: string;
  datetime: string;
  duration_minutes: number;
  status: string;
  therapy: string;
  priority?: number;
  [key: string]: any;
}

export function useDoctorData() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch only this doctor's sessions.
        const sessionsQ = user?.uid
          ? query(collection(db, 'sessions'), where('practitioner_id', '==', user.uid))
          : collection(db, 'sessions');
        const sSnap = await getDocs(sessionsQ);
        const sData = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
        setSessions(sData);

        // Only fetch patients who are linked to this doctor's sessions.
        const patientIds = Array.from(new Set(sData.map((s) => s.patient_id).filter(Boolean)));
        if (patientIds.length === 0) {
          setPatients([]);
          return;
        }
        const patientsQ = query(collection(db, 'users'), where('role', '==', 'patient'));
        const pSnap = await getDocs(patientsQ);
        const pData = pSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Patient))
          .filter((p) => patientIds.includes(p.id));
        setPatients(pData);
        
      } catch (err) {
        console.error("Error fetching doctor data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.uid]);

  return { patients, sessions, loading };
}
