// Mock data for Panchakarma Management Software

export interface Patient {
  id: string;
  name: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  avatar: string;
  dosha: string;
  reason_for_visit: string;
  symptoms: Array<{ name: string; score: number }>;
  llm_recommendation: {
    therapy: string;
    sessions_recommended: number;
    spacing_days: number;
    priority_score: number;
    explanation: string;
  };
}

export interface Practitioner {
  id: string;
  name: string;
  role: string;
  specialty: string;
  phone: string;
}

export interface Session {
  id: string;
  patient_id: string;
  practitioner_id: string;
  therapy: string;
  session_number: number;
  datetime: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  precautions_pre: string[];
  precautions_post: string[];
  feedback: {
    submitted_at: string;
    symptom_scores: Record<string, number>;
    notes: string;
    action: string;
  } | null;
}

export interface Notification {
  id: string;
  patient_id: string;
  channel: 'in-app' | 'sms' | 'email';
  title: string;
  body: string;
  datetime: string;
  read: boolean;
  sender?: 'doctor' | 'system' | 'llm';
}

export const mockData = {
  patients: [
    {
      id: "p1",
      name: "Asha Nair",
      dob: "1989-08-12",
      gender: "Female",
      phone: "+91-9876543210",
      email: "asha.nair@example.com",
      avatar: "https://placehold.co/80x80/2C6E49/FFFFFF?text=AN",
      dosha: "Pitta-Vata",
      reason_for_visit: "Chronic migraine and digestive bloating",
      symptoms: [
        { name: "Headache", score: 8 },
        { name: "Bloating", score: 6 },
        { name: "Fatigue", score: 5 }
      ],
      llm_recommendation: {
        therapy: "Virechana (purgation)",
        sessions_recommended: 3,
        spacing_days: 7,
        priority_score: 88,
        explanation: "Pitta-dominant presentation with toxin accumulation. Virechana recommended to clear excess Pitta and improve digestion. Monitor hydration and electrolytes. Expect transient nausea; provide post-procedure digestive teas."
      }
    },
    {
      id: "p2",
      name: "Ravi Kumar",
      dob: "1975-04-02",
      gender: "Male",
      phone: "+91-9123456780",
      email: "ravi.kumar@example.com",
      avatar: "https://placehold.co/80x80/FF9933/FFFFFF?text=RK",
      dosha: "Kapha",
      reason_for_visit: "Low energy, sluggish digestion, weight gain",
      symptoms: [
        { name: "Low energy", score: 6 },
        { name: "Slow digestion", score: 7 },
        { name: "Weight gain", score: 6 }
      ],
      llm_recommendation: {
        therapy: "Vamana (therapeutic emesis) + Abhyanga support",
        sessions_recommended: 2,
        spacing_days: 10,
        priority_score: 62,
        explanation: "Kapha accumulation benefiting from Vamana and supportive Abhyanga massage; focus on light diet pre-procedure and warm liquids post."
      }
    },
    {
      id: "p3",
      name: "Meera Desai",
      dob: "1996-12-20",
      gender: "Female",
      phone: "+91-9988776655",
      email: "meera.desai@example.com",
      avatar: "https://placehold.co/80x80/F7F4EE/2C6E49?text=MD",
      dosha: "Vata",
      reason_for_visit: "Insomnia, joint stiffness",
      symptoms: [
        { name: "Insomnia", score: 7 },
        { name: "Stiff joints", score: 5 }
      ],
      llm_recommendation: {
        therapy: "Basti (medicated enema)",
        sessions_recommended: 5,
        spacing_days: 3,
        priority_score: 74,
        explanation: "Vata imbalance with nervous system involvement. Basti recommended to pacify Vata, with warm oil intake and sleep hygiene."
      }
    }
  ] as Patient[],

  practitioners: [
    {
      id: "d1",
      name: "Dr. Sargun Mehta",
      role: "Chief Ayurvedic Physician",
      specialty: "Panchakarma",
      phone: "+91-9000000001"
    },
    {
      id: "d2",
      name: "Dr. Kavya Rao",
      role: "Ayurveda Therapist",
      specialty: "Detox & Panchakarma",
      phone: "+91-9000000002"
    }
  ] as Practitioner[],

  sessions: [
    {
      id: "s1",
      patient_id: "p1",
      practitioner_id: "d1",
      therapy: "Virechana",
      session_number: 1,
      datetime: "2025-09-30T10:00:00+05:30",
      duration_minutes: 90,
      status: "scheduled",
      precautions_pre: [
        "Fasting 8 hours before",
        "Avoid heavy oils 24 hours before",
        "Hydrate well"
      ],
      precautions_post: [
        "Take warm digestive teas",
        "Avoid cold drinks",
        "Light diet for 48 hours"
      ],
      feedback: null
    },
    {
      id: "s2",
      patient_id: "p1",
      practitioner_id: "d1",
      therapy: "Virechana",
      session_number: 2,
      datetime: "2025-10-07T10:00:00+05:30",
      duration_minutes: 90,
      status: "scheduled",
      precautions_pre: [],
      precautions_post: [],
      feedback: null
    },
    {
      id: "s3",
      patient_id: "p2",
      practitioner_id: "d2",
      therapy: "Vamana",
      session_number: 1,
      datetime: "2025-10-02T14:00:00+05:30",
      duration_minutes: 120,
      status: "scheduled",
      precautions_pre: ["Light diet 24 hours prior", "Arrive hydrated"],
      precautions_post: ["Rest, avoid cold foods"],
      feedback: null
    },
    {
      id: "s4",
      patient_id: "p3",
      practitioner_id: "d2",
      therapy: "Basti",
      session_number: 1,
      datetime: "2025-09-28T09:00:00+05:30",
      duration_minutes: 60,
      status: "completed",
      precautions_pre: ["Warm oil massage prior"],
      precautions_post: ["Rest, warm liquids"],
      feedback: {
        submitted_at: "2025-09-28T12:00:00+05:30",
        symptom_scores: { Insomnia: 5, "Stiff joints": 3 },
        notes: "Slept better for 3 hours post-session, slight abdominal discomfort",
        action: "suggest_additional_rest"
      }
    }
  ] as Session[],

  notifications: [
    {
      id: "n1",
      patient_id: "p1",
      channel: "in-app",
      title: "Pre-procedure Reminder",
      body: "Hi Asha — fasting required 8 hours before your Virechana at 10:00 AM on 30 Sep 2025.",
      datetime: "2025-09-29T08:00:00+05:30",
      read: false,
      sender: "system"
    },
    {
      id: "n2",
      patient_id: "p1",
      channel: "sms",
      title: "Session Confirmed",
      body: "Your Virechana session with Dr. Sargun Mehta is confirmed for tomorrow 10 AM. Please follow pre-procedure guidelines.",
      datetime: "2025-09-29T18:00:00+05:30",
      read: true,
      sender: "doctor"
    },
    {
      id: "n3",
      patient_id: "p3",
      channel: "email",
      title: "Post-session Care",
      body: "Meera — we recommend warm herbal tea and light meals for next 48 hours.",
      datetime: "2025-09-28T12:05:00+05:30",
      read: true,
      sender: "llm"
    },
    {
      id: "n4",
      patient_id: "p2",
      channel: "in-app",
      title: "Schedule Update",
      body: "Your Vamana session has been rescheduled to Oct 2nd, 2 PM. Dr. Kavya Rao will be your practitioner.",
      datetime: "2025-09-27T10:30:00+05:30",
      read: false,
      sender: "doctor"
    }
  ] as Notification[],

  llm_responses_for_feedback: [
    {
      feedback_action: "suggest_additional_rest",
      result: {
        ui_message: "LLM Suggests: Add 1 gentle Abhyanga session in 3 days and keep other sessions same.",
        calendar_update: [
          {
            insert_session: {
              patient_id: "p3",
              therapy: "Abhyanga (supportive massage)",
              session_number: 2,
              datetime: "2025-10-01T11:00:00+05:30",
              duration_minutes: 45,
              priority_score: 58
            }
          }
        ]
      }
    },
    {
      feedback_action: "no_change_needed",
      result: {
        ui_message: "LLM: No schedule change required. Continue with planned sessions.",
        calendar_update: []
      }
    },
    {
      feedback_action: "require_more_sessions",
      result: {
        ui_message: "LLM: Symptoms still high — recommend 1 extra session within 5 days.",
        calendar_update: [
          {
            insert_session: {
              therapy: "Virechana (extra)",
              session_number: 4,
              datetime: "2025-10-05T15:00:00+05:30",
              duration_minutes: 90,
              priority_score: 80
            }
          }
        ]
      }
    }
  ],

  chart_data: {
    p1_symptom_history: [
      { date: "2025-08-15", headache: 9, bloating: 7 },
      { date: "2025-08-22", headache: 8, bloating: 6 },
      { date: "2025-08-29", headache: 8, bloating: 6 },
      { date: "2025-09-09", headache: 8, bloating: 6 },
      { date: "2025-09-28", headache: 4, bloating: 3 }
    ],
    p3_symptom_history: [
      { date: "2025-09-01", insomnia: 8, stiff_joints: 5 },
      { date: "2025-09-08", insomnia: 7, stiff_joints: 4 },
      { date: "2025-09-28", insomnia: 5, stiff_joints: 3 }
    ]
  }
};