import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch patients
        const patientsQ = query(collection(db, 'users'), where('role', '==', 'patient'));
        const pSnap = await getDocs(patientsQ);
        const pData = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
        setPatients(pData);

        // Fetch sessions
        const sessionsQ = collection(db, 'sessions'); 
        const sSnap = await getDocs(sessionsQ);
        const sData = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
        setSessions(sData);
        
      } catch (err) {
        console.error("Error fetching doctor data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return { patients, sessions, loading };
}
