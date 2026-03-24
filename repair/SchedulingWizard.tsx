import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { collection, getDocs, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import {
  User, Calendar, Brain, CheckCircle, ArrowRight, ArrowLeft, Star, Clock, TrendingUp, Loader2, MapPin
} from 'lucide-react';

interface SchedulingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (sessionData: any) => void;
}

// ─── FIX #6: Generate relative slots from tomorrow, never hardcoded past dates ──
const generateDefaultSlots = (): string[] => {
  const slots: string[] = [];
  const base = new Date();
  base.setDate(base.getDate() + 1); // start tomorrow
  base.setSeconds(0, 0);
  for (let i = 0; i < 5; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i * 3);
    d.setHours(i % 2 === 0 ? 9 : 14, 0, 0, 0);
    // Skip Saturday → push to Monday
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    // Skip Sunday → push to Monday
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    slots.push(d.toISOString());
  }
  return slots;
};

const SchedulingWizard: React.FC<SchedulingWizardProps> = ({ isOpen, onClose, onComplete }) => {
  const { user, updateUserProfile } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: '',
    email: user?.email || '',
    reason: user?.reason_for_visit || '',
    symptoms: [] as string[],
    symptomScores: {} as Record<string, number>,
    constitution: 'Vata',
    recommendation: null as any,
    matchedDoctors: [] as any[],
    selectedDoctor: null as any,
    selectedSlots: [] as string[],
    radiusKm: 50,
    confirmed: false,
  });

  const symptomOptions = [
    'Headache', 'Bloating', 'Fatigue', 'Insomnia', 'Joint stiffness',
    'Anxiety', 'Digestive issues', 'Low energy', 'Mood swings', 'Stress'
  ];

  const constitutionTypes = ['Vata', 'Pitta', 'Kapha', 'Vata-Pitta', 'Pitta-Kapha', 'Vata-Kapha'];

  // ─── FIX #6: Use dynamically generated slots ──────────────────────────────
  const [mockSlots, setMockSlots] = useState<string[]>(generateDefaultSlots());

  // ─── FIX #5: Auto-initialise score to 5 when symptom toggled on ──────────
  const handleSymptomToggle = (symptom: string) => {
    const isAdding = !formData.symptoms.includes(symptom);
    const newSymptoms = isAdding
      ? [...formData.symptoms, symptom]
      : formData.symptoms.filter(s => s !== symptom);

    setFormData(prev => ({
      ...prev,
      symptoms: newSymptoms,
      symptomScores: isAdding
        ? { ...prev.symptomScores, [symptom]: prev.symptomScores[symptom] ?? 5 }
        : prev.symptomScores,
    }));
  };

  const handleSymptomScore = (symptom: string, score: number) => {
    setFormData(prev => ({
      ...prev,
      symptomScores: { ...prev.symptomScores, [symptom]: score }
    }));
  };

  const fetchDoctors = async () => {
    const q = query(collection(db, "users"), where("role", "==", "doctor"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  const calculateDistanceKM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const p = 0.017453292519943295;
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p) / 2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p)) / 2;
    return 12742 * Math.asin(Math.sqrt(a));
  };

  const matchDoctors = (doctors: any[], symptoms: string[], therapy: string, radius: number) => {
    const normalize = (text: string) => text?.toLowerCase().trim();
    const patientGeo = (user as any)?.geolocation || { lat: 21.1458, lng: 79.0882 };

    const doctorsWithDistance = doctors.map(doc => {
      let distance = 9999;
      if (doc.geolocation?.lat && doc.geolocation?.lng && patientGeo) {
        distance = calculateDistanceKM(patientGeo.lat, patientGeo.lng, doc.geolocation.lat, doc.geolocation.lng);
      }
      return { ...doc, distanceKm: distance };
    });

    const filteredByRadius = doctorsWithDistance.filter(doc => doc.distanceKm <= radius);

    const symptomMap: Record<string, string[]> = {
      "bloating": ["digestive issues", "gas", "acidity", "gut"],
      "stress": ["anxiety", "mental stress", "mind"],
      "fatigue": ["low energy", "tiredness", "exhaustion"],
      "headache": ["migraine", "head pain"],
      "insomnia": ["sleep issues", "sleeplessness"],
      "joint stiffness": ["joint pain", "joint pains", "arthritis", "bones"],
      "digestive issues": ["bloating", "acidity", "indigestion", "gut"],
    };

    return filteredByRadius.map(doc => {
      let score = 0;
      let expertise: string[] = [];

      if (doc.expertiseSymptoms) {
        expertise = doc.expertiseSymptoms.map(normalize);
      } else if (doc.specialization) {
        let specs = typeof doc.specialization === 'string' ? doc.specialization.split(",") : doc.specialization;
        expertise = specs.map((s: string) => normalize(s));
      }

      const therapies = (doc.therapiesOffered || doc.supportedTherapies || []).map((t: string) => normalize(t));

      symptoms.forEach(symptom => {
        const normalizedSymptom = normalize(symptom);
        if (expertise.includes(normalizedSymptom)) score += 3;
        const related = symptomMap[normalizedSymptom] || [];
        if (related.some((r: string) => expertise.includes(normalize(r)))) score += 2;
        if (expertise.some((e: string) => e.includes(normalizedSymptom))) score += 1;
      });

      if (therapy) {
        const normalizedTherapy = normalize(therapy);
        if (therapies.some((t: string) => t.includes(normalizedTherapy)) || expertise.some((e: string) => e.includes(normalizedTherapy))) {
          score += 5;
        }
      }

      if (doc.distanceKm <= 5) score += 3;
      else if (doc.distanceKm <= 15) score += 2;
      else if (doc.distanceKm <= 30) score += 1;

      return { ...doc, matchScore: score };
    })
      .filter(doc => doc.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);
  };

  const generateLLMRecommendation = async () => {
    setIsLoading(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const symptomsPayload = formData.symptoms.map(s => ({
        name: s, score: formData.symptomScores[s] || 5
      }));

      const response = await fetch(`${BACKEND_URL}/api/scheduling/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: symptomsPayload,
          dosha: formData.constitution,
          age: user?.age || 35,
          gender: user?.gender || 'Unknown',
          reason: formData.reason
        })
      });

      const data = await response.json();

      if (data.success && data.recommendation) {
        setFormData(prev => ({
          ...prev,
          recommendation: {
            ...data.recommendation,
            severity_score: data.recommendation.severity_score || 5,
            totalPriorityScore: data.priorityResult?.totalScore || 50,
          }
        }));

        const doctors = await fetchDoctors();
        const matched = matchDoctors(doctors, formData.symptoms, data.recommendation.therapy, formData.radiusKm);

        setFormData(prev => ({ ...prev, matchedDoctors: matched }));
      } else {
        throw new Error(data.error || "Failed to generate recommendation");
      }
    } catch (error) {
      console.error("Error generating recommendation:", error);
      toast({ title: "Connecting AI Engine", description: "Falling back to safe defaults...", variant: "default" });

      const fallbackRec = {
        therapy: 'Abhyanga (oil massage) - Fallback',
        sessions_recommended: 3,
        spacing_days: 7,
        priority_score: 50,
        severity_score: 5,
        totalPriorityScore: 50,
        explanation: 'Could not connect to AI services. This is a fallback recommendation based on general wellness.',
        confidence: 70
      };

      const doctors = await fetchDoctors();
      const matched = matchDoctors(doctors, formData.symptoms, fallbackRec.therapy, formData.radiusKm);

      setFormData(prev => ({
        ...prev,
        recommendation: fallbackRec,
        matchedDoctors: matched
      }));
    } finally {
      setIsLoading(false);
      setCurrentStep(3);
    }
  };

  const handleNext = () => {
    if (currentStep === 2) {
      generateLLMRecommendation();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  // ─── FIX #1: Standardised field names so DoctorDashboard can see sessions ─
  // ─── FIX #2: Removed duplicate session creation (DoctorDashboard callback  ─
  //             no longer creates sessions — it just calls fetchData())        ─
  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const patientId = user?.uid || "anonymous_" + Date.now();
      const patientName = formData.name || user?.name || "Patient";
      const patientEmail = formData.email || user?.email || "";
      const doctorId = formData.selectedDoctor?.id || "unknown";
      const doctorName = formData.selectedDoctor?.name || formData.selectedDoctor?.clinicName || "Doctor";
      const therapy = formData.recommendation?.therapy || "Panchakarma";
      const scheduledSlots = formData.selectedSlots;
      const priority = formData.recommendation?.totalPriorityScore || 50;
      const severityScore = formData.recommendation?.severity_score || 5;

      // 1. Save intake submission record
      const symptomsPayload = formData.symptoms.map(s => ({ name: s, score: formData.symptomScores[s] || 5 }));
      const intakeDocRef = await addDoc(collection(db, 'intakeSubmissions'), {
        patientId, patientName, patientEmail,
        phone: formData.phone,
        reason: formData.reason,
        dosha: formData.constitution,
        symptoms: symptomsPayload,
        recommendation: formData.recommendation,
        status: "submitted",
        createdAt: new Date().toISOString(),
      });

      // 2. Conflict checking — compare slots (string-normalised ISO match)
      if (scheduledSlots.length > 0) {
        const q = query(
          collection(db, 'appointments'),
          where('doctorId', '==', doctorId),
          where('status', 'in', ['approved', 'pending'])
        );
        const existingSnap = await getDocs(q);
        const collisions: any[] = [];

        existingSnap.forEach(docSnap => {
          const data = docSnap.data();
          const intersection = (data.scheduledSlots || []).filter((slot: string) => scheduledSlots.includes(slot));
          if (intersection.length > 0) collisions.push({ id: docSnap.id, ...data, collisionSlots: intersection });
        });

        for (const collision of collisions) {
          const existingPriority = collision.priority || 50;
          if (priority > existingPriority) {
            await updateDoc(doc(db, 'appointments', collision.id), {
              status: 'reschedule_required',
              bumpedByPriority: true,
              bumpMessage: 'A critical case required your time slot. Please reschedule.'
            });
          } else {
            throw new Error("These slots have been taken by a higher priority case. Please select different slots.");
          }
        }
      }

      // 3. Create appointment record
      const appointmentRef = await addDoc(collection(db, 'appointments'), {
        patientId, patientName, patientEmail,
        doctorId, doctorName,
        therapy,
        scheduledSlots,
        totalSessions: scheduledSlots.length,
        intakeId: intakeDocRef.id,
        status: 'pending',
        priority,
        dosha: formData.constitution,
        reason: formData.reason,
        createdAt: new Date().toISOString(),
      });

      // 4. Create individual session documents
      //    ─── FIX #1: All field names now match what DoctorDashboard queries ───
      //    practitioner_id  (was: doctor_id)
      //    therapy          (was: therapy_type)
      //    datetime         (was: scheduled_date)
      //    status           now 'pending_review' so doctor can approve (was: 'scheduled')
      //    totalPriorityScore added (was: priority_score only)
      for (let i = 0; i < scheduledSlots.length; i++) {
        await addDoc(collection(db, 'sessions'), {
          patient_id: patientId,
          patient_name: patientName,
          patient_email: patientEmail,
          practitioner_id: doctorId,          // ← was: doctor_id
          doctor_name: doctorName,
          appointment_id: appointmentRef.id,
          intake_id: intakeDocRef.id,
          therapy: therapy,                   // ← was: therapy_type
          datetime: scheduledSlots[i],        // ← was: scheduled_date
          session_number: i + 1,
          total_sessions: scheduledSlots.length,
          duration_minutes: therapy.includes('Vamana') ? 120 : 90,
          status: 'pending_review',           // ← was: 'scheduled'
          doctor_approval: 'pending',
          priority: priority,
          totalPriorityScore: priority,       // ← was: priority_score only
          severity_score: severityScore,
          dosha: formData.constitution,       // ← was: dosha_imbalance
          reason: formData.reason,
          clinical_summary: formData.recommendation?.clinical_summary || '',
          precautions_pre: formData.recommendation?.precautions_pre || [],
          precautions_post: formData.recommendation?.precautions_post || [],
          feedback_escalation: false,
          feedback_multiplier: 1.0,
          created_at: new Date().toISOString(),
        });
      }

      // 5. Update the logged-in patient's profile with recommendation
      if (updateUserProfile) {
        await updateUserProfile({
          reason_for_visit: formData.reason,
          symptoms: symptomsPayload as any,
          llm_recommendation: formData.recommendation || undefined
        });
      }

      toast({ title: "Booking Submitted! 🌿", description: "Your request has been sent for doctor review." });

      const sessionData = {
        patient: formData, doctorId, doctorName, recommendation: formData.recommendation, scheduledSlots
      };
      onComplete(sessionData);
      onClose();

    } catch (e: any) {
      console.error("Complete handle error:", e);
      toast({ title: "Booking Failed", description: e.message || "An error occurred", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const formatSlotTime = (slot: string) => new Date(slot).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
  });

  // ─── FIX #5: Step 2 only needs symptoms selected (scores are auto-init'd) ──
  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.name && formData.phone && formData.reason;
      case 2: return formData.symptoms.length > 0; // ← was: also requiring symptomScores to be non-empty
      case 3: return formData.recommendation;
      case 4: return formData.selectedDoctor !== null;
      case 5: return formData.selectedSlots.length > 0;
      default: return false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-playfair text-2xl flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-primary" />
            <span>Schedule New Session - Step {currentStep} of 5</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center space-x-4 mb-6">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${step <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {step < currentStep ? <CheckCircle className="w-4 h-4" /> : step}
            </div>
          ))}
        </div>

        <div className="space-y-6">
          {currentStep === 1 && (
            <Card className="ayur-card p-6 animate-scale-in">
              <div className="flex items-center space-x-2 mb-4">
                <User className="w-5 h-5 text-primary" />
                <h3 className="font-playfair text-xl font-semibold">Patient Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Full Name *</Label><Input value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter full name" /></div>
                <div className="space-y-2"><Label>Phone Number *</Label><Input value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="+91-9876543210" /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} placeholder="patient@example.com" /></div>
                <div className="space-y-2"><Label>Constitution</Label><select value={formData.constitution} onChange={(e) => setFormData(prev => ({ ...prev, constitution: e.target.value }))} className="w-full p-2 border border-border rounded-md">{constitutionTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div className="space-y-2 mt-4"><Label>Reason for Visit *</Label><Textarea value={formData.reason} onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))} placeholder="Describe health concerns..." rows={3} /></div>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="ayur-card p-6 animate-scale-in">
              <div className="flex items-center space-x-2 mb-4"><Brain className="w-5 h-5 text-primary" /><h3 className="font-playfair text-xl font-semibold">Symptom Assessment</h3></div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {symptomOptions.map((symptom) => (
                  <label key={symptom} className="flex items-center space-x-2 cursor-pointer">
                    <Checkbox checked={formData.symptoms.includes(symptom)} onCheckedChange={() => handleSymptomToggle(symptom)} />
                    <span className="text-sm">{symptom}</span>
                  </label>
                ))}
              </div>
              {formData.symptoms.length > 0 && (
                <div className="space-y-4 mt-6">
                  <Label className="text-base font-medium">Symptom Severity (1-10)</Label>
                  {formData.symptoms.map(symptom => (
                    <div key={symptom} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{symptom}</span>
                        <Badge variant="outline">{formData.symptomScores[symptom] ?? 5}/10</Badge>
                      </div>
                      <Slider
                        value={[formData.symptomScores[symptom] ?? 5]}
                        onValueChange={(val) => handleSymptomScore(symptom, val[0])}
                        max={10} min={1} step={1} className="w-full"
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {currentStep === 3 && formData.recommendation && (
            <Card className="ayur-card p-6 animate-scale-in">
              <div className="flex items-center space-x-2 mb-4"><Brain className="w-5 h-5 text-primary" /><h3 className="font-playfair text-xl font-semibold">AI Treatment Recommendation</h3></div>
              <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-lg text-primary">{formData.recommendation.therapy}</h4>
                  <div className="flex items-center space-x-2"><Badge>Priority: {formData.recommendation.totalPriorityScore}</Badge></div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                  <div><div className="text-2xl font-bold text-primary">{formData.recommendation.sessions_recommended}</div><div className="text-sm text-muted-foreground">Sessions</div></div>
                  <div><div className="text-2xl font-bold text-accent">{formData.recommendation.spacing_days}</div><div className="text-sm text-muted-foreground">Days Apart</div></div>
                  <div><div className="text-2xl font-bold text-ayur-soft-gold">{formData.recommendation.sessions_recommended * formData.recommendation.spacing_days}</div><div className="text-sm text-muted-foreground">Total Days</div></div>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-3">{formData.recommendation.explanation}</p>
              </div>
            </Card>
          )}

          {currentStep === 4 && (
            <Card className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 space-y-3 md:space-y-0">
                <h3 className="text-xl font-semibold">Recommended Doctors in Area</h3>
                <div className="flex items-center space-x-3 bg-muted/50 p-2 rounded-lg">
                  <span className="text-sm font-medium pr-2 border-r border-border">Radius: {formData.radiusKm} km</span>
                  <Slider
                    value={[formData.radiusKm]}
                    onValueChange={async (val) => {
                      setFormData(prev => ({ ...prev, radiusKm: val[0] }));
                      const docs = await fetchDoctors();
                      const matched = matchDoctors(docs, formData.symptoms, formData.recommendation?.therapy || "Panchakarma", val[0]);
                      setFormData(prev => ({ ...prev, matchedDoctors: matched, radiusKm: val[0] }));
                    }}
                    max={200} min={5} step={5} className="w-32"
                  />
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
              </div>
              {formData.matchedDoctors.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">No verified doctors found within {formData.radiusKm} km offering this therapy. Try expanding your radius.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formData.matchedDoctors.map((doc: any) => (
                    <Card key={doc.id} className="p-4">
                      <div className="flex items-center space-x-3">
                        <img src={doc.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + doc.name} className="w-12 h-12 rounded-full border bg-muted" />
                        <div>
                          <div className="font-semibold">{doc.name}</div>
                          <div className="text-sm text-muted-foreground">{Array.isArray(doc.specialization) ? doc.specialization.join(", ") : doc.specialization || "Ayurvedic Doctor"}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-muted-foreground"><MapPin className="inline w-3 h-3 mr-1" />{Math.round(doc.distanceKm)} km away</span>
                        <span className="text-primary font-medium">Match: {doc.matchScore} pts</span>
                      </div>
                      <Button className="w-full mt-3" onClick={async () => {
                        setFormData(prev => ({ ...prev, selectedDoctor: doc }));
                        const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                        try {
                          const slotsResponse = await fetch(`${BACKEND_URL}/api/scheduling/slots`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ practitionerId: doc.id, therapy: formData.recommendation.therapy, spacingDays: formData.recommendation.spacing_days, sessionsNeeded: formData.recommendation.sessions_recommended })
                          });
                          const slotsData = await slotsResponse.json();
                          if (slotsData.success && slotsData.slots) {
                            setMockSlots(slotsData.slots);
                            setFormData(prev => ({ ...prev, selectedSlots: slotsData.slots }));
                          }
                        } catch (e) {
                          console.error("Using default slots due to network error.");
                          // FIX #6: fallback uses relative dates, not past hardcoded dates
                          setMockSlots(generateDefaultSlots());
                        }
                        setCurrentStep(5);
                      }}>Book Appointment</Button>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          )}

          {currentStep === 5 && (
            <Card className="ayur-card p-6">
              <div className="flex items-center space-x-2 mb-4"><Calendar className="w-5 h-5 text-primary" /><h3 className="font-playfair text-xl font-semibold">Select Time Slots</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mockSlots.slice(0, formData.recommendation?.sessions_recommended || 3).map((slot, index) => (
                  <label key={slot} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:border-primary">
                    <div className="flex items-center space-x-3">
                      <Checkbox checked={formData.selectedSlots.includes(slot)} onCheckedChange={(checked) => {
                        setFormData(prev => ({ ...prev, selectedSlots: checked ? [...prev.selectedSlots, slot] : prev.selectedSlots.filter(s => s !== slot) }));
                      }} />
                      <div><div className="font-medium">Session {index + 1}</div><div className="text-sm text-muted-foreground">{formatSlotTime(slot)}</div></div>
                    </div>
                  </label>
                ))}
              </div>
            </Card>
          )}

          <div className="flex items-center justify-between pt-6 border-t">
            <Button variant="outline" onClick={currentStep === 1 ? onClose : handleBack} disabled={isLoading}>
              <ArrowLeft className="w-4 h-4 mr-2" />{currentStep === 1 ? 'Cancel' : 'Back'}
            </Button>
            {currentStep < 5 ? (
              <Button onClick={handleNext} disabled={!canProceed() || isLoading} className="ayur-button-hero">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Next Step"}
                {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={!canProceed() || isLoading} className="ayur-button-accent">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Submit for Doctor Review"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SchedulingWizard;
