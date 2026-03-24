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
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

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
  const { toast } = useToast();
  const { user } = useAuth();

  const therapyOptions = [
    'Panchakarma Detox', 'Abhyanga Massage', 'Shirodhara',
    'Nasya', 'Basti', 'Virechana', 'Consultation', 'Follow-up'
  ];

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
  ];

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime || !therapy) {
      toast({
        title: "Please fill all required fields",
        description: "Date, time, and therapy type are required.",
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

      // ─── FIX #4: Conflict detection using a ±30-minute window ─────────────
      // Old code did an exact ISO string match which NEVER fires.
      // New code loads all scheduled sessions for the assigned doctor and
      // checks whether any existing session is within 30 minutes of the
      // requested time.
      let assignedDoctorId = '';
      try {
        const doctorsQuery = query(collection(db, 'users'), where('role', '==', 'doctor'));
        const doctorsSnap = await getDocs(doctorsQuery);
        if (!doctorsSnap.empty) {
          assignedDoctorId = doctorsSnap.docs[0].id;
        }
      } catch (e) {
        console.error('Error fetching doctors:', e);
      }

      if (assignedDoctorId) {
        const existingQ = query(
          collection(db, 'sessions'),
          where('practitioner_id', '==', assignedDoctorId),
          where('status', 'in', ['scheduled', 'pending_review', 'confirmed'])
        );
        const existingSnap = await getDocs(existingQ);
        const THIRTY_MIN_MS = 30 * 60 * 1000;
        const requestedMs = sessionDatetime.getTime();

        const hasConflict = existingSnap.docs.some(d => {
          const existing = d.data();
          // Support both field name variants for robustness
          const existingDatetimeStr = existing.datetime || existing.scheduled_date;
          if (!existingDatetimeStr) return false;
          const existingMs = new Date(existingDatetimeStr).getTime();
          return Math.abs(existingMs - requestedMs) < THIRTY_MIN_MS;
        });

        if (hasConflict) {
          toast({
            title: "Time Slot Conflict ⚠️",
            description: "A session already exists within 30 minutes of this time. Please choose a different slot.",
            variant: "destructive"
          });
          setIsSubmitting(false);
          return;
        }
      }

      // ─── Create session with standardised field names ─────────────────────
      const sessionData = {
        patient_id: user.uid,
        patient_name: user.name || 'Patient',
        patient_email: user.email || '',
        practitioner_id: assignedDoctorId || null,  // ← standardised field name
        datetime: sessionDatetimeISO,               // ← standardised field name
        duration_minutes: therapy.includes('Consultation') ? 30 : 60,
        status: 'pending_review',                   // ← goes through approval flow
        doctor_approval: 'pending',
        therapy: therapy,                           // ← standardised field name
        session_number: 1,
        notes: notes,
        priority: priority || 'routine',
        totalPriorityScore: 50,
        severity_score: 5,
        dosha: user.dosha || '',
        feedback_escalation: false,
        feedback_multiplier: 1.0,
        created_at: new Date().toISOString(),
      };

      await addDoc(collection(db, 'sessions'), sessionData);

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
          }
        );
      } catch (e) {
        console.error("Notification failed (non-critical):", e);
      }

      toast({
        title: "Session Requested! 🎉",
        description: `Your ${therapy} session on ${selectedDate.toDateString()} at ${selectedTime} is pending doctor review.`,
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
      toast({ title: "Failed to schedule", description: error.message || "An error occurred.", variant: "destructive" });
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
            <span className="font-playfair">Schedule New Session</span>
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSchedule} className="ayur-button-hero" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarIcon className="w-4 h-4 mr-2" />}
            {isSubmitting ? "Scheduling..." : "Schedule Session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionSchedulingModal;
