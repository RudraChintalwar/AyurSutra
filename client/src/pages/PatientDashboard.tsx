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
import SchedulingWizard from '@/components/SchedulingWizard';
import { 
  Calendar,
  Clock,
  Activity,
  TrendingUp,
  Heart,
  MessageSquare,
  FileText,
  Star,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const PatientDashboard = () => {
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [isSessionDetailsModalOpen, setIsSessionDetailsModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showSchedulingWizard, setShowSchedulingWizard] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const [patientSessions, setPatientSessions] = useState<any[]>([]);
  const { user, firebaseUser } = useAuth();
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

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

  // Refetch sessions (called after wizard completes)
  const refreshSessions = async () => {
    if (!user?.uid) return;
    try {
      const q = query(collection(db, 'sessions'), where('patient_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const sessionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      sessionsData.sort((a: any, b: any) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
      setPatientSessions(sessionsData);
    } catch (error) {
      console.error("Error refreshing sessions:", error);
    }
  };

  useEffect(() => {
    const fetchCalendarEvents = async () => {
      if (!firebaseUser || !user?.calendarSyncConnected) {
        setCalendarEvents([]);
        return;
      }
      setCalendarLoading(true);
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const idToken = await firebaseUser.getIdToken();
        const res = await fetch(`${API_URL}/api/calendar/list-events/me`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        if (data.success) setCalendarEvents(data.events || []);
      } catch (err) {
        console.error('Failed to fetch calendar events:', err);
      } finally {
        setCalendarLoading(false);
      }
    };
    fetchCalendarEvents();
  }, [firebaseUser, user?.calendarSyncConnected, user?.uid]);

  const handleSessionClick = (session: any) => {
    setSelectedSession(session);
    setShowSessionModal(true);
  };

  const handleScheduleSession = () => {
    toast({
      title: t("patient.schedulingSession"),
      description: t("patient.redirectBooking"),
    });
    navigate('/patient/sessions');
  };

  const handleMessageDoctor = () => {
    setShowMessageModal(true);
  };

  const handleViewProgress = () => {
    toast({
      title: t("patient.viewingProgress"),
      description: t("patient.loadingProgress"),
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
    return new Date(dateTime).toLocaleString(language === "hi" ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  const upcomingSessions = patientSessions.filter(s =>
    ['scheduled', 'confirmed', 'pending_review', 'reschedule_requested', 'bumped'].includes(s.status)
  );
  const completedSessions = patientSessions.filter(s => s.status === 'completed');
  const cancelledSessions = patientSessions.filter(s => s.status === 'cancelled' || s.status === 'rejected');
  const activePrioritySessions = patientSessions.filter((s) =>
    ['scheduled', 'confirmed', 'pending_review', 'reschedule_requested', 'bumped'].includes(String(s.status))
  );
  const latestPrioritySession = activePrioritySessions[0] || patientSessions[0];
  const currentPriorityScore =
    Number(latestPrioritySession?.totalPriorityScore ?? latestPrioritySession?.priority) ||
    Number(currentPatient?.llm_recommendation?.priority_score) ||
    null;
  const recommendedSessions = currentPatient?.llm_recommendation?.sessions_recommended || patientSessions.length || 1;
  const recoveryRate = Math.min(
    Math.round((completedSessions.length / recommendedSessions) * 100),
    100
  );

  const bpmHistory = useMemo(() => {
    const raw = Array.isArray((currentPatient as any)?.bpm_history) ? (currentPatient as any).bpm_history : [];
    return raw
      .filter((x: any) => Number.isFinite(Number(x?.bpm)))
      .map((x: any) => ({
        bpm: Number(x.bpm),
        measuredAt: x.measured_at ? new Date(x.measured_at) : null,
      }))
      .slice(-12);
  }, [currentPatient]);

  const bpmStats = useMemo(() => {
    if (bpmHistory.length === 0) return null;
    const values = bpmHistory.map((x: any) => x.bpm);
    const latest = values[values.length - 1];
    const avg = Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { latest, avg, min, max };
  }, [bpmHistory]);

  const bpmSparklinePoints = useMemo(() => {
    if (bpmHistory.length < 2) return "";
    const w = 320;
    const h = 80;
    const vals = bpmHistory.map((x: any) => x.bpm);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const range = Math.max(maxV - minV, 1);
    return vals
      .map((v: number, i: number) => {
        const x = (i / Math.max(vals.length - 1, 1)) * w;
        const y = h - ((v - minV) / range) * h;
        return `${x},${y}`;
      })
      .join(" ");
  }, [bpmHistory]);

  const primaryDoctorSession = activePrioritySessions.find((s) => s.practitioner_id) || patientSessions.find((s) => s.practitioner_id);

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
              {t("patient.welcomeBack", { name: currentPatient?.name || "" })}
            </h1>
            <div className="flex items-center space-x-3">
              <Badge className={`${getDoshaBadge(currentPatient?.dosha || '')} px-3 py-1`}>
                {t("patient.constitution", { dosha: currentPatient?.dosha || "" })}
              </Badge>
              <div className="text-sm text-muted-foreground">
                {t("patient.patientId", { id: `${currentPatient?.uid?.substring(0, 8)}...` })}
              </div>
            </div>
          </div>
        </div>

        {/* Patient Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-primary/5 rounded-lg">
            <div className="text-2xl font-bold text-primary">{patientSessions.length}</div>
            <div className="text-sm text-muted-foreground">{t("patient.totalSessions")}</div>
          </div>
          <div className="text-center p-3 bg-accent/5 rounded-lg">
            <div className="text-2xl font-bold text-accent">
              {completedSessions.length}
            </div>
            <div className="text-sm text-muted-foreground">{t("patient.completed")}</div>
          </div>
            <div className="text-center p-3 bg-ayur-soft-gold/10 rounded-lg">
              <div className="text-2xl font-bold text-ayur-soft-gold">
                {recoveryRate}%
              </div>
              <div className="text-sm text-muted-foreground">{t("patient.recoveryProgress")}</div>
            </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {currentPriorityScore ?? 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">{t("patient.currentPriority")}</div>
          </div>
        </div>
      </div>

      {!currentPatient?.quizCompleted && <DoshaQuiz />}

      <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.04s' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-playfair text-xl font-semibold flex items-center">
            <Heart className="w-5 h-5 mr-2 text-primary" />
            {t("patient.heartRateTrend")}
          </h3>
          <Button variant="outline" size="sm" onClick={() => navigate('/pulse-monitor')}>
            {t("patient.openBpmChecker")}
          </Button>
        </div>

        {!bpmStats ? (
          <div className="text-sm text-muted-foreground">
            {t("patient.noBpmHistory")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="text-center p-3 bg-primary/5 rounded-lg">
                <div className="text-xl font-bold text-primary">{bpmStats.latest}</div>
                <div className="text-xs text-muted-foreground">{t("patient.latestBpm")}</div>
              </div>
              <div className="text-center p-3 bg-accent/5 rounded-lg">
                <div className="text-xl font-bold text-accent">{bpmStats.avg}</div>
                <div className="text-xs text-muted-foreground">{t("patient.average")}</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">{bpmStats.min}</div>
                <div className="text-xs text-muted-foreground">{t("patient.min")}</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-xl font-bold text-amber-600">{bpmStats.max}</div>
                <div className="text-xs text-muted-foreground">{t("patient.max")}</div>
              </div>
            </div>

            {bpmHistory.length > 1 ? (
              <div className="rounded-lg border bg-muted/20 p-3">
                <svg viewBox="0 0 320 80" className="w-full h-20">
                  <polyline
                    points={bpmSparklinePoints}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("patient.lastMeasurements", { count: bpmHistory.length })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </Card>

      {/* ─── Book New Session CTA ───────────── */}
      <Card 
        className="ayur-card p-6 animate-slide-up cursor-pointer group hover:shadow-lg transition-all border-primary/20 hover:border-primary/40 bg-gradient-to-r from-primary/5 via-white to-accent/5"
        onClick={() => setShowSchedulingWizard(true)}
        style={{ animationDelay: '0.05s' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-playfair text-xl font-semibold text-primary">{t("patient.bookNewSession")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("patient.bookNewSessionDesc")}
              </p>
            </div>
          </div>
          <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary group-hover:text-white transition-all">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Sessions */}
        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-primary" />
            {t("patient.upcomingSessions")}
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
                      {t("patient.sessionNumDuration", { num: session.session_number, minutes: session.duration_minutes })}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <Badge className={`text-xs ${
                      session.status === 'confirmed' ? 'bg-green-100 text-green-700 border-green-200' :
                      session.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                      session.status === 'bumped' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                      session.status === 'reschedule_requested' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                      'bg-blue-100 text-blue-700 border-blue-200'
                    }`}>
                      {session.status === 'confirmed' ? '✅ Confirmed' :
                       session.status === 'pending_review' ? '🟡 Pending Review' :
                       session.status === 'bumped' ? '⚡ Rescheduled' :
                       session.status === 'reschedule_requested' ? '⚠️ Reschedule Req' :
                       '📅 Scheduled'}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t("patient.clickDetails")}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("patient.noUpcoming")}</p>
                <Button className="mt-3" variant="outline" size="sm" onClick={handleScheduleSession}>
                  {t("patient.scheduleNewSession")}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Google Calendar Events */}
        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {t("patient.googleCalendar")}
          </h3>

          {calendarLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : calendarEvents.length > 0 ? (
            <div className="space-y-3">
              {calendarEvents.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-100"
                >
                  <div>
                    <div className="font-medium text-sm text-foreground">{event.summary}</div>
                    <div className="text-xs text-muted-foreground flex items-center mt-1">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(event.start).toLocaleString(language === "hi" ? 'hi-IN' : 'en-IN', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                        timeZone: 'Asia/Kolkata'
                      })}
                    </div>
                  </div>
                  {event.htmlLink && (
                    <a
                      href={event.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t("patientDashboard.noUpcomingTherapy")}</p>
              <p className="text-xs mt-1">{t("patientDashboard.syncCalendarHint")}</p>
            </div>
          )}
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
              <div className="text-sm text-muted-foreground py-4">{t("patientDashboard.noSymptomsYet")}</div>
            )}
            <div className="mt-4 p-3 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
              <div className="text-sm font-medium text-primary mb-1">{t("patientDashboard.overallProgress")}</div>
              <div className="text-xs text-muted-foreground">
                {completedSessions.length > 0
                  ? `${completedSessions.length} session${completedSessions.length > 1 ? 's' : ''} completed. ${upcomingSessions.length > 0 ? `${upcomingSessions.length} upcoming.` : 'Schedule your next session to continue your treatment plan.'}`
                  : 'Complete your first session to start tracking progress.'}
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
                    Priority: {currentPriorityScore ?? 'N/A'}
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
                  <div className="text-xs text-muted-foreground">{t("patientDashboard.recommendedSessions")}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-accent">
                    {completedSessions.length}
                  </div>
                  <div className="text-xs text-muted-foreground">{t("patient.completed")}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-ayur-soft-gold">
                    {recoveryRate}%
                  </div>
                  <div className="text-xs text-muted-foreground">{t("patientDashboard.progress")}</div>
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
                <p>{t("patientDashboard.noCompletedSessions")}</p>
                <p className="text-xs mt-1">{t("patientDashboard.historyWillAppear")}</p>
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
      <h3 className="font-playfair text-xl font-semibold mt-8 mb-4">{t("patientDashboard.ecosystem")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Button className="h-24 justify-start p-4 hover:scale-105 transition-transform border-primary/20 hover:border-primary/50" variant="outline" onClick={() => navigate('/ayurvedic-mart')}>
          <div className="flex flex-col items-start gap-2">
            <span className="text-2xl drop-shadow-sm">🛒</span>
            <div className="text-left w-full">
              <div className="font-semibold text-primary text-sm">{t("patientDashboard.ayurvedicMart")}</div>
              <div className="text-xs text-muted-foreground truncate">{t("patientDashboard.authenticHerbs")}</div>
            </div>
          </div>
        </Button>
        
        <Button className="h-24 justify-start p-4 hover:scale-105 transition-transform border-primary/20 hover:border-primary/50" variant="outline" onClick={() => navigate('/report-analyzer')}>
          <div className="flex flex-col items-start gap-2">
            <span className="text-2xl drop-shadow-sm">📄</span>
            <div className="text-left w-full">
              <div className="font-semibold text-primary text-sm">{t("patientDashboard.reportAnalyzer")}</div>
              <div className="text-xs text-muted-foreground truncate">{t("patientDashboard.aiInsights")}</div>
            </div>
          </div>
        </Button>
        
        <Button className="h-24 justify-start p-4 hover:scale-105 transition-transform border-primary/20 hover:border-primary/50" variant="outline" onClick={() => navigate('/diet-plan')}>
          <div className="flex flex-col items-start gap-2">
            <span className="text-2xl drop-shadow-sm">🥗</span>
            <div className="text-left w-full">
              <div className="font-semibold text-primary text-sm">{t("patientDashboard.dietPlanner")}</div>
              <div className="text-xs text-muted-foreground truncate">{t("patientDashboard.doshaNutrition")}</div>
            </div>
          </div>
        </Button>

        <Button className="h-24 justify-start p-4 hover:scale-105 transition-transform border-primary/20 hover:border-primary/50" variant="outline" onClick={() => navigate('/pulse-monitor')}>
          <div className="flex flex-col items-start gap-2">
            <span className="text-2xl drop-shadow-sm">🫀</span>
            <div className="text-left w-full">
              <div className="font-semibold text-primary text-sm">{t("patientDashboard.bpmChecker")}</div>
              <div className="text-xs text-muted-foreground truncate">{t("patientDashboard.heartRateMonitor")}</div>
            </div>
          </div>
        </Button>

        <Button className="h-24 justify-start p-4 hover:scale-105 transition-transform border-primary/20 hover:border-primary/50" variant="outline" onClick={() => navigate('/remedies')}>
          <div className="flex flex-col items-start gap-2">
            <span className="text-2xl drop-shadow-sm">🌿</span>
            <div className="text-left w-full">
              <div className="font-semibold text-primary text-sm">{t("patientDashboard.herbalRemedies")}</div>
              <div className="text-xs text-muted-foreground truncate">{t("patientDashboard.naturalHealing")}</div>
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
          id: primaryDoctorSession?.practitioner_id || '',
          name: primaryDoctorSession?.doctor_name || 'Doctor',
          avatar: '/placeholder.svg',
          role: 'doctor'
        }}
      />

      {/* Scheduling Wizard */}
      <SchedulingWizard
        isOpen={showSchedulingWizard}
        onClose={() => setShowSchedulingWizard(false)}
        onComplete={(data) => {
          setShowSchedulingWizard(false);
          refreshSessions();
        }}
      />
    </div>
  );
};

export default PatientDashboard;