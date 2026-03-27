import React, { useState } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface SessionSchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

const SessionSchedulingModal: React.FC<SessionSchedulingModalProps> = ({ isOpen, onClose, onRefresh }) => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('');
  const [therapy, setTherapy] = useState('');
  const [priority, setPriority] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();
  const { t, language } = useLanguage();

  const therapyOptions = [
    'Panchakarma Detox', 'Abhyanga Massage', 'Shirodhara',
    'Nasya', 'Basti', 'Virechana', 'Consultation', 'Follow-up'
  ];

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
  ];

  React.useEffect(() => {
    if (isOpen) {
      const fetchDocs = async () => {
        try {
          const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
          const snap = await getDocs(q);
          setDoctors(snap.docs.map(d => ({id: d.id, ...d.data()})));
        } catch (e) {
          console.error("Failed to fetch doctors:", e);
        }
      };
      fetchDocs();
    } else {
      setSelectedDoctorId('');
      setSelectedDate(undefined);
      setSelectedTime('');
      setTherapy('');
      setPriority('');
      setNotes('');
    }
  }, [isOpen]);

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime || !therapy || !selectedDoctorId) {
      toast({
        title: language === "hi" ? "कृपया सभी आवश्यक फ़ील्ड भरें" : "Please fill all required fields",
        description: language === "hi" ? "तारीख, समय, थेरेपी प्रकार और डॉक्टर आवश्यक हैं।" : "Date, time, therapy type, and doctor are required.",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const [hours, minutes] = selectedTime.split(':');
      const sessionDatetime = new Date(selectedDate);
      sessionDatetime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const sessionDatetimeISO = sessionDatetime.toISOString();

      const assignedDoctorId = selectedDoctorId;
      const selectedDoctor = doctors.find((d) => d.id === assignedDoctorId);
      const prioritySeverityMap: Record<string, number> = {
        routine: 4,
        urgent: 7,
        emergency: 9,
      };

      if (!firebaseUser) {
        toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
        return;
      }
      const token = await firebaseUser.getIdToken();

      // Use authoritative booking API so collisions, priority, and bumps stay consistent.
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_BASE}/api/doctors/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId: user.uid,
          patientName: user.name || 'Patient',
          patientEmail: user.email || '',
          doctorId: assignedDoctorId,
          doctorName: selectedDoctor?.name || '',
          clinicName: selectedDoctor?.clinicName || '',
          therapy,
          scheduledSlots: [sessionDatetimeISO],
          intakeId: null,
          severity: prioritySeverityMap[priority || 'routine'] || 4,
          dosha: user.dosha || '',
          reason: notes || 'Direct scheduling request',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Booking failed');
      }

      // Fire-and-forget notification
      try {
        await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/notifications/session-reminder`,
          {
            patientEmail: user.email,
            patientName: user.name || 'Patient',
            therapy,
            datetime: sessionDatetimeISO,
            precautions: ["Please arrive 10 minutes early", "Wear loose comfortable clothing", "Stay hydrated"]
          },
          {
            headers: {
              Authorization: `Bearer ${(await firebaseUser.getIdToken()) || ''}`,
            },
          }
        );
      } catch (e) {
        console.error("Notification failed (non-critical):", e);
      }

      toast({
        title: t("schedule.bookingSubmitted"),
        description: `${therapy} - ${selectedDate.toDateString()} ${selectedTime}. ${t("schedule.bookingSubmittedDesc")}`,
      });

      // Reset
      setSelectedDate(undefined);
      setSelectedTime('');
      setTherapy('');
      setPriority('');
      setNotes('');
      onRefresh?.();
      onClose();
    } catch (error: any) {
      console.error("Error scheduling session:", error);
      toast({ title: t("schedule.bookingFailed"), description: error.message || (language === "hi" ? "एक त्रुटि हुई।" : "An error occurred."), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <CalendarIcon className="w-6 h-6 text-primary" />
            <span className="font-playfair">{t("schedule.newSessionStep", { step: 1 })}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Calendar Selection */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Select Date *</Label>
              <div className="mt-2 border rounded-lg p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                  className="rounded-md"
                />
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Select Doctor *</Label>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      Dr. {doc.name || doc.clinicName || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-base font-medium">Therapy Type *</Label>
              <Select value={therapy} onValueChange={setTherapy}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose therapy type" />
                </SelectTrigger>
                <SelectContent>
                  {therapyOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Available Times *</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {timeSlots.map((time) => (
                  <Button
                    key={time}
                    variant={selectedTime === time ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTime(time)}
                    className={selectedTime === time ? "ayur-button-hero" : ""}
                  >
                    <Clock className="w-3 h-3 mr-1" />{time}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Priority Level</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine Care</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-base font-medium">Additional Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific concerns or requirements..."
                className="mt-2 resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Session Summary */}
        {selectedDate && selectedTime && therapy && (
          <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center">
              <Sparkles className="w-4 h-4 mr-2 text-primary" />Session Summary
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><span className="text-muted-foreground">Date:</span><div className="font-medium">{selectedDate.toDateString()}</div></div>
              <div><span className="text-muted-foreground">Time:</span><div className="font-medium">{selectedTime}</div></div>
              <div><span className="text-muted-foreground">Therapy:</span><div className="font-medium">{therapy}</div></div>
            </div>
            {priority && (
              <Badge className="mt-2" variant={priority === 'emergency' ? 'destructive' : 'default'}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>{t("schedule.cancel")}</Button>
          <Button onClick={handleSchedule} className="ayur-button-hero" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarIcon className="w-4 h-4 mr-2" />}
            {isSubmitting ? (language === "hi" ? "शेड्यूल हो रहा है..." : "Scheduling...") : t("schedule.submitReview")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionSchedulingModal;
