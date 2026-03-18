import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import SessionModal from '@/components/SessionModal';
import SchedulingWizard from '@/components/SchedulingWizard';
import MessageModal from '@/components/MessageModal';
import PatientDetailsModal from '@/components/PatientDetailsModal';
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
  Bell
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const patientsQ = query(collection(db, 'users'), where('role', '==', 'patient'));
        const pSnap = await getDocs(patientsQ);
        const pData = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPatients(pData);
        if (pData.length > 0) setSelectedPatient(pData[0]);

        // To make it fully linked to this doctor: where('practitioner_id', '==', user?.uid)
        // For testing we fetch all sessions or just those that exist
        const sessionsQ = collection(db, 'sessions'); 
        const sSnap = await getDocs(sessionsQ);
        const sData = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSessions(sData);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      }
    };
    fetchData();
  }, [user]);

  const handleSessionClick = (session: any) => {
    setSelectedSession(session);
    setShowSessionModal(true);
  };

  const handleSchedulingComplete = async (sessionData: any) => {
    console.log('New session scheduled:', sessionData);
    
    try {
      // Find or create the patient ID (for now we assume patient name or ID comes through)
      // Since it's a wizard that gathers name, phone, etc., we probably need to create a user doc 
      // if they don't exist. For MVP scheduling, let's just create the session records.
      
      const { patient, recommendation, scheduledSlots } = sessionData;
      
      // Try to find existing patient by phone/email in Firestore to get real user ID
      let realPatientId = 'new_patient';
      try {
        if (patient.phone) {
          const phoneQuery = query(collection(db, 'users'), where('phone', '==', patient.phone));
          const phoneSnap = await getDocs(phoneQuery);
          if (!phoneSnap.empty) {
            realPatientId = phoneSnap.docs[0].id;
          }
        }
        if (realPatientId === 'new_patient' && patient.email) {
          const emailQuery = query(collection(db, 'users'), where('email', '==', patient.email));
          const emailSnap = await getDocs(emailQuery);
          if (!emailSnap.empty) {
            realPatientId = emailSnap.docs[0].id;
          }
        }
      } catch (e) {
        console.error('Error looking up patient:', e);
      }

      // Check for time conflicts before scheduling
      const conflictChecks = await Promise.all(
        scheduledSlots.map(async (slot: string) => {
          const conflictQ = query(
            collection(db, 'sessions'),
            where('datetime', '==', new Date(slot).toISOString()),
            where('status', '==', 'scheduled')
          );
          const snap = await getDocs(conflictQ);
          return { slot, hasConflict: !snap.empty };
        })
      );
      const conflicts = conflictChecks.filter(c => c.hasConflict);
      if (conflicts.length > 0) {
        toast({
          title: "Schedule Conflict Detected! ⚠️",
          description: `${conflicts.length} slot(s) already booked. Non-conflicting slots will be scheduled.`,
          variant: "destructive"
        });
      }
      const validSlots = conflictChecks.filter(c => !c.hasConflict).map(c => c.slot);
      
      const sessionPromises = validSlots.map((slot: string, index: number) => {
        return addDoc(collection(db, 'sessions'), {
          patient_id: realPatientId,
          patient_name: patient.name,
          practitioner_id: user?.uid || 'dr1',
          datetime: new Date(slot).toISOString(),
          duration_minutes: recommendation.therapy.includes('Vamana') ? 120 : 90,
          status: 'scheduled',
          therapy: recommendation.therapy,
          session_number: index + 1,
          priority: recommendation.priority_score,
          created_at: new Date().toISOString()
        });
      });
      
      await Promise.all(sessionPromises);
      
      // Send email notification for the first scheduled slot
      if (patient.email && scheduledSlots.length > 0) {
        try {
          await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/notifications/session-reminder`, {
            patientEmail: patient.email,
            patientName: patient.name,
            therapy: recommendation.therapy,
            datetime: scheduledSlots[0],
            precautions: ["Please arrive 10 minutes early for prep", "Avoid heavy meals 2 hours before the session"]
          });
        } catch (e) {
          console.error("Failed to send email notification", e);
        }
      }

      toast({
        title: "Sessions Scheduled",
        description: `Successfully scheduled ${validSlots.length} sessions for ${patient.name}.`
      });
      
      // Refresh the data!
      const sessionsQ = collection(db, 'sessions'); 
      const sSnap = await getDocs(sessionsQ);
      setSessions(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
    } catch (error: any) {
      console.error("Error saving sessions:", error);
      toast({
        title: "Failed to schedule",
        description: error.message,
        variant: "destructive"
      });
    }
    
    setShowSchedulingWizard(false);
  };

  const handleViewFullProfile = () => {
    setShowPatientDetails(true);
  };

  // Phase D: Doctor Approval Workflow
  const handleApproval = async (sessionId: string, status: 'approved' | 'modified' | 'rejected') => {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, {
        doctor_approval: status,
        approved_at: new Date().toISOString(),
        approved_by: user?.uid || 'doctor',
      });
      toast({
        title: status === 'approved' ? 'Plan Approved ✅' : status === 'rejected' ? 'Plan Rejected ❌' : 'Plan Modified ✏️',
        description: `Treatment plan has been ${status}.`
      });
      // Refresh sessions
      const sessionsQ = collection(db, 'sessions');
      const sSnap = await getDocs(sessionsQ);
      setSessions(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Approval error:', err);
      toast({ title: 'Error', description: 'Failed to update approval status.', variant: 'destructive' });
    }
  };

  const handleNotificationClick = () => {
    toast({
      title: "Notifications",
      description: "Opening notification center...",
    });
    navigate('/doctor/messages');
  };

  // Get sessions sorted by priority for practitioner view
  const priorityQueue = sessions
    .map(session => {
      const patient = patients.find(p => p.id === session.patient_id || p.uid === session.patient_id);
      return { ...session, patient, priority: session.priority || patient?.llm_recommendation?.priority_score || 50 };
    })
    .filter(session => session.patient)
    .sort((a, b) => b.priority - a.priority);

  const getPriorityBadge = (score: number) => {
    if (score >= 80) return { label: 'High', className: 'priority-badge-high' };
    if (score >= 60) return { label: 'Medium', className: 'priority-badge-medium' };
    return { label: 'Low', className: 'priority-badge-low' };
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
        <Button 
          onClick={() => setShowSchedulingWizard(true)}
          className="ayur-button-accent"
        >
          <Plus className="w-4 h-4 mr-2" />
          Schedule New Session
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="ayur-card p-4 animate-slide-up">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {patients.length}
              </div>
              <div className="text-sm text-muted-foreground">Active Patients</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">
                {sessions.filter(s => s.status === 'scheduled').length}
              </div>
              <div className="text-sm text-muted-foreground">Scheduled Today</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {sessions.filter(s => s.status === 'completed').length}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {priorityQueue.filter(s => s.priority >= 80).length}
              </div>
              <div className="text-sm text-muted-foreground">High Priority</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Queue */}
        <div className="lg:col-span-1">
          <Card className="ayur-card p-6 h-fit">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-accent" />
              Priority Queue
            </h3>
            <div className="space-y-3">
              {priorityQueue.slice(0, 6).map((item, index) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all animate-slide-up hover:scale-[1.02] ${
                    selectedPatient?.id === item.patient_id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-muted/30 hover:bg-muted/50'
                  }`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => setSelectedPatient(item.patient!)}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={item.patient?.avatar} alt={item.patient?.name} />
                      <AvatarFallback>
                        {item.patient?.name?.split(' ').map((n: string) => n[0]).join('') || ''}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.patient?.name}</div>
                      <div className="text-xs text-muted-foreground">{item.therapy}</div>
                      <div className="text-xs text-muted-foreground">
                        Next: {formatDateTime(item.datetime)}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={`${getPriorityBadge(item.priority).className} text-xs animate-pulse-gentle`}>
                        {item.priority}
                      </Badge>
                      {item.doctor_approval && (
                        <div className="text-xs mt-1">
                          {item.doctor_approval === 'approved' ? '✅' : item.doctor_approval === 'rejected' ? '❌' : '✏️'}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Approval Buttons */}
                  {!item.doctor_approval && (
                    <div className="flex items-center space-x-1 mt-2 pt-2 border-t border-muted/30">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-6 px-2 text-green-600 hover:bg-green-50"
                        onClick={(e) => { e.stopPropagation(); handleApproval(item.id, 'approved'); }}
                      >
                        ✅ Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-6 px-2 text-red-600 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); handleApproval(item.id, 'rejected'); }}
                      >
                        ❌ Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Today's Schedule */}
        <div className="lg:col-span-1">
          <Card className="ayur-card p-6 h-fit">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-primary" />
              Today's Schedule
            </h3>
            <div className="space-y-2">
              {sessions
                .filter(session => {
                  const sessionDate = new Date(session.datetime).toDateString();
                  const today = new Date().toDateString();
                  return sessionDate === today || session.status === 'scheduled';
                })
                .map((session, index) => {
                  const patient = patients.find(p => p.id === session.patient_id || p.uid === session.patient_id);
                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg animate-fade-in cursor-pointer hover:bg-muted/50 transition-colors"
                      style={{ animationDelay: `${index * 0.1}s` }}
                      onClick={() => handleSessionClick(session)}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={patient?.avatar} alt={patient?.name} />
                          <AvatarFallback>
                            {patient?.name?.split(' ').map((n: string) => n[0]).join('') || ''}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{patient?.name}</div>
                          <div className="text-xs text-muted-foreground">{session.therapy}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatDateTime(session.datetime)}</div>
                        <Badge 
                          variant={session.status === 'completed' ? 'default' : 'outline'}
                          className="text-xs mt-1"
                        >
                          {session.status === 'completed' ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <Clock className="w-3 h-3 mr-1" />
                          )}
                          {session.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>

        {/* Selected Patient Detail */}
        <div className="lg:col-span-1">
          <Card className="ayur-card p-6 h-fit">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-primary" />
              Patient Details
            </h3>
            {selectedPatient && (
              <div className="animate-scale-in">
                <div className="flex items-center space-x-3 mb-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={selectedPatient.avatar} alt={selectedPatient.name} />
                    <AvatarFallback>
                      {selectedPatient.name.split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold text-lg">{selectedPatient.name}</h4>
                    <Badge className={`${getDoshaBadge(selectedPatient.dosha)} text-xs mb-1`}>
                      {selectedPatient.dosha}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Priority: {selectedPatient.llm_recommendation?.priority_score || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Contact</div>
                    <div className="text-sm">{selectedPatient.phone}</div>
                    <div className="text-sm">{selectedPatient.email}</div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Chief Complaint</div>
                    <div className="text-sm">{selectedPatient.reason_for_visit}</div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Current Symptoms</div>
                    {selectedPatient.symptoms?.map((symptom: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{symptom.name}</span>
                        <span className="font-medium">{symptom.score}/10</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Current Treatment</div>
                    <div className="p-3 bg-primary/5 rounded-lg">
                      <div className="text-sm font-medium text-primary">
                        {selectedPatient.llm_recommendation?.therapy || "No therapy recommended yet"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {selectedPatient.llm_recommendation?.sessions_recommended || 0} sessions • 
                        Every {selectedPatient.llm_recommendation?.spacing_days || 0} days
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-3 border-t">
                    <Button size="sm" className="flex-1 ayur-button-hero" onClick={handleViewFullProfile}>
                      View Full Profile
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleNotificationClick}>
                      <Bell className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modals */}
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