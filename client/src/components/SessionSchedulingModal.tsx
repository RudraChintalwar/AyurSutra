import React, { useState } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, User, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface SessionSchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SessionSchedulingModal: React.FC<SessionSchedulingModalProps> = ({ isOpen, onClose }) => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('');
  const [therapy, setTherapy] = useState('');
  const [priority, setPriority] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const therapyOptions = [
    'Panchakarma Detox',
    'Abhyanga Massage',
    'Shirodhara',
    'Nasya',
    'Basti',
    'Virechana',
    'Consultation',
    'Follow-up'
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
      toast({ title: "Authentication Error", description: "You must be logged in to schedule a session.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create a JS Date object combining selected date and selected time
      const [hours, minutes] = selectedTime.split(':');
      const sessionDatetime = new Date(selectedDate);
      sessionDatetime.setHours(parseInt(hours, 10));
      sessionDatetime.setMinutes(parseInt(minutes, 10));

      const sessionData = {
        patient_id: user.uid,
        practitioner_id: 'dr1', // For MVP, assigning a default doctor or picking one based on logic
        datetime: sessionDatetime.toISOString(),
        duration_minutes: therapy.includes('Consultation') ? 30 : 60,
        status: 'scheduled',
        therapy: therapy,
        session_number: 1, // Logic to determine next session number can be added here
        notes: notes,
        priority: priority || 'routine',
        created_at: new Date().toISOString()
      };

      await addDoc(collection(db, 'sessions'), sessionData);

      try {
        await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/notifications/session-reminder`, {
          patientEmail: user.email,
          patientName: user.name || 'Patient',
          therapy: therapy,
          datetime: sessionDatetime.toISOString(),
          precautions: ["Please arrive 10 minutes early", "Wear lose and comfortable clothing", "Keep yourself hydrated"]
        });
      } catch (e) {
        console.error("Failed to send email notification", e);
      }

      toast({
        title: "Session Scheduled Successfully! 🎉",
        description: `Your ${therapy} session is booked for ${selectedDate.toDateString()} at ${selectedTime}`,
      });
      
      // Reset form
      setSelectedDate(undefined);
      setSelectedTime('');
      setTherapy('');
      setPriority('');
      setNotes('');
      onClose();
    } catch (error: any) {
      console.error("Error scheduling session:", error);
      toast({
        title: "Failed to schedule",
        description: error.message || "An error occurred while booking.",
        variant: "destructive"
      });
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
                  disabled={(date) => date < new Date() || date.getDay() === 0}
                  className="rounded-md"
                />
              </div>
            </div>

            {/* Therapy Selection */}
            <div>
              <Label className="text-base font-medium">Therapy Type *</Label>
              <Select value={therapy} onValueChange={setTherapy}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose therapy type" />
                </SelectTrigger>
                <SelectContent>
                  {therapyOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* Time Selection */}
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
                    <Clock className="w-3 h-3 mr-1" />
                    {time}
                  </Button>
                ))}
              </div>
            </div>

            {/* Priority Level */}
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

            {/* Additional Notes */}
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
              <Sparkles className="w-4 h-4 mr-2 text-primary" />
              Session Summary
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Date:</span>
                <div className="font-medium">{selectedDate.toDateString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Time:</span>
                <div className="font-medium">{selectedTime}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Therapy:</span>
                <div className="font-medium">{therapy}</div>
              </div>
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
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