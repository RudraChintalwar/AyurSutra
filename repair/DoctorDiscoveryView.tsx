import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, MapPin, Star, User, Stethoscope, Filter, ArrowLeft, Building, ArrowRight, Clock, CheckCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const DoctorDiscoveryView = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);

  // Slot Selection Modal State
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  // Generated slots (mock logic based on the date)
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // Use AI Recommendation constraints implicitly as filters
  const [filters, setFilters] = useState({
    requiredTherapy: state?.aiRecommendation?.therapy || state?.recommendation?.therapy || '',
    radiusKm: 50,
    gender: 'Any'
  });

  const patientLocation = (user as any)?.geolocation || { lat: 21.1458, lng: 79.0882 };

  useEffect(() => {
    fetchEligibleDoctors();
  }, [filters]);

  // Generate available slots when date or doctor changes
  // BUG 15 FIX: Old generator used `9 + timeOffset + (i*2)` hours without
  // clamping, could produce hours outside clinic hours. Also always anchored
  // all slots to 9 AM on the selected date regardless of the i offset, making
  // every date return identical absolute times. New version produces 4 evenly
  // spread slots between 9 AM and 5 PM and skips weekends.
  useEffect(() => {
    if (selectedDate && selectedDoctor) {
      const CLINIC_OPEN  = 9;
      const CLINIC_CLOSE = 17;
      const slots: string[] = [];
      const base = new Date(selectedDate);

      // Skip weekends
      if (base.getDay() === 6) base.setDate(base.getDate() + 2); // Sat → Mon
      if (base.getDay() === 0) base.setDate(base.getDate() + 1); // Sun → Mon

      // 4 slots: 9, 11, 14, 16 (all within clinic hours)
      const SLOT_HOURS = [9, 11, 14, 16];
      for (const hour of SLOT_HOURS) {
        if (hour >= CLINIC_OPEN && hour < CLINIC_CLOSE) {
          const slot = new Date(base);
          slot.setHours(hour, 0, 0, 0);
          slots.push(slot.toISOString());
        }
      }
      setAvailableSlots(slots);
    }
  }, [selectedDate, selectedDoctor]);

  const calculateDistanceKM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const p = 0.017453292519943295;
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
    return 12742 * Math.asin(Math.sqrt(a));
  };

  const fetchEligibleDoctors = async () => {
    setLoading(true);
    try {
      let queryConstraints: any[] = [where('role', '==', 'doctor')];

      if (filters.requiredTherapy) {
          queryConstraints.push(where('supportedTherapies', 'array-contains', filters.requiredTherapy));
      }
      if (filters.gender && filters.gender !== 'Any') {
          queryConstraints.push(where('gender', '==', filters.gender));
      }

      const q = query(collection(db, 'users'), ...queryConstraints);
      const snapshot = await getDocs(q);
      
      let fetchedDoctors: any[] = [];

      snapshot.forEach(docSnap => {
          const data = docSnap.data();

          let distance = null;
          if (patientLocation.lat && patientLocation.lng && data.geolocation?.lat && data.geolocation?.lng) {
              distance = calculateDistanceKM(
                  patientLocation.lat, patientLocation.lng,
                  data.geolocation.lat, data.geolocation.lng
              );
              if (distance > filters.radiusKm) return;
          }

          fetchedDoctors.push({
              doctorId: docSnap.id,
              name: data.name,
              clinicName: data.clinicName || 'AyurSutra Network Clinic',
              address: data.clinicAddress,
              distanceKm: distance ? Number(distance.toFixed(1)) : null,
              rating: data.rating || 4.5, // fallback if missing
              experience: data.yearsOfExperience,
              gender: data.gender,
              therapies: data.supportedTherapies || [],
              expertiseSymptoms: data.expertiseSymptoms || [],
              specialization: data.specialization || ''
          });
      });

      const symptoms = state?.aiRecommendation?.symptoms || state?.patientData?.symptoms || [];
      const normalize = (text: string) => text?.toLowerCase().trim();
      const symptomMap: Record<string, string[]> = {
        "bloating": ["digestive issues", "gas", "acidity", "gut"],
        "stress": ["anxiety", "mental stress", "mind"],
        "fatigue": ["low energy", "tiredness", "exhaustion"],
        "headache": ["migraine", "head pain"],
        "insomnia": ["sleep issues", "sleeplessness"],
        "joint stiffness": ["joint pain", "joint pains", "arthritis", "bones"],
        "digestive issues": ["bloating", "acidity", "indigestion", "gut"],
      };

      const scoredDoctors = fetchedDoctors.map(doc => {
          let score = 0;
          let expertise: string[] = [];
          
          if (doc.expertiseSymptoms.length > 0) {
              expertise = doc.expertiseSymptoms.map(normalize);
          } else if (doc.specialization) {
              let specs = typeof doc.specialization === 'string' ? doc.specialization.split(",") : doc.specialization;
              expertise = specs.map((s: string) => normalize(s));
          }

          const therapies = doc.therapies.map((t: string) => normalize(t));

          symptoms.forEach((symptom: string) => {
              const norm = normalize(symptom);
              if (expertise.includes(norm)) score += 3;
              const related = symptomMap[norm] || [];
              if (related.some((r: string) => expertise.includes(normalize(r)))) score += 2;
              if (expertise.some((e: string) => e.includes(norm))) score += 1;
          });

          if (filters.requiredTherapy) {
              const nt = normalize(filters.requiredTherapy);
              if (therapies.some((t: string) => t.includes(nt)) || expertise.some((e: string) => e.includes(nt))) score += 5;
          }

          if (doc.distanceKm !== null) {
              if (doc.distanceKm <= 5) score += 3;
              else if (doc.distanceKm <= 15) score += 2;
              else if (doc.distanceKm <= 30) score += 1;
          }

          return { ...doc, matchScore: score };
      });

      scoredDoctors.sort((a, b) => {
          if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;
          if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
          return 0;
      });

      setDoctors(scoredDoctors);

    } catch (e) {
      console.error("Doctor Smart Search Error:", e);
      toast({
        title: "Network Unreachable",
        description: "Failed to map clinic network. Trying again later.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSlotModal = (doctor: any) => {
    setSelectedDoctor(doctor);
    // Auto-select dates passed from scheduling wizard if any
    const initialSlots = state?.scheduledSlots || [];
    setSelectedSlots(initialSlots);
    if (initialSlots.length > 0) {
      setSelectedDate(new Date(initialSlots[0]));
    } else {
      setSelectedDate(new Date());
    }
    setShowSlotModal(true);
  };

  const handleBookingClick = async () => {
    if (!selectedDoctor) return;
    
    setBookingLoading(selectedDoctor.doctorId);
    try {
      const patientData = state?.patientData || {};
      const aiRec = state?.aiRecommendation || state?.recommendation || {};

      const payload = {
        patientId: user?.uid || patientData.patientId,
        patientName: user?.name || patientData.name || 'Patient',
        patientEmail: user?.email || patientData.email || '',
        doctorId: selectedDoctor.doctorId,
        doctorName: selectedDoctor.name,
        clinicName: selectedDoctor.clinicName,
        therapy: aiRec.therapy || filters.requiredTherapy || 'Panchakarma',
        scheduledSlots: selectedSlots,
        intakeId: state?.intakeId || null,
        priority: aiRec.totalPriorityScore || aiRec.priority_score || 50,
        severity: aiRec.severity_score || 5,
        dosha: user?.dosha || patientData.dosha || 'Unknown',
        reason: patientData.reason || user?.reason_for_visit || '',
      };

      // 1. Conflict checking and Priority Bumping logic directly in Frontend
      let bumpedAppointments = [];
      if (payload.scheduledSlots.length > 0) {
          const q = query(
              collection(db, 'appointments'),
              where('doctorId', '==', payload.doctorId),
              where('status', 'in', ['approved', 'pending'])
          );
          const existingSnap = await getDocs(q);
          const collisions: any[] = [];
          
          existingSnap.forEach(docSnap => {
              const data = docSnap.data();
              const intersection = (data.scheduledSlots || []).filter((slot: string) => payload.scheduledSlots.includes(slot));
              if (intersection.length > 0) {
                  collisions.push({ id: docSnap.id, ...data, collisionSlots: intersection });
              }
          });

          for (const collision of collisions) {
              const incomingPriority = payload.priority || 50;
              const existingPriority = collision.priority || 50;
              
              if (incomingPriority > existingPriority) {
                  bumpedAppointments.push(collision);
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

      // 2. Create appointment document
      const appointmentDoc = {
          ...payload,
          totalSessions: payload.scheduledSlots.length,
          status: 'pending',
          createdAt: new Date().toISOString(),
      };
      const appointmentRef = await addDoc(collection(db, 'appointments'), appointmentDoc);

      // 3. Create individual session documents for the doctor's pipeline
      // BUG 14 FIX: Use standardised field names that match what DoctorDashboard
      // queries. Old code used doctor_id, therapy_type, scheduled_date,
      // status:'scheduled', priority_score — all wrong.
      for (let i = 0; i < payload.scheduledSlots.length; i++) {
          const slot = payload.scheduledSlots[i];
          await addDoc(collection(db, 'sessions'), {
              patient_id: payload.patientId,
              patient_name: payload.patientName,
              patient_email: payload.patientEmail,
              practitioner_id: payload.doctorId,        // ← was: doctor_id
              doctor_name: selectedDoctor.name,
              appointment_id: appointmentRef.id,
              therapy: payload.therapy,                 // ← was: therapy_type
              datetime: new Date(slot).toISOString(),   // ← was: scheduled_date
              session_number: i + 1,
              total_sessions: payload.scheduledSlots.length,
              duration_minutes: payload.therapy?.includes('Vamana') ? 120 : 90,
              status: 'pending_review',                 // ← was: 'scheduled'
              doctor_approval: 'pending',
              priority: payload.priority,               // ← was: priority_score
              totalPriorityScore: payload.priority,
              severity_score: payload.severity || 5,
              dosha: payload.dosha,                     // ← was: dosha_imbalance
              reason: payload.reason || '',
              feedback_escalation: false,
              feedback_multiplier: 1.0,
              created_at: new Date().toISOString()
          });
      }

      setShowSlotModal(false);
      toast({
        title: "Booking Request Sent! 🌿",
        description: `Your ${aiRec.therapy || 'therapy'} request has been sent to ${selectedDoctor.name}.`,
      });
      navigate('/patient-dashboard', { replace: true });
    } catch (e: any) {
      console.error('Booking error:', e);
      toast({
        title: "Booking Failed",
        description: e.message || "Could not send booking request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setBookingLoading(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Context Link */}
      <div className="flex items-center space-x-4 mb-8 text-primary cursor-pointer hover:underline" onClick={() => navigate('/patient/sessions')}>
         <ArrowLeft className="w-4 h-4" />
         <span className="font-semibold">Back to Triage Diagnostics</span>
      </div>
      
      <div className="mb-8">
        <h1 className="font-playfair text-3xl md:text-4xl text-primary font-bold">Discover Care</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
           Our algorithmic mapping system has pre-selected doctors highly skilled in fulfilling your AI-assigned protocol: <span className="text-accent underline">{filters.requiredTherapy || 'Panchakarma Therapy'}</span>. Customize your constraints below.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* FILTERS SIDEBAR */}
        <Card className="lg:col-span-1 p-6 h-fit ayur-card sticky top-20">
          <div className="flex items-center mb-6 space-x-2 border-b pb-4">
             <Filter className="w-5 h-5 text-primary" />
             <h2 className="text-xl font-playfair font-semibold">Preferences</h2>
          </div>

          <div className="space-y-6">
             {/* Radius Filter */}
             <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold text-foreground">Max Distance</Label>
                    <span className="text-xs text-muted-foreground">{filters.radiusKm} km</span>
                </div>
                <Slider 
                   value={[filters.radiusKm]} 
                   max={250} step={10} min={10} 
                   onValueChange={(val) => setFilters(p => ({...p, radiusKm: val[0]}))}
                />
             </div>

             {/* Gender Filter */}
             <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">Physician Gender</Label>
                <div className="flex space-x-2">
                    {['Any', 'Male', 'Female'].map(g => (
                        <Badge 
                           key={g} 
                           variant={filters.gender === g ? "default" : "outline"}
                           className="cursor-pointer px-3 py-1"
                           onClick={() => setFilters(p => ({...p, gender: g}))}
                        >
                            {g}
                        </Badge>
                    ))}
                </div>
             </div>

             {/* Implicit Triage Display */}
             <div className="mt-8 p-4 bg-primary/5 rounded border border-primary/20">
                <div className="text-xs text-primary font-semibold mb-2">CRITICAL REQUIREMENT</div>
                <Badge variant="outline" className="w-full justify-center border-accent text-accent bg-accent/5">
                   {filters.requiredTherapy} Capability
                </Badge>
             </div>
          </div>
        </Card>

        {/* RESULTS GRID */}
        <div className="lg:col-span-3">
            {loading ? (
                <div className="flex flex-col items-center justify-center p-24 text-primary">
                   <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
                   <p className="font-playfair text-xl">Connecting with clinics...</p>
                </div>
            ) : doctors.length === 0 ? (
                <Card className="p-16 text-center ayur-card border-dashed">
                    <Stethoscope className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-2xl font-playfair mb-2">No Matching Physicians Found</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        We could not find any clinics within {filters.radiusKm}km specialized in {filters.requiredTherapy}. Try expanding your search radius.
                    </p>
                    <Button variant="outline" className="mt-6" onClick={() => setFilters(p => ({...p, radiusKm: 250}))}>
                        Expand Search to 250km
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {doctors.map(doc => (
                        <Card key={doc.doctorId} className="p-6 transition-transform hover:scale-[1.02] ayur-card flex flex-col h-full bg-white shadow-sm border border-gray-100 hover:shadow-md hover:border-primary/30 group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                                        <User className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-playfair text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">{doc.name}</h3>
                                        <p className="text-sm text-gray-500 font-medium">{doc.experience} Years Experience</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="flex items-center bg-green-50 px-2 py-1 rounded text-green-700 text-sm font-semibold">
                                        Match Score: {doc.matchScore}
                                    </div>
                                    <span className="text-xs text-muted-foreground font-medium mt-1">⭐ {doc.rating}</span>
                                </div>
                            </div>
                            
                            <div className="space-y-3 flex-grow border-t border-gray-100 pt-4">
                                <div className="flex items-start text-sm text-gray-600">
                                    <Building className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-accent" />
                                    <div>
                                        <span className="font-medium">{doc.clinicName}</span><br />
                                        <span className="text-xs text-gray-500">{doc.address?.area}, {doc.address?.city}</span>
                                    </div>
                                </div>
                                <div className="flex items-center text-sm text-gray-600">
                                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" />
                                    <span className="font-medium text-gray-700">{doc.distanceKm} km away</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-6 border-t border-gray-100 pt-5">
                                <Button variant="outline" className="w-full rounded-md font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 border-gray-200">
                                    View Profile
                                </Button>
                                <Button 
                                    className="w-full ayur-button-accent rounded-md" 
                                    onClick={() => handleOpenSlotModal(doc)}
                                >
                                  <>Select Slots <ArrowRight className="w-3 h-3 ml-2" /></>
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Slot Selection Modal */}
      <Dialog open={showSlotModal} onOpenChange={setShowSlotModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-playfair text-2xl text-primary">Select Appointment Slots</DialogTitle>
            <DialogDescription>
              Choose convenient dates and times from {selectedDoctor?.name}'s schedule for your {filters.requiredTherapy || 'therapy'}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
             {/* Calendar side */}
             <div>
                <Label className="text-sm font-semibold text-foreground mb-3 block">1. Pick a Date</Label>
                <div className="border rounded-md p-2 bg-white flex justify-center shadow-sm">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md"
                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                  />
                </div>
             </div>

             {/* Timeslots side */}
             <div>
                <Label className="text-sm font-semibold text-foreground mb-3 block">
                  2. Pick Available Slots on {selectedDate?.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </Label>
                
                {availableSlots.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {availableSlots.map((slot, index) => {
                      const isSelected = selectedSlots.includes(slot);
                      return (
                        <label
                          key={slot}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedSlots([...selectedSlots, slot]);
                                } else {
                                  setSelectedSlots(selectedSlots.filter(s => s !== slot));
                                }
                              }}
                            />
                            <div>
                              <div className="font-medium text-sm text-gray-900">
                                {new Date(slot).toLocaleTimeString('en-IN', {
                                  hour: 'numeric', minute: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs bg-white text-gray-600">
                             <Clock className="w-3 h-3 mr-1" />
                             {state?.aiRecommendation?.therapy?.includes('Vamana') ? '120' : '90'} min
                          </Badge>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center border rounded-lg bg-gray-50 flex border-dashed flex-col items-center">
                    <CalendarIcon className="w-8 h-8 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">No slots available on this date.</p>
                  </div>
                )}

                {selectedSlots.length > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg mt-4 flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      {selectedSlots.length} slot(s) selected
                    </span>
                  </div>
                )}
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setShowSlotModal(false)} disabled={bookingLoading !== null}>
              Cancel
            </Button>
            <Button 
              className="ayur-button-accent" 
              onClick={handleBookingClick}
              disabled={selectedSlots.length === 0 || bookingLoading !== null}
            >
              {bookingLoading !== null ? 'Requesting...' : 'Request Booking'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoctorDiscoveryView;
