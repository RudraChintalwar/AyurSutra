import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { rankDoctorsByClinicalMatch } from '@/lib/doctorMatching';
import { useLanguage } from '@/contexts/LanguageContext';

import {
  User, Calendar, Brain, CheckCircle, ArrowRight, ArrowLeft, Star, Clock, TrendingUp, Loader2, MapPin
} from 'lucide-react';

interface SchedulingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (sessionData: any) => void;
}

// ─── FIX #6: Generate relative slots from tomorrow, never hardcoded past dates ──
const generateDefaultSlots = (count = 5, spacingDays = 3): string[] => {
  const slots: string[] = [];
  const base = new Date();
  base.setDate(base.getDate() + 1); // start tomorrow
  base.setSeconds(0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i * Math.max(1, spacingDays));
    d.setHours(i % 2 === 0 ? 9 : 14, 0, 0, 0);
    // Skip Saturday → push to Monday
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    // Skip Sunday → push to Monday
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    slots.push(d.toISOString());
  }
  return slots;
};

const buildHeuristicRecommendation = (
  constitution: string,
  symptomScores: Record<string, number>
) => {
  const scores = Object.values(symptomScores).filter((n) => Number.isFinite(n));
  const maxSeverity = scores.length > 0 ? Math.max(...scores) : 5;
  const avgSeverity = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
  const severityScore = Math.max(1, Math.min(10, Math.round((maxSeverity * 0.7) + (avgSeverity * 0.3))));

  const sessionsRecommended =
    severityScore >= 9 ? 6 :
    severityScore >= 8 ? 5 :
    severityScore >= 6 ? 4 :
    severityScore >= 4 ? 3 : 2;

  const spacingDays =
    severityScore >= 9 ? 3 :
    severityScore >= 7 ? 4 :
    severityScore >= 5 ? 5 :
    severityScore >= 3 ? 6 : 7;

  const dosha = String(constitution || "").toLowerCase();
  const therapy =
    dosha.includes("pitta") ? "Virechana" :
    dosha.includes("kapha") ? "Vamana" :
    dosha.includes("vata") ? "Basti" :
    "Abhyanga";

  const totalPriorityScore = Math.max(35, Math.min(100, Math.round((severityScore * 6.5) + Math.min(scores.length * 2, 12))));
  return {
    therapy,
    sessions_recommended: sessionsRecommended,
    spacing_days: spacingDays,
    priority_score: totalPriorityScore,
    severity_score: severityScore,
    totalPriorityScore,
    explanation: 'Recommendation generated from symptom severity and dosha profile.',
    confidence: 72
  };
};

const SchedulingWizard: React.FC<SchedulingWizardProps> = ({ isOpen, onClose, onComplete }) => {
  const { user, role, firebaseUser, updateUserProfile } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [doctorSessionCount, setDoctorSessionCount] = useState(1);
  const [doctorSessionDateTimes, setDoctorSessionDateTimes] = useState<Array<{ date: string; time: string }>>([{ date: '', time: '' }]);
  const [patientEntryMode, setPatientEntryMode] = useState<'manual' | 'existing'>('manual');
  const [availablePatients, setAvailablePatients] = useState<any[]>([]);
  const [selectedExistingPatientId, setSelectedExistingPatientId] = useState<string>('');

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: (user as any)?.phone || '',
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
  const doctorTimeOptions = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];

  useEffect(() => {
    if (!user) return;
    setFormData((prev) => ({
      ...prev,
      name: role === 'doctor' ? prev.name : (prev.name || user.name || ""),
      email: role === 'doctor' ? prev.email : (prev.email || user.email || ""),
      phone: role === 'doctor' ? prev.phone : (prev.phone || (user as any)?.phone || ""),
      reason: role === 'doctor' ? prev.reason : (prev.reason || (user as any)?.reason_for_visit || ""),
      constitution: prev.constitution || (user as any)?.dosha || "Vata",
    }));
  }, [user, role]);

  useEffect(() => {
    const fetchPatients = async () => {
      if (role !== 'doctor' || !isOpen) return;
      try {
        const q = query(collection(db, "users"), where("role", "==", "patient"));
        const snapshot = await getDocs(q);
        const patients = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAvailablePatients(patients);
      } catch (err) {
        console.error("Failed to fetch patients:", err);
      }
    };
    fetchPatients();
  }, [role, isOpen]);

  useEffect(() => {
    if (role !== 'doctor') return;
    if (patientEntryMode !== 'existing' || !selectedExistingPatientId) return;
    const selected = availablePatients.find((p: any) => p.id === selectedExistingPatientId);
    if (!selected) return;
    setFormData((prev) => ({
      ...prev,
      name: selected.name || '',
      email: selected.email || '',
      phone: selected.phone || '',
      reason: selected.reason_for_visit || prev.reason || '',
      constitution: selected.dosha || prev.constitution || 'Vata',
      symptoms: Array.isArray(selected.symptoms) ? selected.symptoms.map((s: any) => s.name || s).filter(Boolean) : prev.symptoms,
      symptomScores: Array.isArray(selected.symptoms)
        ? selected.symptoms.reduce((acc: Record<string, number>, s: any) => {
            const key = s?.name || String(s || '');
            if (key) acc[key] = Number(s?.score) || 5;
            return acc;
          }, {})
        : prev.symptomScores,
    }));
  }, [role, patientEntryMode, selectedExistingPatientId, availablePatients]);

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

  const matchDoctors = (doctors: any[], symptoms: string[], therapy: string, radius: number) => {
    return rankDoctorsByClinicalMatch(doctors, {
      symptoms,
      requiredTherapy: therapy,
      radiusKm: radius,
      patientGeo: (user as any)?.geolocation || null,
      includeUnknownDistance: !(user as any)?.geolocation,
    });
  };

  const generateLLMRecommendation = async () => {
    setIsLoading(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const symptomsPayload = formData.symptoms.map(s => ({
        name: s, score: formData.symptomScores[s] || 5
      }));

      if (!firebaseUser) {
        throw new Error("Authentication required for AI recommendation");
      }
      const token = await firebaseUser.getIdToken();

      const response = await fetch(`${BACKEND_URL}/api/scheduling/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
        const normalizedRecommendation = {
          ...data.recommendation,
          sessions_recommended: Number(data.recommendation.sessions_recommended) || buildHeuristicRecommendation(formData.constitution, formData.symptomScores).sessions_recommended,
          spacing_days: Number(data.recommendation.spacing_days) || buildHeuristicRecommendation(formData.constitution, formData.symptomScores).spacing_days,
          severity_score: Number(data.recommendation.severity_score) || buildHeuristicRecommendation(formData.constitution, formData.symptomScores).severity_score,
        };
        const totalPriorityScore =
          Number(data.priorityResult?.totalScore) ||
          Number(data.recommendation.totalPriorityScore) ||
          Number(data.recommendation.priority_score) ||
          buildHeuristicRecommendation(formData.constitution, formData.symptomScores).totalPriorityScore;
        setFormData(prev => ({
          ...prev,
          recommendation: {
            ...normalizedRecommendation,
            totalPriorityScore,
          }
        }));

        const doctors = await fetchDoctors();
        const matched = matchDoctors(doctors, formData.symptoms, normalizedRecommendation.therapy, formData.radiusKm);

        setFormData(prev => ({ ...prev, matchedDoctors: matched }));
      } else {
        throw new Error(data.error || "Failed to generate recommendation");
      }
    } catch (error) {
      console.error("Error generating recommendation:", error);
      toast({
        title: language === "hi" ? "AI इंजन से कनेक्ट हो रहा है" : "Connecting AI Engine",
        description: language === "hi" ? "सुरक्षित डिफ़ॉल्ट का उपयोग किया जा रहा है..." : "Falling back to safe defaults...",
        variant: "default",
      });

      const fallbackRec = buildHeuristicRecommendation(formData.constitution, formData.symptomScores);

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

  const setDoctorCount = (count: number) => {
    const safe = Math.max(1, Math.min(10, count));
    setDoctorSessionCount(safe);
    setDoctorSessionDateTimes((prev) => {
      const next = [...prev];
      while (next.length < safe) next.push({ date: '', time: '' });
      return next.slice(0, safe);
    });
  };

  const syncDoctorSlots = (rows: Array<{ date: string; time: string }>) => {
    const parsed = rows
      .map((r) => {
        if (!r.date || !r.time) return null;
        const iso = new Date(`${r.date}T${r.time}:00`).toISOString();
        return Number.isNaN(new Date(iso).getTime()) ? null : iso;
      })
      .filter(Boolean) as string[];
    setFormData((prev) => ({ ...prev, selectedSlots: parsed }));
  };

  // ─── FIX #1: Standardised field names so DoctorDashboard can see sessions ─
  // ─── FIX #2: Removed duplicate session creation (DoctorDashboard callback  ─
  //             no longer creates sessions — it just calls fetchData())        ─
  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const selectedExistingPatient = availablePatients.find((p: any) => p.id === selectedExistingPatientId);
      const patientId = role === 'doctor'
        ? (patientEntryMode === 'existing' && selectedExistingPatient ? selectedExistingPatient.id : `manual_patient_${Date.now()}`)
        : (user?.uid || `anonymous_${Date.now()}`);
      const patientName = role === 'doctor'
        ? (formData.name || selectedExistingPatient?.name || "Patient")
        : (formData.name || user?.name || "Patient");
      const patientEmail = role === 'doctor'
        ? (formData.email || selectedExistingPatient?.email || "")
        : (formData.email || user?.email || "");
      const doctorId = role === 'doctor' ? (user?.uid || "unknown") : (formData.selectedDoctor?.id || "unknown");
      const doctorName = role === 'doctor'
        ? (user?.name || "Doctor")
        : (formData.selectedDoctor?.name || formData.selectedDoctor?.clinicName || "Doctor");
      const therapy = formData.recommendation?.therapy || "Panchakarma";
      const scheduledSlots = formData.selectedSlots;
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

      // 2. Server-side booking: collisions (appointments + sessions), trusted priority, session cascade on bump
      const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      if (!firebaseUser) {
        toast({
          title: language === "hi" ? "प्रमाणीकरण त्रुटि" : "Authentication Error",
          description: language === "hi" ? "कृपया फिर से साइन इन करें।" : "Please sign in again.",
          variant: "destructive",
        });
        return;
      }
      const token = await firebaseUser.getIdToken();
      const bookingEndpoint = role === 'doctor' ? '/api/doctors/book-by-doctor' : '/api/doctors/book';
      const bookRes = await fetch(`${BACKEND_URL}${bookingEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId,
          patientName,
          patientEmail,
          doctorId,
          doctorName,
          clinicName: formData.selectedDoctor?.clinicName || '',
          therapy,
          scheduledSlots,
          intakeId: intakeDocRef.id,
          severity: severityScore,
          dosha: formData.constitution,
          reason: formData.reason,
          clinical_summary: formData.recommendation?.clinical_summary || '',
          precautions_pre: formData.recommendation?.precautions_pre || [],
          precautions_post: formData.recommendation?.precautions_post || [],
        }),
      });
      const bookJson = await bookRes.json().catch(() => ({}));
      if (!bookRes.ok) {
        throw new Error(bookJson.error || 'Booking failed');
      }

      // 3. Update the logged-in patient's profile with recommendation
      if (updateUserProfile && role !== 'doctor') {
        await updateUserProfile({
          // Persist dosha so later booking/discovery flows can compute priority accurately.
          dosha: formData.constitution,
          phone: formData.phone,
          reason_for_visit: formData.reason,
          symptoms: symptomsPayload as any,
          llm_recommendation: formData.recommendation || undefined
        });
      }

      toast({ title: t("schedule.bookingSubmitted"), description: t("schedule.bookingSubmittedDesc") });

      const sessionData = {
        patient: formData, doctorId, doctorName, recommendation: formData.recommendation, scheduledSlots
      };
      onComplete(sessionData);
      onClose();

    } catch (e: any) {
      console.error("Complete handle error:", e);
      toast({
        title: t("schedule.bookingFailed"),
        description: e.message || (language === "hi" ? "एक त्रुटि हुई" : "An error occurred"),
        variant: "destructive",
      });
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
      case 1:
        if (role !== 'doctor') return formData.name && formData.phone && formData.reason;
        if (patientEntryMode === 'existing') return Boolean(selectedExistingPatientId);
        return formData.name && formData.phone && formData.reason;
      case 2: return formData.symptoms.length > 0; // ← was: also requiring symptomScores to be non-empty
      case 3: return formData.recommendation;
      case 4: return role === 'doctor' ? true : formData.selectedDoctor !== null;
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
            <span>{t("schedule.newSessionStep", { step: currentStep })}</span>
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
                <h3 className="font-playfair text-xl font-semibold">{t("schedule.patientInfo")}</h3>
              </div>
              {role === 'doctor' && (
                <div className="space-y-2 mb-4">
                  <Label>Patient Selection Mode</Label>
                  <select
                    value={patientEntryMode}
                    onChange={(e) => setPatientEntryMode(e.target.value as 'manual' | 'existing')}
                    className="w-full p-2 border border-border rounded-md"
                  >
                    <option value="manual">Manual Entry</option>
                    <option value="existing">Select Existing Patient</option>
                  </select>
                </div>
              )}
              {role === 'doctor' && patientEntryMode === 'existing' && (
                <div className="space-y-2 mb-4">
                  <Label>Available Patients</Label>
                  <select
                    value={selectedExistingPatientId}
                    onChange={(e) => setSelectedExistingPatientId(e.target.value)}
                    className="w-full p-2 border border-border rounded-md"
                  >
                    <option value="">Select patient</option>
                    {availablePatients.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name || 'Unknown'} ({p.email || p.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
              <div className="flex items-center space-x-2 mb-4"><Brain className="w-5 h-5 text-primary" /><h3 className="font-playfair text-xl font-semibold">{t("schedule.symptomAssessment")}</h3></div>
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
                          if (!firebaseUser) {
                            throw new Error("Authentication required to check slots");
                          }
                          const token = await firebaseUser.getIdToken();

                          const slotsResponse = await fetch(`${BACKEND_URL}/api/scheduling/slots`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ practitionerId: doc.id, therapy: formData.recommendation.therapy, spacingDays: formData.recommendation.spacing_days, sessionsNeeded: formData.recommendation.sessions_recommended })
                          });
                          // If server now rejects auth, the UI falls back to safe defaults.
                          const slotsData = await slotsResponse.json();
                          if (slotsResponse.ok && slotsData.success && slotsData.slots) {
                            setMockSlots(slotsData.slots);
                            setFormData(prev => ({ ...prev, selectedSlots: slotsData.slots }));
                          } else {
                            // If slot generation fails (e.g. not enough spaced slots), fallback so UI still progresses.
                            const fallback = generateDefaultSlots(
                              Number(formData.recommendation?.sessions_recommended) || 5,
                              Number(formData.recommendation?.spacing_days) || 3
                            );
                            setMockSlots(fallback);
                            setFormData(prev => ({ ...prev, selectedSlots: fallback }));
                            toast({
                              title: "Limited Availability",
                              description: "Could not generate spaced availability. Showing safe fallback slots instead.",
                              variant: "default",
                            });
                          }
                        } catch (e) {
                          console.error("Using default slots due to network error.");
                          // FIX #6: fallback uses relative dates, not past hardcoded dates
                          const fallback = generateDefaultSlots(
                            Number(formData.recommendation?.sessions_recommended) || 5,
                            Number(formData.recommendation?.spacing_days) || 3
                          );
                          setMockSlots(fallback);
                          setFormData(prev => ({ ...prev, selectedSlots: fallback }));
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
              <div className="flex items-center space-x-2 mb-4"><Calendar className="w-5 h-5 text-primary" /><h3 className="font-playfair text-xl font-semibold">{t("schedule.selectSlots")}</h3></div>
              {role === 'doctor' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Number of Sessions</Label>
                    <select
                      value={doctorSessionCount}
                      onChange={(e) => setDoctorCount(Number(e.target.value))}
                      className="w-full p-2 border border-border rounded-md"
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    {doctorSessionDateTimes.map((row, idx) => (
                      <div key={`doctor-slot-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-3 border rounded-lg p-3">
                        <div className="font-medium">Session {idx + 1}</div>
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => {
                            const next = [...doctorSessionDateTimes];
                            next[idx] = { ...next[idx], date: e.target.value };
                            setDoctorSessionDateTimes(next);
                            syncDoctorSlots(next);
                          }}
                          className="p-2 border rounded-md"
                        />
                        <select
                          value={row.time}
                          onChange={(e) => {
                            const next = [...doctorSessionDateTimes];
                            next[idx] = { ...next[idx], time: e.target.value };
                            setDoctorSessionDateTimes(next);
                            syncDoctorSlots(next);
                          }}
                          className="p-2 border rounded-md"
                        >
                          <option value="">Select time</option>
                          {doctorTimeOptions.map((tm) => (
                            <option key={tm} value={tm}>{tm}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
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
              )}
            </Card>
          )}

          <div className="flex items-center justify-between pt-6 border-t">
            <Button variant="outline" onClick={currentStep === 1 ? onClose : handleBack} disabled={isLoading}>
              <ArrowLeft className="w-4 h-4 mr-2" />{currentStep === 1 ? t("schedule.cancel") : t("schedule.back")}
            </Button>
            {currentStep < 5 ? (
              <Button onClick={handleNext} disabled={!canProceed() || isLoading} className="ayur-button-hero">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : t("schedule.nextStep")}
                {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={!canProceed() || isLoading} className="ayur-button-accent">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : t("schedule.submitReview")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SchedulingWizard;
