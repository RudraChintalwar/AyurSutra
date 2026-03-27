import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar,
  Clock,
  User,
  CheckCircle,
  AlertTriangle,
  FileText,
  Star,
  Activity
} from 'lucide-react';
import FeedbackForm from './FeedbackForm';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';
import { useLanguage } from '@/contexts/LanguageContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SessionModalProps {
  session: any | null;
  isOpen: boolean;
  onClose: () => void;
}

const SessionModal: React.FC<SessionModalProps> = ({ session, isOpen, onClose }) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [relatedSessions, setRelatedSessions] = useState<any[]>([]);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { user, firebaseUser } = useAuth();
  const isDoctor = user?.role === 'doctor';

  useEffect(() => {
    const fetchRelated = async () => {
      if (!session?.patient_id) return;
      try {
        const q = query(
          collection(db, 'sessions'),
          where('patient_id', '==', session.patient_id)
        );
        const snap = await getDocs(q);
        setRelatedSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching related sessions:', err);
      }
    };
    if (session) fetchRelated();
  }, [session]);

  if (!session) return null;

  const patient = { name: session.patient_name || 'Patient', dosha: session.dosha || 'N/A', reason_for_visit: session.reason || '', symptoms: session.symptoms || [] };
  const practitioner = { name: session.practitioner_name || 'Practitioner', specialty: session.specialty || 'Panchakarma' };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString(language === "hi" ? 'hi-IN' : 'en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  const handleFeedbackSubmit = async (feedbackData: any) => {
    try {
      if (!firebaseUser) {
        toast({ title: 'Sign in required', description: 'Please sign in to submit feedback.', variant: 'destructive' });
        return;
      }
      const token = await firebaseUser.getIdToken();
      // Emergency escalation persists feedback + priority on server; skip redundant PATCH.
      if (!feedbackData.llmResponse?.escalation) {
        const body: Record<string, unknown> = {
          feedback: feedbackData.feedback,
          feedback_submitted_at: new Date().toISOString(),
        };
        if (feedbackData.llmResponse?.sessionUpdate) {
          body.sessionUpdate = feedbackData.llmResponse.sessionUpdate;
        }
        await axios.patch(
          `${API_URL}/api/sessions/${session.id}/patient-feedback`,
          body,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      toast({
        title: feedbackData.llmResponse?.escalation ? '⚠️ Escalation Triggered' : '✅ Feedback Submitted',
        description: feedbackData.llmResponse?.ui_message || 'Your feedback has been recorded.',
      });

      // Show care instructions if any
      if (feedbackData.llmResponse?.care_instructions?.length > 0) {
        setTimeout(() => {
          toast({
            title: '📋 Care Instructions',
            description: feedbackData.llmResponse.care_instructions.join('. '),
          });
        }, 1500);
      }
    } catch (err) {
      console.error('Error saving feedback:', err);
      toast({ title: 'Error', description: 'Failed to save feedback.', variant: 'destructive' });
    }

    setShowFeedback(false);
    onClose();
  };

  const handleRescheduleRequest = async () => {
    try {
      if (!firebaseUser) {
        toast({ title: 'Sign in required', variant: 'destructive' });
        return;
      }
      const token = await firebaseUser.getIdToken();
      await axios.patch(
        `${API_URL}/api/sessions/${session.id}/reschedule-request`,
        { rescheduleReason: 'Patient requested to reschedule this session' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({ title: t('sessionModal.rescheduleRequested'), description: t('sessionModal.rescheduleRequestedDesc') });
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to request reschedule.', variant: 'destructive' });
    }
  };

  // Complete session handler (for doctors)
  const handleCompleteSessionFromModal = async () => {
    if (!session?.id || !firebaseUser) return;
    setIsCompleting(true);
    try {
      const token = await firebaseUser.getIdToken();
      await axios.patch(
        `${API_URL}/api/sessions/${session.id}/complete`,
        { doctorNotes: completionNotes.trim() || '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({ title: t('sessionModal.sessionCompleted'), description: `${session.therapy} session marked as completed.` });
      setCompletionNotes('');
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to complete session.', variant: 'destructive' });
    } finally {
      setIsCompleting(false);
    }
  };

  // Cancel session handler
  const handleCancelSession = async () => {
    if (!session?.id || !firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      await axios.patch(
        `${API_URL}/api/sessions/${session.id}/cancel`,
        { cancelReason: isDoctor ? 'Cancelled by doctor' : 'Cancelled by patient' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({ title: t('sessionModal.sessionCancelled'), description: language === "hi" ? 'सत्र रद्द कर दिया गया है।' : 'The session has been cancelled.' });
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to cancel session.', variant: 'destructive' });
    }
  };

  // Delete session handler (permanent removal)
  const handleDeleteSession = async () => {
    if (!session?.id || !firebaseUser) return;
    try {
      if (confirm('Are you sure you want to permanently delete this session from the database? This action cannot be undone.')) {
        const token = await firebaseUser.getIdToken();
        await axios.delete(`${API_URL}/api/sessions/${session.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast({ title: t('sessionModal.sessionDeleted'), description: language === "hi" ? 'सत्र स्थायी रूप से हटा दिया गया।' : 'The session was permanently removed.' });
        onClose();
        // Force refresh by reloading the page so it disappears
        window.location.reload();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete session.', variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'scheduled': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'confirmed': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending_review': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'bumped': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'reschedule_requested': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (showFeedback) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-playfair text-xl">{t("sessionModal.feedback")}</DialogTitle>
          </DialogHeader>
          <FeedbackForm
            sessionId={session.id}
            patientId={session.patient_id}
            patientName={session.patient_name || patient.name}
            patientEmail={session.patient_email}
            therapy={session.therapy}
            dosha={session.dosha}
            currentSeverity={session.severity_score}
            allSessions={relatedSessions}
            onSubmit={handleFeedbackSubmit}
            onCancel={() => setShowFeedback(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-playfair text-2xl flex items-center space-x-3">
            <Activity className="w-6 h-6 text-primary" />
            <span>{session.therapy} Session</span>
            <Badge className={`${getStatusColor(session.status)} border`}>
              {session.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Session Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-medium">{patient?.name}</div>
                  <div className="text-sm text-muted-foreground">{patient?.dosha} Constitution</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-medium">Session #{session.session_number}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateTime(session.datetime)}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-medium">{session.duration_minutes} minutes</div>
                  <div className="text-sm text-muted-foreground">
                    with {practitioner?.name}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
              <h4 className="font-semibold text-primary mb-2">Treatment Details</h4>
              <div className="space-y-2 text-sm">
                <div><strong>Therapy:</strong> {session.therapy}</div>
                <div><strong>Duration:</strong> {session.duration_minutes} minutes</div>
                <div><strong>Practitioner:</strong> {practitioner?.name}</div>
                <div><strong>Specialty:</strong> {practitioner?.specialty}</div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="precautions" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="precautions">Precautions</TabsTrigger>
              <TabsTrigger value="notes">Session Notes</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="precautions" className="space-y-4">
              {/* Pre-procedure */}
              {(session.precautions_pre || []).length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center text-orange-700">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Pre-Procedure Guidelines
                  </h4>
                  <div className="space-y-2">
                     {(session.precautions_pre || []).map((precaution: string, index: number) => (
                      <label key={index} className="flex items-center space-x-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="rounded"
                          onChange={(e) => {
                            if ((session.precautions_pre || []).length === 1) setAcknowledged(e.target.checked);
                          }}
                        />
                        <span className="text-sm">{precaution}</span>
                      </label>
                    ))}
                  </div>
                  {(session.status === 'scheduled' || session.status === 'confirmed' || session.status === 'pending_review') && !acknowledged && (
                    <Button 
                      onClick={() => setAcknowledged(true)}
                      variant="outline" 
                      size="sm"
                      className="mt-3"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Acknowledge Pre-Procedure Guidelines
                    </Button>
                  )}
                  {acknowledged && (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      Guidelines Acknowledged
                    </Badge>
                  )}
                </div>
              )}

              {/* Post-procedure */}
              {(session.precautions_post || []).length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center text-blue-700">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Post-Procedure Care
                  </h4>
                  <div className="space-y-2">
                     {(session.precautions_post || []).map((precaution: string, index: number) => (
                      <div key={index} className="flex items-center space-x-3">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm">{precaution}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold">Practitioner Notes</h4>
                </div>
                {session.doctor_notes ? (
                  <p className="text-sm text-foreground">{session.doctor_notes}</p>
                ) : session.status === 'completed' ? (
                  <p className="text-sm text-muted-foreground italic">No notes were added for this session.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Notes will be available after the session is completed.</p>
                )}
                {session.completed_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Completed: {new Date(session.completed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </p>
                )}
              </div>

              {/* Doctor inline completion form */}
              {isDoctor && (session.status === 'confirmed' || session.status === 'scheduled') && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete This Session
                  </h4>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Enter clinical notes (observations, patient response, treatment adjustments)..."
                    className="w-full p-3 border rounded-md text-sm min-h-[100px] mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={handleCompleteSessionFromModal}
                    disabled={isCompleting}
                    className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium disabled:opacity-50 flex items-center justify-center"
                  >
                    {isCompleting ? 'Completing...' : '✅ Mark as Completed'}
                  </button>
                </div>
              )}
              
              {patient && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <User className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold">Patient Background</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>Reason for visit:</strong> {patient.reason_for_visit || session.clinical_summary || 'Not specified'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Current symptoms:</strong> {patient.symptoms?.length > 0 ? patient.symptoms.map((s: any) => s.name || s).join(', ') : 'None recorded'}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="feedback" className="space-y-4">
              {session.status === 'completed' && !session.feedback && (
                <div className="text-center py-8">
                  <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h4 className="font-semibold mb-2">Share Your Experience</h4>
                  <p className="text-muted-foreground mb-4">
                    Help us improve your treatment by providing feedback on this session.
                  </p>
                  <Button onClick={() => setShowFeedback(true)} className="ayur-button-hero">
                    <Star className="w-4 h-4 mr-2" />
                    Provide Feedback
                  </Button>
                </div>
              )}

              {session.feedback && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-3">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <h4 className="font-semibold text-green-800">Feedback Submitted</h4>
                    </div>
                    <div className="text-sm space-y-2">
                      <p><strong>Submitted:</strong> {new Date(session.feedback.submitted_at).toLocaleString()}</p>
                      {session.feedback.notes && (
                        <p><strong>Notes:</strong> {session.feedback.notes}</p>
                      )}
                      <div className="pt-2">
                        <strong>Symptom Scores:</strong>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {Object.entries(session.feedback.symptom_scores).map(([symptom, score]: [string, any]) => (
                            <div key={symptom} className="flex justify-between text-xs">
                              <span>{symptom}:</span>
                              <span className="font-medium">{score}/10</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(session.status === 'scheduled' || session.status === 'confirmed' || session.status === 'pending_review') && (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Feedback will be available after the session is completed.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-semibold mb-3">Related Sessions</h4>
                <div className="space-y-2">
                  {relatedSessions
                    .filter(s => s.therapy === session.therapy)
                    .map((relatedSession: any, index: number) => (
                      <div key={relatedSession.id} className="flex items-center justify-between text-sm">
                        <span>Session #{relatedSession.session_number}</span>
                        <div className="flex items-center space-x-2">
                          <span>{new Date(relatedSession.datetime).toLocaleDateString()}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getStatusColor(relatedSession.status)}`}
                          >
                            {relatedSession.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <div className="flex items-center space-x-3">
              {/* Cancel button for any active session */}
              {['pending_review', 'scheduled', 'confirmed', 'bumped'].includes(session.status) && (
                <>
                  {isDoctor && (
                    <Button variant="outline" className="text-red-800 hover:bg-red-100 border-red-300 font-bold" onClick={handleDeleteSession}>
                      Delete
                    </Button>
                  )}
                  <Button variant="outline" className="text-red-600 hover:bg-red-50 border-red-200" onClick={handleCancelSession}>
                    Cancel Session
                  </Button>
                </>
              )}
              {/* Reschedule for patient */}
              {!isDoctor && (session.status === 'scheduled' || session.status === 'confirmed' || session.status === 'bumped') && (
                <Button variant="outline" onClick={handleRescheduleRequest}>
                  Request Reschedule
                </Button>
              )}
              {/* Complete for doctor */}
              {isDoctor && (session.status === 'confirmed' || session.status === 'scheduled') && (
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    setCompletionNotes('');
                    // Switch to notes tab to show the completion form
                    const notesTab = document.querySelector('[value="notes"]') as HTMLElement;
                    notesTab?.click();
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Session
                </Button>
              )}
              {/* Feedback for completed sessions */}
              {session.status === 'completed' && !session.feedback && (
                <Button onClick={() => setShowFeedback(true)} className="ayur-button-accent">
                  <Star className="w-4 h-4 mr-2" />
                  Add Feedback
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionModal;