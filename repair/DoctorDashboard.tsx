import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import SessionModal from '@/components/SessionModal';
import SchedulingWizard from '@/components/SchedulingWizard';
import MessageModal from '@/components/MessageModal';
import PatientDetailsModal from '@/components/PatientDetailsModal';
import FeedbackForm from '@/components/FeedbackForm';
import { 
  Calendar,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  Activity,
  Plus,
  Users,
  TrendingUp,
  Bell,
  XCircle,
  Edit,
  Zap,
  Loader2,
  FileText,
  Brain,
  Stethoscope,
  ArrowUpDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showSchedulingWizard, setShowSchedulingWizard] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [showModifyPanel, setShowModifyPanel] = useState(false);
  const [modifySessionId, setModifySessionId] = useState<string | null>(null);
  const [modifyTherapy, setModifyTherapy] = useState('');
  const [modifyDatetime, setModifyDatetime] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Complete Session state
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeSessionId, setCompleteSessionId] = useState<string | null>(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  // ─── Fetch Data ────────────────────────────────────────
  const fetchData = async () => {
    try {
      const patientsQ = query(collection(db, 'users'), where('role', '==', 'patient'));
      const pSnap = await getDocs(patientsQ);
      const pData = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(pData);
      if (pData.length > 0 && !selectedPatient) setSelectedPatient(pData[0]);

      const sessionsQ = query(
        collection(db, 'sessions'),
        where('practitioner_id', '==', user?.uid)
      );
      const sSnap = await getDocs(sessionsQ);
      const sData = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessions(sData);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSessionClick = (session: any) => {
    setSelectedSession(session);
    setShowSessionModal(true);
  };

  // ─── Scheduling Complete Handler ───────────────────────
  // FIX #2: The SchedulingWizard already writes all session documents to
  // Firestore with correct field names (practitioner_id, therapy, datetime,
  // status: 'pending_review'). The old version here created a second full set
  // of sessions on top of that, doubling every doctor-initiated booking.
  // Now we just refresh local state and show a toast.
  const handleSchedulingComplete = async (sessionData: any) => {
    toast({
      title: "Sessions Created — Pending Review 📋",
      description: `Sessions for ${sessionData?.patient?.name || 'patient'} are pending doctor approval.`
    });
    await fetchData();
    setShowSchedulingWizard(false);
  };

  // ─── Doctor Approval Workflow ──────────────────────────
  const handleApproval = async (sessionId: string, action: 'approved' | 'modified' | 'rejected') => {
    setActionLoading(sessionId);
    try {
      // Call backend review endpoint
      const response = await axios.post(`${API_URL}/api/scheduling/appointments/${sessionId}/review`, {
        action,
        doctorId: user?.uid,
        doctorName: user?.name,
        modifiedTherapy: action === 'modified' ? modifyTherapy : undefined,
        modifiedDatetime: action === 'modified' && modifyDatetime ? modifyDatetime : undefined,
      });

      if (response.data.success) {
        // Apply updates to Firestore
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, response.data.updateData);

        // If approved, send confirmation email to patient
        const session = sessions.find(s => s.id === sessionId);
        if (action === 'approved' && session?.patient_email) {
          try {
            await axios.post(`${API_URL}/api/notifications/session-reminder`, {
              patientEmail: session.patient_email,
              patientName: session.patient_name,
              therapy: session.therapy,
              datetime: session.datetime,
              precautions: ["Your session has been confirmed by the doctor", "Please arrive 15 minutes early"]
            });
          } catch (e) {
            console.error("Email notification failed:", e);
          }
        }

        toast({
          title: action === 'approved' ? 'Plan Approved ✅' : action === 'rejected' ? 'Plan Rejected ❌' : 'Plan Modified ✏️',
          description: `Treatment plan has been ${action} by Dr. ${user?.name || 'Doctor'}.`
        });

        setShowModifyPanel(false);
        setModifySessionId(null);
        await fetchData();
      }
    } catch (err) {
      console.error('Approval error:', err);
      toast({ title: 'Error', description: 'Failed to process review.', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Emergency Bump ────────────────────────────────────
  const handleEmergencyBump = async (session: any) => {
    setActionLoading(session.id);
    try {
      const allScheduled = sessions.filter(s => s.status === 'confirmed' || s.status === 'scheduled');
      const response = await axios.post(`${API_URL}/api/scheduling/check-conflicts`, {
        highPrioritySession: {
          ...session,
          patientEmail: session.patient_email,
          email: session.patient_email,
          totalPriorityScore: session.totalPriorityScore || session.priority || 90,
        },
        allScheduledSessions: allScheduled,
        availableSlots: allScheduled.map(s => s.datetime),
      });

      if (response.data.bumped) {
        // Update bumped session in Firestore
        if (response.data.bumpedSession?.sessionId || response.data.bumpedSession?.id) {
          const bumpedId = response.data.bumpedSession.sessionId || response.data.bumpedSession.id;
          await updateDoc(doc(db, 'sessions', bumpedId), {
            status: 'bumped',
            bumped_reason: response.data.bumpedSession.reason,
            original_datetime: response.data.bumpedSession.datetime,
            datetime: response.data.bumpedSession.newDatetime || response.data.bumpedSession.datetime,
          });
        }

        toast({
          title: "Emergency Bump Executed ⚡",
          description: `${session.patient_name} has been given priority. Bumped patient notified.`
        });
        await fetchData();
      } else {
        toast({
          title: "No Bump Needed",
          description: response.data.reason || "Slot is available without conflict.",
        });
      }
    } catch (err) {
      console.error("Bump error:", err);
      toast({ title: "Bump Failed", description: "Could not execute emergency bump.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Complete Session Handler ──────────────────────────
  const handleCompleteSession = async () => {
    if (!completeSessionId) return;
    setActionLoading(completeSessionId);
    try {
      const sessionRef = doc(db, 'sessions', completeSessionId);
      await updateDoc(sessionRef, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        doctor_notes: doctorNotes.trim() || '',
        completed_by: user?.uid || '',
      });

      // Send post-session notification to patient
      const session = sessions.find(s => s.id === completeSessionId);
      if (session?.patient_email) {
        try {
          await axios.post(`${API_URL}/api/notifications/send`, {
            to: session.patient_email,
            subject: `Session Completed — ${session.therapy}`,
            html: `<h2>Session Completed</h2>
              <p>Your ${session.therapy} session (Session #${session.session_number}) has been marked as completed by Dr. ${user?.name || 'your practitioner'}.</p>
              ${doctorNotes ? `<p><strong>Doctor's Notes:</strong> ${doctorNotes}</p>` : ''}
              <p>Please provide your feedback through the app to help us optimize your treatment plan.</p>`
          });
        } catch (e) {
          console.error('Post-session email failed:', e);
        }
      }

      toast({
        title: 'Session Completed ✅',
        description: `${session?.therapy} session for ${session?.patient_name || 'patient'} marked as completed.`
      });

      setShowCompleteDialog(false);
      setCompleteSessionId(null);
      setDoctorNotes('');
      await fetchData();
    } catch (err) {
      console.error('Complete session error:', err);
      toast({ title: 'Error', description: 'Failed to complete session.', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Cancel Session Handler ────────────────────────────
  const handleCancelSession = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      const session = sessions.find(s => s.id === sessionId);
      await updateDoc(sessionRef, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.uid || '',
        cancel_reason: 'Cancelled by doctor',
      });

      // Notify patient
      if (session?.patient_email) {
        try {
          await axios.post(`${API_URL}/api/notifications/send`, {
            to: session.patient_email,
            subject: `Session Cancelled — ${session.therapy}`,
            html: `<h2>Session Cancelled</h2>
              <p>Your ${session.therapy} session on ${new Date(session.datetime).toLocaleDateString()} has been cancelled by Dr. ${user?.name || 'your practitioner'}.</p>
              <p>Please contact the clinic to reschedule.</p>`
          });
        } catch (e) {
          console.error('Cancel notification email failed:', e);
        }
      }

      toast({
        title: 'Session Cancelled ❌',
        description: `Session for ${session?.patient_name || 'patient'} has been cancelled.`
      });
      await fetchData();
    } catch (err) {
      console.error('Cancel session error:', err);
      toast({ title: 'Error', description: 'Failed to cancel session.', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Priority Queue (computed) ─────────────────────────
  // ISSUE B FIX: Only use formula-computed scores stored on the session.
  // llm_recommendation.priority_score is an unvalidated LLM integer (not
  // produced by calculatePriorityScore) and must not be used as a sort key.
  // Sessions missing a score sort to the bottom (0) rather than using a guess.
  const priorityQueue = sessions
    .map(session => {
      const patient = patients.find(p => p.id === session.patient_id || p.uid === session.patient_id);
      const computedPriority = session.totalPriorityScore ?? session.priority ?? 0;
      return { ...session, patient, computedPriority };
    })
    .filter(session => session.status !== 'completed' && session.status !== 'rejected')
    .sort((a, b) => b.computedPriority - a.computedPriority);

  const getPriorityBadge = (score: number) => {
    if (score >= 80) return { label: 'High', className: 'bg-red-100 text-red-700 border-red-200' };
    if (score >= 60) return { label: 'Medium', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'Low', className: 'bg-green-100 text-green-700 border-green-200' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_review': return { label: '🟡 Pending', className: 'bg-yellow-100 text-yellow-800' };
      case 'confirmed': return { label: '✅ Confirmed', className: 'bg-green-100 text-green-800' };
      case 'scheduled': return { label: '📅 Scheduled', className: 'bg-blue-100 text-blue-800' };
      case 'completed': return { label: '🔵 Completed', className: 'bg-blue-100 text-blue-800' };
      case 'rejected': return { label: '❌ Rejected', className: 'bg-red-100 text-red-800' };
      case 'bumped': return { label: '⚡ Bumped', className: 'bg-purple-100 text-purple-800' };
      case 'reschedule_requested': return { label: '⚠️ Reschedule Req', className: 'bg-orange-100 text-orange-800 animate-pulse font-bold border-orange-200' };
      default: return { label: status, className: 'bg-gray-100 text-gray-800' };
    }
  };

  const getDoshaBadge = (dosha?: string) => {
    if (!dosha) return 'dosha-vata';
    if (dosha.includes('Vata')) return 'dosha-vata';
    if (dosha.includes('Pitta')) return 'dosha-pitta';
    if (dosha.includes('Kapha')) return 'dosha-kapha';
    return 'dosha-vata';
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  const pendingCount = sessions.filter(s => s.status === 'pending_review').length;
  const confirmedCount = sessions.filter(s => s.status === 'confirmed' || s.status === 'scheduled').length;
  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const highPriorityCount = priorityQueue.filter(s => s.computedPriority >= 80).length;

  return (
    <div className="p-6 space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-primary">
            Doctor Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Today's Priority Queue • {new Date().toLocaleDateString('en-IN')} • Dr. {user?.name || "Practitioner"}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => navigate('/doctor/messages')} variant="outline" size="sm">
            <Bell className="w-4 h-4 mr-1" />
            Messages
          </Button>
          <Button 
            onClick={() => setShowSchedulingWizard(true)}
            className="ayur-button-accent"
          >
            <Plus className="w-4 h-4 mr-2" />
            Schedule New Session
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="ayur-card p-4 animate-slide-up">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{patients.length}</div>
              <div className="text-sm text-muted-foreground">Patients</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">{confirmedCount}</div>
              <div className="text-sm text-muted-foreground">Confirmed</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{completedCount}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{highPriorityCount}</div>
              <div className="text-sm text-muted-foreground">High Priority</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Priority Queue Panel ─────────────────────── */}
        <div className="lg:col-span-1">
          <Card className="ayur-card p-6 h-fit">
            <h3 className="font-playfair text-xl font-semibold mb-1 flex items-center">
              <ArrowUpDown className="w-5 h-5 mr-2 text-accent" />
              Priority Queue
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Sorted by priority score (Max-Heap) • Severity 40% + Feedback 35% + Dosha 15% + Wait 10%
            </p>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {priorityQueue.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No sessions in queue</p>
              )}
              {priorityQueue.slice(0, 10).map((item, index) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all animate-slide-up hover:scale-[1.02] ${
                    selectedPatient?.id === item.patient_id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-muted/30 hover:bg-muted/50'
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                  onClick={() => item.patient && setSelectedPatient(item.patient)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={item.patient?.avatar} alt={item.patient?.name} />
                        <AvatarFallback>
                          {item.patient?.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>
                      {/* Rank badge */}
                      <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.patient?.name || item.patient_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.therapy || 'No therapy assigned'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(item.datetime)}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <Badge className={`${getPriorityBadge(item.computedPriority).className} text-xs font-bold border`}>
                        {item.computedPriority}
                      </Badge>
                      <Badge className={`${getStatusBadge(item.status).className} text-[10px] px-1.5`}>
                        {getStatusBadge(item.status).label}
                      </Badge>
                    </div>
                  </div>

                  {/* Approval Buttons for pending/reschedule sessions */}
                  {(item.status === 'pending_review' || item.status === 'reschedule_requested') && (
                    <div className="flex items-center space-x-1 mt-2 pt-2 border-t border-muted/30">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 text-green-600 hover:bg-green-50 flex-1"
                        disabled={actionLoading === item.id}
                        onClick={(e) => { e.stopPropagation(); handleApproval(item.id, 'approved'); }}
                      >
                        {actionLoading === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle className="w-3 h-3 mr-1" /> Approve</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 text-amber-600 hover:bg-amber-50 flex-1"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setModifySessionId(item.id); 
                          setModifyTherapy(item.therapy || '');
                          
                          // Format existing datetime for the datetime-local input
                          if (item.datetime) {
                            const d = new Date(item.datetime);
                            const pad = (n: number) => n.toString().padStart(2, '0');
                            const formatted = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                            setModifyDatetime(formatted);
                          }
                          
                          setShowModifyPanel(true); 
                        }}
                      >
                        <Edit className="w-3 h-3 mr-1" /> Modify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 text-red-600 hover:bg-red-50"
                        disabled={actionLoading === item.id}
                        onClick={(e) => { e.stopPropagation(); handleApproval(item.id, 'rejected'); }}
                      >
                        <XCircle className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {/* Emergency bump button for high-priority */}
                  {item.computedPriority >= 80 && (item.status === 'confirmed' || item.status === 'scheduled' || item.status === 'pending_review') && (
                    <div className="mt-2 pt-2 border-t border-muted/30">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 w-full text-red-600 hover:bg-red-50 border-red-200"
                        disabled={actionLoading === item.id}
                        onClick={(e) => { e.stopPropagation(); handleEmergencyBump(item); }}
                      >
                        {actionLoading === item.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                        Emergency Bump
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ─── Today's Schedule ────────────────────────── */}
        <div className="lg:col-span-1">
          <Card className="ayur-card p-6 h-fit">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-primary" />
              All Sessions
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {sessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No sessions found</p>
              )}
              {sessions
                .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
                .map((session, index) => {
                  const patient = patients.find(p => p.id === session.patient_id || p.uid === session.patient_id);
                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg animate-fade-in cursor-pointer hover:bg-muted/50 transition-colors"
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => handleSessionClick(session)}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={patient?.avatar} alt={patient?.name} />
                          <AvatarFallback>
                            {patient?.name?.split(' ').map((n: string) => n[0]).join('') || session.patient_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{patient?.name || session.patient_name}</div>
                          <div className="text-xs text-muted-foreground">{session.therapy}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatDateTime(session.datetime)}</div>
                        <Badge className={`${getStatusBadge(session.status).className} text-[10px] mt-1`}>
                          {getStatusBadge(session.status).label}
                        </Badge>
                        {/* Action buttons for confirmed sessions */}
                        {(session.status === 'confirmed' || session.status === 'scheduled') && (
                          <div className="flex items-center gap-1 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[10px] h-6 px-2 text-green-600 hover:bg-green-50"
                              disabled={actionLoading === session.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCompleteSessionId(session.id);
                                setDoctorNotes('');
                                setShowCompleteDialog(true);
                              }}
                            >
                              <CheckCircle className="w-3 h-3 mr-0.5" />
                              Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[10px] h-6 px-2 text-red-600 hover:bg-red-50"
                              disabled={actionLoading === session.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelSession(session.id);
                              }}
                            >
                              <XCircle className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>

        {/* ─── Patient Detail Panel ───────────────────── */}
        <div className="lg:col-span-1">
          <Card className="ayur-card p-6 h-fit">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <Stethoscope className="w-5 h-5 mr-2 text-primary" />
              Patient Clinical View
            </h3>
            {selectedPatient && (
              <div className="animate-scale-in space-y-4">
                {/* Patient header */}
                <div className="flex items-center space-x-3">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={selectedPatient.avatar} alt={selectedPatient.name} />
                    <AvatarFallback>
                      {selectedPatient.name?.split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold text-lg">{selectedPatient.name}</h4>
                    {selectedPatient.dosha && (
                      <Badge className={`${getDoshaBadge(selectedPatient.dosha)} text-xs mb-1`}>
                        {selectedPatient.dosha}
                      </Badge>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {selectedPatient.age && `Age: ${selectedPatient.age}`}
                      {selectedPatient.gender && ` • ${selectedPatient.gender}`}
                    </div>
                  </div>
                </div>

                {/* Priority Score */}
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium flex items-center">
                      <TrendingUp className="w-4 h-4 mr-1 text-accent" />
                      Priority Score
                    </span>
                    <Badge className={`${getPriorityBadge(selectedPatient.llm_recommendation?.priority_score || 0).className} text-xs font-bold border`}>
                      {selectedPatient.llm_recommendation?.priority_score || 'N/A'}
                    </Badge>
                  </div>
                  <Progress 
                    value={selectedPatient.llm_recommendation?.priority_score || 0} 
                    className="h-2" 
                  />
                </div>

                {/* Contact */}
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Contact</div>
                  <div className="text-sm">{selectedPatient.phone || 'No phone'}</div>
                  <div className="text-sm">{selectedPatient.email || 'No email'}</div>
                </div>

                {/* Chief Complaint */}
                {selectedPatient.reason_for_visit && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Chief Complaint</div>
                    <div className="text-sm">{selectedPatient.reason_for_visit}</div>
                  </div>
                )}

                {/* Symptoms with severity bars */}
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                    <Activity className="w-4 h-4 mr-1" />
                    Current Symptoms
                  </div>
                  {selectedPatient.symptoms && selectedPatient.symptoms.length > 0 ? (
                    <div className="space-y-2">
                      {selectedPatient.symptoms.map((symptom: any, index: number) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="flex-1">{symptom.name}</span>
                          <div className="flex items-center space-x-2 ml-2">
                            <div className="w-20 bg-muted rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${symptom.score >= 7 ? 'bg-red-500' : symptom.score >= 4 ? 'bg-amber-500' : 'bg-green-500'}`}
                                style={{ width: `${symptom.score * 10}%` }}
                              />
                            </div>
                            <span className="font-medium text-xs w-8 text-right">{symptom.score}/10</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No symptoms recorded yet. Patient needs to complete intake form.</p>
                  )}
                </div>

                {/* AI Suggested Treatment */}
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                    <Brain className="w-4 h-4 mr-1" />
                    AI Suggested Treatment
                  </div>
                  {selectedPatient.llm_recommendation ? (
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                      <div className="text-sm font-semibold text-primary">
                        {selectedPatient.llm_recommendation.therapy}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {selectedPatient.llm_recommendation.sessions_recommended} sessions • 
                        Every {selectedPatient.llm_recommendation.spacing_days} days •
                        Confidence: {selectedPatient.llm_recommendation.confidence || 'N/A'}%
                      </div>
                      {selectedPatient.llm_recommendation.explanation && (
                        <div className="text-xs mt-2 text-foreground/70 italic">
                          "{selectedPatient.llm_recommendation.explanation}"
                        </div>
                      )}
                      {selectedPatient.llm_recommendation.clinical_summary && (
                        <div className="text-xs mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                          <span className="font-medium text-blue-700">Clinical Summary: </span>
                          {selectedPatient.llm_recommendation.clinical_summary}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No AI recommendation yet. Schedule a session to generate one.</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2 pt-3 border-t">
                  <Button size="sm" className="flex-1 ayur-button-hero" onClick={() => setShowPatientDetails(true)}>
                    <FileText className="w-4 h-4 mr-1" />
                    Full Profile
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setShowMessageModal(true);
                  }}>
                    <Bell className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate('/doctor/calendar')}>
                    <Calendar className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            {!selectedPatient && (
              <p className="text-sm text-muted-foreground text-center py-8">Select a patient from the priority queue</p>
            )}
          </Card>
        </div>
      </div>

      {/* ─── Modify Panel (inline) ──────────────────────── */}
      {showModifyPanel && modifySessionId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <Card className="p-6 w-full max-w-md animate-scale-in">
            <h3 className="font-playfair text-lg font-semibold mb-4">Modify Treatment Plan</h3>
            <div className="space-y-4">
              <div>
                <Label>Therapy Type</Label>
                <Input 
                  value={modifyTherapy} 
                  onChange={(e) => setModifyTherapy(e.target.value)}
                  placeholder="e.g., Virechana, Basti, Abhyanga"
                />
              </div>
              <div>
                <Label>New Date & Time (Optional)</Label>
                <Input 
                  type="datetime-local"
                  value={modifyDatetime}
                  onChange={(e) => setModifyDatetime(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  className="flex-1" 
                  onClick={() => handleApproval(modifySessionId, 'modified')}
                  disabled={actionLoading === modifySessionId}
                >
                  {actionLoading === modifySessionId ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Confirm Modification
                </Button>
                <Button variant="outline" onClick={() => { setShowModifyPanel(false); setModifySessionId(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Complete Session Dialog ──────────────────────── */}
      {showCompleteDialog && completeSessionId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <Card className="p-6 w-full max-w-md animate-scale-in">
            <h3 className="font-playfair text-lg font-semibold mb-2">Complete Session</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Mark this session as completed and add your clinical notes.
            </p>
            <div className="space-y-4">
              <div>
                <Label>Session Notes</Label>
                <Textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Enter clinical notes about this session (observations, patient response, treatment adjustments)..."
                  className="min-h-[120px] mt-1"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleCompleteSession}
                  disabled={actionLoading === completeSessionId}
                >
                  {actionLoading === completeSessionId ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                  Mark as Completed
                </Button>
                <Button variant="outline" onClick={() => { setShowCompleteDialog(false); setCompleteSessionId(null); setDoctorNotes(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Modals ─────────────────────────────────────── */}
      <SessionModal
        session={selectedSession}
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
      />

      <SchedulingWizard
        isOpen={showSchedulingWizard}
        onClose={() => setShowSchedulingWizard(false)}
        onComplete={handleSchedulingComplete}
      />

      <MessageModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        recipient={selectedPatient ? {
          id: selectedPatient.id,
          name: selectedPatient.name,
          avatar: selectedPatient.avatar,
          role: 'patient'
        } : undefined}
      />

      <PatientDetailsModal
        isOpen={showPatientDetails}
        onClose={() => setShowPatientDetails(false)}
        patient={selectedPatient}
      />
    </div>
  );
};

export default DoctorDashboard;