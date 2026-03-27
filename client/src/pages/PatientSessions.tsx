import React, { useState } from 'react';
import SessionDetailsModal from '@/components/SessionDetailsModal';
import SessionSchedulingModal from '@/components/SessionSchedulingModal';
import SchedulingWizard from '@/components/SchedulingWizard';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SessionModal from '@/components/SessionModal';
import FilterModal from '@/components/FilterModal';
import { 
  Calendar,
  Clock,
  CheckCircle,
  Play,
  Plus,
  Star,
  Activity,
  TrendingUp,
  Heart,
  AlertCircle,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const getStatusBadge = (status: string, t: (key: string) => string) => {
  switch (status) {
    case 'pending_review': return { label: `🟡 ${t("sessions.pendingReview")}`, className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    case 'confirmed': return { label: `✅ ${t("sessions.confirmed")}`, className: 'bg-green-100 text-green-700 border-green-200' };
    case 'scheduled': return { label: `📅 ${t("sessions.statusScheduled")}`, className: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'completed': return { label: `✅ ${t("sessions.statusCompleted")}`, className: 'bg-green-100 text-green-700 border-green-200' };
    case 'rejected': return { label: `❌ ${t("sessions.rejected")}`, className: 'bg-red-100 text-red-700 border-red-200' };
    case 'bumped': return { label: `⚡ ${t("sessions.rescheduled")}`, className: 'bg-purple-100 text-purple-700 border-purple-200' };
    case 'reschedule_requested': return { label: `⚠️ ${t("sessions.rescheduleReq")}`, className: 'bg-orange-100 text-orange-700 border-orange-200' };
    case 'cancelled': return { label: `❌ ${t("common.cancelled")}`, className: 'bg-red-100 text-red-700 border-red-200' };
    default: return { label: status || t("common.unknown"), className: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
};

const PatientSessions = () => {
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [showAIWizard, setShowAIWizard] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t, language } = useLanguage();

  React.useEffect(() => {
    const fetchSessions = async () => {
      if (!user?.uid) return;
      try {
        const q = query(collection(db, 'sessions'), where('patient_id', '==', user.uid));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a: any, b: any) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
        setSessions(data);
      } catch (err) {
        console.error("Error fetching sessions:", err);
      }
    };
    fetchSessions();
  }, [user]);

  const currentPatient = user as any;

  // Handler for AI-driven scheduling wizard completion
  // BUG 13 FIX: The wizard already writes all session documents to Firestore
  // with correct field names. The old code here created another set of sessions
  // with a hardcoded practitioner_id: 'dr1', meaning every booking from this
  // page produced duplicate sessions — one correct set from the wizard, one
  // broken set from here. Now we just refresh the session list.
  const handleAISchedulingComplete = async (sessionData: any) => {
    try {
      toast({
        title: language === "hi" ? "सत्र समीक्षा हेतु भेजे गए 📋" : "Sessions Submitted for Review 📋",
        description: `${sessionData?.scheduledSlots?.length || 0} ${sessionData?.recommendation?.therapy || t("sessions.therapy")} ${t("sessions.pendingDoctorApproval")}`
      });
      // Refresh sessions from Firestore
      const q = query(collection(db, 'sessions'), where('patient_id', '==', user?.uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
      setSessions(data);
    } catch (err) {
      console.error('Error refreshing sessions:', err);
      toast({ title: language === "hi" ? "त्रुटि" : "Error", description: language === "hi" ? "सत्र रिफ्रेश नहीं हो सके।" : "Failed to refresh sessions.", variant: "destructive" });
    }
  };

  const pendingReviewSessions = sessions.filter(s => s.status === 'pending_review');
  const upcomingSessions = sessions.filter(s => 
    ['scheduled', 'confirmed', 'pending_review', 'bumped', 'reschedule_requested'].includes(s.status)
  );
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const cancelledSessions = sessions.filter(s => s.status === 'cancelled' || s.status === 'rejected');
  const allSessions = sessions;

  const handleSessionClick = (session: any) => {
    setSelectedSession(session);
    setShowSessionModal(true);
  };

  const formatDateTime = (dateTime: string) => {
    if (!dateTime) return 'TBD';
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return t("common.invalidDate");
    return date.toLocaleString(language === "hi" ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  const getSessionProgress = () => {
    if (!currentPatient || !currentPatient.llm_recommendation?.sessions_recommended) return 0;
    return Math.round((completedSessions.length / currentPatient.llm_recommendation.sessions_recommended) * 100);
  };

  const handleBookSession = () => {
    setIsSchedulingOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-primary">
            {t("sessions.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("sessions.subtitle")}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setShowAIWizard(true)}>
            <Activity className="w-4 h-4 mr-2" />
            {t("sessions.aiSchedule")}
          </Button>
        </div>
      </div>

      {/* Treatment Progress Overview */}
      <Card className="ayur-card p-6 animate-slide-up">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-3 relative">
              <div className="w-20 h-20 rounded-full border-4 border-primary/20 flex items-center justify-center">
                <div className="text-2xl font-bold text-primary">{getSessionProgress()}%</div>
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-r-transparent animate-spin-slow"></div>
            </div>
            <div className="font-medium">{t("sessions.progress")}</div>
            <div className="text-sm text-muted-foreground">{t("sessions.overallRecovery")}</div>
          </div>

          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-3 bg-primary/10 rounded-full flex items-center justify-center">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <div className="text-2xl font-bold text-primary">{sessions.length}</div>
            <div className="font-medium">{t("sessions.totalSessions")}</div>
            <div className="text-sm text-muted-foreground">{t("sessions.scheduledCompleted")}</div>
          </div>

          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-600">{completedSessions.length}</div>
            <div className="font-medium">{t("sessions.statusCompleted")}</div>
            <div className="text-sm text-muted-foreground">{t("sessions.successfullyFinished")}</div>
          </div>

          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-3 bg-accent/10 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-accent" />
            </div>
            <div className="text-2xl font-bold text-accent">{upcomingSessions.length}</div>
            <div className="font-medium">{t("sessions.upcoming")}</div>
            <div className="text-sm text-muted-foreground">{t("sessions.nextAppointments")}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{t("sessions.planProgress")}</span>
            <span className="text-sm text-muted-foreground">
              {completedSessions.length} of {currentPatient?.llm_recommendation?.sessions_recommended || 0} sessions
            </span>
          </div>
          <Progress value={getSessionProgress()} className="h-3" />
        </div>
      </Card>

      {/* Sessions List */}
      <Card className="ayur-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-playfair text-xl font-semibold">{t("sessions.history")}</h3>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilterModal(true)}>
              <Filter className="w-4 h-4 mr-2" />
              {t("sessions.filter")}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">{t("sessions.upcoming")}</TabsTrigger>
            <TabsTrigger value="completed">{t("patient.completed")}</TabsTrigger>
            <TabsTrigger value="all">{t("sessions.allSessions")}</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingSessions.length > 0 ? (
              upcomingSessions.map((session, index) => (
                <div 
                  key={session.id}
                  className="p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => handleSessionClick(session)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Play className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">{session.therapy}</h4>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDateTime(session.datetime)}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {session.duration_minutes} minutes
                          </div>
                        </div>
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">
                            Session {session.session_number}
                          </Badge>
                          {session.status === 'bumped' && (
                            <Badge className="bg-red-100 text-red-700 border-red-200 ml-2 text-xs font-semibold animate-pulse">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {t("sessions.emergencyRescheduledByDoctor")}
                            </Badge>
                          )}
                          {session.status === 'confirmed' && (
                            <Badge className="bg-green-100 text-green-700 border-green-200 ml-2 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {t("sessions.confirmedByPractitioner")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 mb-2">
                        {t("sessions.statusScheduled")}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        {t("sessions.clickForDetails")}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">{t("sessions.noUpcoming")}</h3>
                <p className="text-sm mb-4">{t("sessions.scheduleNext")}</p>
                <Button className="ayur-button-hero" onClick={handleBookSession}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("sessions.bookSession")}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedSessions.length > 0 ? (
              completedSessions.reverse().map((session, index) => (
                <div 
                  key={session.id}
                  className="p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => handleSessionClick(session)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">{session.therapy}</h4>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDateTime(session.datetime)}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {session.duration_minutes} minutes
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            Session {session.session_number}
                          </Badge>
                          {session.feedback && (
                            <Badge className="bg-accent/10 text-accent text-xs">
                              <Star className="w-3 h-3 mr-1" />
                              Feedback Given
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-green-100 text-green-700 border-green-200 mb-2">
                        {t("sessions.statusCompleted")}
                      </Badge>
                      {session.feedback && (
                        <div className="text-sm text-muted-foreground">
                          Rated session
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">{t("sessions.noCompleted")}</h3>
                <p className="text-sm">{language === "hi" ? "आपके पूर्ण उपचार यहां दिखेंगे" : "Your completed treatments will appear here"}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {allSessions.map((session, index) => {
              const isCompleted = session.status === 'completed';
              return (
                <div 
                  key={session.id}
                  className="p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => handleSessionClick(session)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-lg ${
                        isCompleted ? 'bg-green-100' : 'bg-primary/10'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <Clock className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">{session.therapy}</h4>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDateTime(session.datetime)}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {session.duration_minutes} minutes
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            Session {session.session_number}
                          </Badge>
                          {session.feedback && (
                            <Badge className="bg-accent/10 text-accent text-xs">
                              <Star className="w-3 h-3 mr-1" />
                              Feedback
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={`${getStatusBadge(session.status, t).className} border`}>
                        {getStatusBadge(session.status, t).label}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Treatment Recommendations */}
      {currentPatient && (
        <Card className="ayur-card p-6 animate-slide-up">
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-primary" />
            Current Treatment Plan
          </h3>
          
          <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-lg text-primary">
                  {currentPatient?.llm_recommendation?.therapy || t("sessions.pendingAssessment")}
                </h4>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                  <span>Recommended: {currentPatient?.llm_recommendation?.sessions_recommended || 0} sessions</span>
                  <span>Every {currentPatient?.llm_recommendation?.spacing_days || 0} days</span>
                </div>
              </div>
              <Badge className="priority-badge-high">
                Priority: {currentPatient?.llm_recommendation?.priority_score || 'N/A'}
              </Badge>
            </div>
            
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              {currentPatient?.llm_recommendation?.explanation || "No treatment plan has been generated yet. Please take the Dosha Quiz."}
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <div className="text-xl font-bold text-primary">
                  {currentPatient?.llm_recommendation?.sessions_recommended || 0}
                </div>
                <div className="text-xs text-muted-foreground">Recommended</div>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <div className="text-xl font-bold text-green-600">
                  {completedSessions.length}
                </div>
                <div className="text-xs text-muted-foreground">{t("sessions.statusCompleted")}</div>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <div className="text-xl font-bold text-accent">
                  {upcomingSessions.length}
                </div>
                <div className="text-xs text-muted-foreground">Remaining</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Session Modal */}
      <SessionModal
        session={selectedSession}
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
      />
      <SessionSchedulingModal
        isOpen={isSchedulingOpen}
        onClose={() => setIsSchedulingOpen(false)}
      />
      <SchedulingWizard
        isOpen={showAIWizard}
        onClose={() => setShowAIWizard(false)}
        onComplete={handleAISchedulingComplete}
      />
      
      {/* Filter Modal */}
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        type="sessions"
      />
    </div>
  );
};

export default PatientSessions;