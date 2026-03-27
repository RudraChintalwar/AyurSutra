import React, { useState, useEffect } from 'react';
import SessionDetailsModal from '@/components/SessionDetailsModal';
import FullScheduleModal from '@/components/FullScheduleModal';
import FilterModal from '@/components/FilterModal';
import SchedulingWizard from '@/components/SchedulingWizard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { 
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  AlertTriangle,
  CheckCircle,
  Filter,
  Loader2
} from 'lucide-react';
import { useDoctorData, Session } from '@/hooks/useDoctorData';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const DoctorCalendar = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [isSessionDetailsModalOpen, setIsSessionDetailsModalOpen] = useState(false);
  const [isFullScheduleModalOpen, setIsFullScheduleModalOpen] = useState(false);
  const [isSchedulingWizardOpen, setIsSchedulingWizardOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  
  const { patients, sessions, loading } = useDoctorData();
  const { language, t } = useLanguage();
  const { firebaseUser, user } = useAuth();
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

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

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString(language === "hi" ? 'hi-IN' : 'en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  const formatDate = (dateTime: string) => {
    return new Date(dateTime).toLocaleDateString(language === "hi" ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata'
    });
  };

  const getSessionsForDate = (date: Date) => {
    return sessions.filter(session => {
      const sessionDate = new Date(session.datetime);
      return sessionDate.toDateString() === date.toDateString();
    });
  };

  const todaysSessions = getSessionsForDate(selectedDate);
  const upcomingSessions = sessions
    .filter(s => new Date(s.datetime) > new Date())
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    .slice(0, 5);

  const ACTIVE_SESSION_STATUSES = ['pending_review', 'confirmed', 'scheduled', 'reschedule_requested'];
  const CONFLICT_STATUSES = ['reschedule_required', 'reschedule_requested'];

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'confirmed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'scheduled':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'reschedule_requested':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'reschedule_required':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-primary">
            {t("doctor.calendarTitle")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("doctor.calendarDesc")}
          </p>
        </div>
        <Button 
          className="ayur-button-accent"
          onClick={() => setIsSchedulingWizardOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("doctor.scheduleSession")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="ayur-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CalendarIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{todaysSessions.length}</div>
              <div className="text-sm text-muted-foreground">{t("doctor.todaySessions")}</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Clock className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">
                {sessions.filter(s => ACTIVE_SESSION_STATUSES.includes(s.status)).length}
              </div>
              <div className="text-sm text-muted-foreground">{t("doctor.activeNeedsAction")}</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {sessions.filter(s => s.status === 'completed').length}
              </div>
              <div className="text-sm text-muted-foreground">{t("patient.completed")}</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {sessions.filter(s => CONFLICT_STATUSES.includes(s.status)).length}
              </div>
              <div className="text-sm text-muted-foreground">{t("doctor.rescheduleItems")}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-1">
          <Card className="ayur-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-playfair text-xl font-semibold">{t("common.calendar")}</h3>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsFilterModalOpen(true)}
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-center overflow-x-auto pb-2 w-full">
              <div className="min-w-[300px] bg-card rounded-lg border shadow-sm p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="w-full flex justify-center"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-sm font-medium text-muted-foreground">{t("common.legend")}</div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-3 h-3 bg-primary rounded-full"></div>
                <span>{language === "hi" ? "लंबित/पुष्ट/निर्धारित" : "Pending/Confirmed/Scheduled"}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                <span>{t("patient.completed")}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                <span>{language === "hi" ? "रीशेड्यूल आवश्यक" : "Reschedule Required"}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>{language === "hi" ? "रीशेड्यूल अनुरोध" : "Reschedule Requested"}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Today's Schedule */}
        <div className="lg:col-span-1">
          <Card className="ayur-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-playfair text-xl font-semibold">
                {selectedDate.toDateString() === new Date().toDateString() 
                  ? t("common.todaySchedule")
                  : `Schedule for ${formatDate(selectedDate.toISOString())}`}
              </h3>
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {todaysSessions.length > 0 ? (
                todaysSessions.map((session, index) => {
                  const patient = patients.find(p => p.id === session.patient_id);
                  const priority = patient?.llm_recommendation?.priority_score || 0;
                  
                  return (
                    <div
                      key={session.id}
                      className="p-3 bg-muted/30 rounded-lg animate-fade-in cursor-pointer hover:bg-muted/50 transition-colors"
                      style={{ animationDelay: `${index * 0.1}s` }}
                      onClick={() => {
                        setSelectedSession(session);
                        setIsSessionDetailsModalOpen(true);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={patient?.avatar} alt={patient?.name} />
                            <AvatarFallback>
                              {patient?.name?.split(' ').map(n => n[0]).join('') || ''}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{patient?.name}</div>
                            <div className="text-xs text-muted-foreground">{session.therapy}</div>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDateTime(session.datetime)} • {session.duration_minutes}min
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant="outline"
                            className={`text-xs mb-1 ${getStatusBadgeClasses(session.status)}`}
                          >
                            {session.status}
                          </Badge>
                          {priority >= 80 && (
                            <div className="text-xs text-red-600 flex items-center">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              High Priority
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("common.noSessionsScheduled")}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => setIsSchedulingWizardOpen(true)}
                  >
                    Schedule First Session
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Upcoming Sessions */}
        <div className="lg:col-span-1">
          <Card className="ayur-card p-6">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-primary" />
              Upcoming Sessions
            </h3>

            <div className="space-y-3">
              {upcomingSessions.map((session, index) => {
                const patient = patients.find(p => p.id === session.patient_id);
                const priority = patient?.llm_recommendation?.priority_score || 0;
                
                return (
                  <div
                    key={session.id}
                    className="p-3 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg animate-slide-up cursor-pointer hover:scale-[1.02] transition-transform"
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => {
                      setSelectedSession(session);
                      setIsSessionDetailsModalOpen(true);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={patient?.avatar} alt={patient?.name} />
                          <AvatarFallback>
                            {patient?.name?.split(' ').map(n => n[0]).join('') || ''}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{patient?.name}</div>
                          <div className="text-xs text-muted-foreground">{session.therapy}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium">{formatDate(session.datetime)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(session.datetime)}
                        </div>
                        {priority >= 80 && (
                          <Badge className="priority-badge-high text-xs mt-1">
                            High Priority
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-4"
              onClick={() => setIsFullScheduleModalOpen(true)}
            >
              View Full Schedule
            </Button>
          </Card>

          {/* Google Calendar Events */}
          <Card className="ayur-card p-6 mt-6 lg:col-span-3">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {t("doctorCalendar.eventsTitle")}
            </h3>

            {calendarLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : calendarEvents.length > 0 ? (
              <div className="space-y-3">
                {calendarEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-100 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{event.summary}</div>
                        <div className="text-xs text-muted-foreground flex items-center mt-1">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(event.start).toLocaleString('en-IN', {
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
                          className="text-xs text-blue-600 hover:underline shrink-0"
                        >
                          {t("doctorCalendar.viewInCalendar")} →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t("doctorCalendar.noUpcomingEvents")}</p>
                <p className="text-xs mt-1">{t("doctorCalendar.eventsAppearHint")}</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Time Slot View */}
      <Card className="ayur-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-playfair text-xl font-semibold">{t("doctorCalendar.dailyTimeline")}</h3>
          <div className="flex items-center space-x-2">
            <Button 
              variant={viewMode === 'week' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setViewMode('week')}
              className={viewMode === 'week' ? 'ayur-button-hero' : ''}
            >
              Week View
            </Button>
            <Button 
              variant={viewMode === 'day' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setViewMode('day')}
              className={viewMode === 'day' ? 'ayur-button-hero' : ''}
            >
              Day View
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 min-h-96">
          {/* Time slots */}
          <div className="col-span-1 space-y-4">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="text-sm text-muted-foreground text-right pr-2 h-16 flex items-start pt-2">
                {9 + i}:00
              </div>
            ))}
          </div>

          {/* Schedule blocks */}
          <div className="col-span-11 relative">
            <div className="absolute inset-0 grid grid-rows-10 gap-4">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="border-t border-muted/50 relative">
                  {/* Render sessions that fall in this time slot */}
                  {todaysSessions
                    .filter(session => {
                      const h = new Date(session.datetime);
                      const istHour = parseInt(
                        h.toLocaleString("en-GB", {
                          timeZone: "Asia/Kolkata",
                          hour: "numeric",
                          hour12: false,
                        }),
                        10
                      );
                      return istHour === 9 + i;
                    })
                    .map(session => {
                      const patient = patients.find(p => p.id === session.patient_id);
                      return (
                        <div
                          key={session.id}
                          className="absolute left-0 right-0 top-2 p-2 bg-primary/10 border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors"
                          onClick={() => {
                            setSelectedSession(session);
                            setIsSessionDetailsModalOpen(true);
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={patient?.avatar} alt={patient?.name} />
                              <AvatarFallback className="text-xs">
                                {patient?.name?.split(' ').map(n => n[0]).join('') || ''}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">{patient?.name}</div>
                              <div className="text-xs text-muted-foreground">{session.therapy}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
      </>)}

      {/* Modals */}
      <SessionDetailsModal
        isOpen={isSessionDetailsModalOpen}
        onClose={() => setIsSessionDetailsModalOpen(false)}
        session={selectedSession}
        patient={selectedSession ? patients.find(p => p.id === selectedSession.patient_id) : undefined}
      />
      
      <FullScheduleModal
        isOpen={isFullScheduleModalOpen}
        onClose={() => setIsFullScheduleModalOpen(false)}
      />
      <SchedulingWizard
        isOpen={isSchedulingWizardOpen}
        onClose={() => setIsSchedulingWizardOpen(false)}
        onComplete={() => setIsSchedulingWizardOpen(false)}
      />
      
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        type="sessions"
      />
    </div>
  );
};

export default DoctorCalendar;