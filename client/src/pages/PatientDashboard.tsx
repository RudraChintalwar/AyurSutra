import React, { useState, useEffect, useMemo } from 'react';
import DoshaQuiz from '@/components/dashboard/DoshaQuiz';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import SessionModal from '@/components/SessionModal';
import MessageModal from '@/components/MessageModal';
import SessionSchedulingModal from '@/components/SessionSchedulingModal';
import SessionDetailsModal from '@/components/SessionDetailsModal';
import { 
  Calendar,
  Clock,
  Activity,
  TrendingUp,
  Heart,
  MessageSquare,
  FileText,
  Star
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PatientDashboard = () => {
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [isSessionDetailsModalOpen, setIsSessionDetailsModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [patientSessions, setPatientSessions] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user?.uid) return;
      try {
        const q = query(collection(db, 'sessions'), where('patient_id', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const sessionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by datetime descending
        sessionsData.sort((a: any, b: any) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
        setPatientSessions(sessionsData);
      } catch (error) {
        console.error("Error fetching sessions:", error);
      }
    };
    fetchSessions();
  }, [user]);

  const handleSessionClick = (session: any) => {
    setSelectedSession(session);
    setShowSessionModal(true);
  };

  const handleScheduleSession = () => {
    toast({
      title: "Scheduling Session",
      description: "Redirecting to booking page...",
    });
    navigate('/patient/sessions');
  };

  const handleMessageDoctor = () => {
    setShowMessageModal(true);
  };

  const handleViewProgress = () => {
    toast({
      title: "Viewing Progress",
      description: "Loading your health progress...",
    });
    navigate('/patient/records');
  };

  const currentPatient = user;

  const getDoshaBadge = (dosha: string) => {
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

  const upcomingSessions = patientSessions.filter(s => s.status === 'scheduled');
  const completedSessions = patientSessions.filter(s => s.status === 'completed');

  return (
    <div className="p-6 space-y-6">
      {/* Patient Welcome Header */}
      <div className="ayur-card p-6 animate-slide-up">
        <div className="flex items-center space-x-4 mb-6">
          <Avatar className="w-20 h-20">
            <AvatarImage src={currentPatient?.avatar} alt={currentPatient?.name} />
            <AvatarFallback>
              {currentPatient?.name?.split(' ').map(n => n[0]).join('') || 'AN'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-playfair text-3xl font-bold text-primary mb-2">
              Welcome back, {currentPatient?.name}
            </h1>
            <div className="flex items-center space-x-3">
              <Badge className={`${getDoshaBadge(currentPatient?.dosha || '')} px-3 py-1`}>
                {currentPatient?.dosha} Constitution
              </Badge>
              <div className="text-sm text-muted-foreground">
                Patient ID: {currentPatient?.uid?.substring(0, 8)}...
              </div>
            </div>
          </div>
        </div>

        {/* Patient Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-primary/5 rounded-lg">
            <div className="text-2xl font-bold text-primary">{patientSessions.length}</div>
            <div className="text-sm text-muted-foreground">Total Sessions</div>
          </div>
          <div className="text-center p-3 bg-accent/5 rounded-lg">
            <div className="text-2xl font-bold text-accent">
              {completedSessions.length}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
            <div className="text-center p-3 bg-ayur-soft-gold/10 rounded-lg">
              <div className="text-2xl font-bold text-ayur-soft-gold">
                {currentPatient?.llm_recommendation
                  ? Math.min(Math.round((completedSessions.length / (currentPatient.llm_recommendation.sessions_recommended || 1)) * 100), 100)
                  : (patientSessions.length > 0 ? Math.round((completedSessions.length / patientSessions.length) * 100) : 0)}%
              </div>
              <div className="text-sm text-muted-foreground">Recovery Progress</div>
            </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {currentPatient?.llm_recommendation?.priority_score || 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">Current Priority</div>
          </div>
        </div>
      </div>

      {!currentPatient?.quizCompleted && <DoshaQuiz />}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Sessions */}
        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-primary" />
            Upcoming Sessions
          </h3>
          <div className="space-y-3">
            {upcomingSessions.length > 0 ? (
              upcomingSessions.map((session) => (
                <div 
                  key={session.id} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSessionClick(session)}
                >
                  <div>
                    <div className="font-medium text-foreground">{session.therapy}</div>
                    <div className="text-sm text-muted-foreground flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatDateTime(session.datetime)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Session {session.session_number} • {session.duration_minutes} minutes
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <Badge variant="outline" className="text-xs">
                      Scheduled
                    </Badge>
                    {session.doctor_approval && (
                      <Badge 
                        variant={session.doctor_approval === 'approved' ? 'default' : session.doctor_approval === 'rejected' ? 'destructive' : 'secondary'} 
                        className="text-[10px]"
                      >
                        {session.doctor_approval === 'approved' ? '✅ Doctor Approved' : session.doctor_approval === 'rejected' ? '❌ Needs Revision' : '✏️ Doctor Modified'}
                      </Badge>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Click to view details
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming sessions scheduled</p>
                <Button className="mt-3" variant="outline" size="sm" onClick={handleScheduleSession}>
                  Schedule New Session
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Current Symptoms */}
        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-primary" />
            Current Symptoms
          </h3>
          <div className="space-y-3">
            {currentPatient?.symptoms && currentPatient.symptoms.length > 0 ? (
              currentPatient.symptoms.map((symptom, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-foreground font-medium">{symptom.name}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-muted rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all"
                        style={{ width: `${(symptom.score / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8">{symptom.score}/10</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground py-4">No symptoms reported yet. Complete the Dosha Quiz to update your health profile.</div>
            )}
            <div className="mt-4 p-3 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
              <div className="text-sm font-medium text-primary mb-1">Overall Progress</div>
              <div className="text-xs text-muted-foreground">
                Your symptoms have improved significantly since starting treatment.
              </div>
            </div>
          </div>
        </Card>

        {/* Treatment Plan */}
        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-primary" />
            Current Treatment Plan
          </h3>
          {currentPatient?.llm_recommendation ? (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-lg text-primary">
                      {currentPatient.llm_recommendation.therapy}
                    </h4>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                      <span>{currentPatient.llm_recommendation.sessions_recommended} sessions</span>
                      <span>Every {currentPatient.llm_recommendation.spacing_days} days</span>
                    </div>
                  </div>
                  <Badge className="priority-badge-high">
                    Priority: {currentPatient.llm_recommendation.priority_score}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {currentPatient.llm_recommendation.explanation}
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold text-primary">
                    {currentPatient.llm_recommendation.sessions_recommended}
                  </div>
                  <div className="text-xs text-muted-foreground">Recommended Sessions</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-accent">
                    {completedSessions.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-ayur-soft-gold">
                    {Math.round((completedSessions.length / currentPatient.llm_recommendation.sessions_recommended) * 100)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Progress</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-4">
              Your personalized Ayurvedic treatment plan will appear here after your first consultation or assessment.
            </div>
          )}
        </Card>

        {/* Recent Activity / Session History */}
        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-primary" />
            Session History
          </h3>
          <div className="space-y-3">
            {completedSessions.length > 0 ? (
              completedSessions.slice(-3).reverse().map((session) => (
                <div 
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSessionClick(session)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Heart className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{session.therapy}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(session.datetime)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs mb-1">
                      Completed
                    </Badge>
                    {session.feedback && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Star className="w-3 h-3 mr-1" />
                        Feedback given
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No completed sessions yet</p>
                <p className="text-xs mt-1">Your session history will appear here</p>
              </div>
            )}
            
            {completedSessions.length > 0 && (
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => navigate('/patient/sessions')}>
                View All Sessions
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions & Ayurvedic Features */}
      <h3 className="font-playfair text-xl font-semibold mt-8 mb-4">Ayurvedic Ecosystem</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button className="h-24 justify-start p-4 hover:scale-105 transition-transform border-primary/20 hover:border-primary/50" variant="outline" onClick={() => navigate('/ayurvedic-mart')}>
          <div className="flex flex-col items-start gap-2">
            <span className="text-2xl drop-shadow-sm">🛒</span>
            <div className="text-left w-full">
              <div className="font-semibold text-primary text-sm">Ayurvedic Mart</div>
              <div className="text-xs text-muted-foreground truncate">Authentic herbs</div>
            </div>
          </div>
        </Button>
        
        <Button className="h-24 justify-start p-4 hover:scale-105 transition-transform border-primary/20 hover:border-primary/50" variant="outline" onClick={() => navigate('/report-analyzer')}>
          <div className="flex flex-col items-start gap-2">
            <span className="text-2xl drop-shadow-sm">📄</span>
            <div className="text-left w-full">
              <div className="font-semibold text-primary text-sm">Report Analyzer</div>
              <div className="text-xs text-muted-foreground truncate">AI Insights</div>
            </div>
          </div>
        </Button>
        
        <Button className="h-24 justify-start p-4 hover:scale-105 transition-transform border-primary/20 hover:border-primary/50" variant="outline" onClick={() => navigate('/diet-plan')}>
          <div className="flex flex-col items-start gap-2">
            <span className="text-2xl drop-shadow-sm">🥗</span>
            <div className="text-left w-full">
              <div className="font-semibold text-primary text-sm">Diet Planner</div>
              <div className="text-xs text-muted-foreground truncate">Dosha nutrition</div>
            </div>
          </div>
        </Button>

        <Button className="h-24 justify-start p-4 hover:scale-105 transition-transform border-primary/20 hover:border-primary/50" variant="outline" onClick={() => navigate('/remedies')}>
          <div className="flex flex-col items-start gap-2">
            <span className="text-2xl drop-shadow-sm">🌿</span>
            <div className="text-left w-full">
              <div className="font-semibold text-primary text-sm">Herbal Remedies</div>
              <div className="text-xs text-muted-foreground truncate">Natural healing</div>
            </div>
          </div>
        </Button>
      </div>

      {/* Session Modal */}
      <SessionModal
        session={selectedSession}
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
      />

      {/* Message Modal */}
      <MessageModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        recipient={{
          id: 'dr1',
          name: 'Dr. Sargun Mehta',
          avatar: '/placeholder.svg',
          role: 'doctor'
        }}
      />
    </div>
  );
};

export default PatientDashboard;