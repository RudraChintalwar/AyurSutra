import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  FileText,
  Heart,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SessionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ─── FIX #3: Add onRefresh so parent can reload its session list ────────────
  onRefresh?: () => void;
  session?: {
    id: string;
    patient_id: string;
    datetime: string;
    therapy: string;
    duration_minutes: number;
    status: string;
    notes?: string;
  };
  patient?: {
    id: string;
    name: string;
    avatar?: string;
    phone?: string;
    email: string;
    dosha?: string;
    llm_recommendation?: {
      therapy: string;
      sessions_recommended: number;
      spacing_days: number;
      priority_score: number;
      explanation: string;
    };
  };
}

const SessionDetailsModal: React.FC<SessionDetailsModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  session,
  patient
}) => {
  const { toast } = useToast();
  const { firebaseUser } = useAuth();
  const { t, language } = useLanguage();
  // ─── FIX #3: State for doctor notes on completion ────────────────────────
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isActioning, setIsActioning] = useState(false);

  if (!session || !patient) return null;

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString(language === "hi" ? 'hi-IN' : 'en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'scheduled': return <Clock className="w-4 h-4 text-primary" />;
      case 'cancelled': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'pending_review': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'reschedule_requested': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (score: number) => {
    if (score >= 80) return 'text-red-600 bg-red-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const handleReschedule = () => {
    toast({ title: "Reschedule Session", description: "Opening scheduling interface..." });
    onClose();
  };

  // ─── FIX #3: handleCancel now writes to Firestore ────────────────────────
  const handleCancel = async () => {
    if (!firebaseUser) {
      toast({ title: 'Sign in required', description: 'Please sign in again.', variant: 'destructive' });
      return;
    }
    setIsActioning(true);
    try {
      const token = await firebaseUser.getIdToken();
      await axios.patch(
        `${API_URL}/api/sessions/${session.id}/cancel`,
        { cancelReason: 'Cancelled by doctor' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({
        title: "Session Cancelled",
        description: "The session has been cancelled and the patient will be notified.",
        variant: "destructive"
      });
      onRefresh?.();
      onClose();
    } catch (e: any) {
      console.error("Cancel error:", e);
      toast({ title: "Error", description: "Failed to cancel the session.", variant: "destructive" });
    } finally {
      setIsActioning(false);
    }
  };

  // ─── FIX #3: handleComplete now writes to Firestore including doctor notes ─
  const handleComplete = async () => {
    if (!firebaseUser) {
      toast({ title: 'Sign in required', description: 'Please sign in again.', variant: 'destructive' });
      return;
    }
    setIsActioning(true);
    try {
      const token = await firebaseUser.getIdToken();
      await axios.patch(
        `${API_URL}/api/sessions/${session.id}/complete`,
        { doctorNotes: doctorNotes.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({
        title: "Session Marked Complete ✅",
        description: "Session notes saved and status updated.",
      });
      onRefresh?.();
      onClose();
    } catch (e: any) {
      console.error("Complete error:", e);
      toast({ title: "Error", description: "Failed to mark session as complete.", variant: "destructive" });
    } finally {
      setIsActioning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-primary" />
            <span className="font-playfair">{t("sessionDetails.title")}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Info Header */}
          <div className="flex items-start space-x-4 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
            <Avatar className="w-16 h-16">
              <AvatarImage src={patient.avatar} alt={patient.name} />
              <AvatarFallback className="text-lg">
                {patient.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-playfair text-xl font-semibold">{patient.name}</h3>
              <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center"><Phone className="w-4 h-4 mr-1" />{patient.phone || 'N/A'}</div>
                <div className="flex items-center"><Mail className="w-4 h-4 mr-1" />{patient.email}</div>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <Badge className={`dosha-${(patient.dosha || 'vata').toLowerCase()}`}>
                  {patient.dosha || 'Unknown'} Constitution
                </Badge>
                <Badge className={getPriorityColor(patient.llm_recommendation?.priority_score || 0)}>
                  Priority: {patient.llm_recommendation?.priority_score || 'N/A'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Session Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-playfair text-lg font-semibold">{t("sessionDetails.sessionInfo")}</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(session.status)}
                    <Badge variant={session.status === 'completed' ? 'default' : 'outline'}>
                      {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date & Time</span>
                  <div className="font-medium text-right">{formatDateTime(session.datetime)}</div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Therapy</span>
                  <span className="font-medium">{session.therapy}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{session.duration_minutes} minutes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <div className="flex items-center text-sm"><MapPin className="w-4 h-4 mr-1" />Treatment Room A</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-playfair text-lg font-semibold">{t("sessionDetails.treatmentPlan")}</h4>
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-start space-x-2 mb-2">
                  <Heart className="w-4 h-4 mt-1 text-primary" />
                  <div>
                    <div className="font-medium text-sm">Recommended Treatment</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {patient.llm_recommendation?.therapy || 'N/A'} — {patient.llm_recommendation?.sessions_recommended || 0} sessions
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground">Priority Score</div>
                  <div className="flex items-center mt-1">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${patient.llm_recommendation?.priority_score || 0}%` }}
                      />
                    </div>
                    <span className="ml-2 text-xs font-medium">
                      {patient.llm_recommendation?.priority_score || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {session.notes && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Session Notes</span>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg text-sm">{session.notes}</div>
                </div>
              )}

              {/* ─── FIX #3: Doctor notes field shown only for active sessions ───── */}
              {session.status === 'scheduled' || session.status === 'pending_review' || session.status === 'confirmed' ? (
                <div>
                  <Label className="text-sm font-medium">Doctor Notes (optional)</Label>
                  <Textarea
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="Add clinical notes for this session..."
                    className="mt-1 resize-none"
                    rows={2}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isActioning}>
            {t("sessionDetails.close")}
          </Button>

          <div className="flex space-x-2">
            {(session.status === 'scheduled' || session.status === 'pending_review' || session.status === 'confirmed') && (
              <>
                <Button variant="outline" onClick={handleReschedule} disabled={isActioning}>
                  <Edit className="w-4 h-4 mr-2" />{t("sessionDetails.reschedule")}
                </Button>
                {/* ─── FIX #3: Cancel now actually writes status to Firestore ─── */}
                <Button variant="outline" onClick={handleCancel} disabled={isActioning} className="text-red-600 hover:text-red-700">
                  {isActioning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  {t("sessionDetails.cancel")}
                </Button>
                {/* ─── FIX #3: Complete now actually writes status to Firestore ── */}
                <Button onClick={handleComplete} disabled={isActioning} className="ayur-button-hero">
                  {isActioning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  {t("sessionDetails.markComplete")}
                </Button>
              </>
            )}

            {session.status === 'completed' && (
              <Button
                onClick={() => toast({ title: "Session Report", description: "Generating detailed session report..." })}
                className="ayur-button-accent"
              >
                <FileText className="w-4 h-4 mr-2" />View Report
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionDetailsModal;
