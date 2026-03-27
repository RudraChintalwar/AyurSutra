import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Star,
  Activity,
  BarChart3,
  PieChart,
  Download,
  Filter,
  Loader2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { useDoctorData } from '@/hooks/useDoctorData';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const DoctorAnalytics = () => {
  const { patients, sessions, loading } = useDoctorData();
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const handleExportReport = () => {
    try {
      const headers = ['Patient', 'Therapy', 'Date', 'Status', 'Priority', 'Duration'];
      const rows = sessions.map((s: any) => [
        s.patient_name || 'Unknown',
        s.therapy || 'N/A',
        new Date(s.datetime).toLocaleDateString(),
        s.status,
        s.priority || s.totalPriorityScore || 'N/A',
        s.duration_minutes || 90,
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ayursutra_analytics_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: language === "hi" ? 'रिपोर्ट एक्सपोर्ट हुई ✅' : 'Report Exported ✅', description: language === "hi" ? 'CSV फ़ाइल सफलतापूर्वक डाउनलोड हुई।' : 'CSV file downloaded successfully.' });
    } catch (err) {
      toast({ title: language === "hi" ? 'एक्सपोर्ट असफल' : 'Export Failed', description: language === "hi" ? 'रिपोर्ट तैयार नहीं हो सकी।' : 'Could not generate report.', variant: 'destructive' });
    }
  };

  // Generate analytics data
  const totalPatients = patients.length;
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  const scheduledSessions = sessions.filter(s => s.status === 'scheduled').length;
  const activeStatuses = new Set(['pending_review', 'scheduled', 'confirmed', 'reschedule_requested', 'bumped']);
  const activeSessions = sessions.filter((s) => activeStatuses.has(String(s.status)));
  const activePatientsCount = new Set(activeSessions.map((s) => s.patient_id).filter(Boolean)).size;
  const averagePriority = totalSessions > 0
    ? Math.round(sessions.reduce((sum, s: any) => sum + (Number(s.totalPriorityScore ?? s.priority) || 0), 0) / totalSessions)
    : 0;

  const recoveryRate = totalSessions > 0
    ? Math.round((completedSessions / totalSessions) * 100)
    : 0;

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const monthLabel = (d: Date) =>
    d.toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN", { month: "short" });

  const now = new Date();
  const recentMonths = Array.from({ length: 4 }, (_, i) => {
    const dt = new Date(now.getFullYear(), now.getMonth() - (3 - i), 1);
    return dt;
  });

  const recoveryData = recentMonths.map((monthDate) => {
    const key = monthKey(monthDate);
    const monthSessions = sessions.filter((s) => {
      if (!s?.datetime) return false;
      const d = new Date(s.datetime);
      return !Number.isNaN(d.getTime()) && monthKey(d) === key;
    });
    const monthCompleted = monthSessions.filter((s) => s.status === "completed").length;
    const rate = monthSessions.length > 0 ? Math.round((monthCompleted / monthSessions.length) * 100) : 0;
    return {
      month: monthLabel(monthDate),
      rate,
      patients: new Set(monthSessions.map((s) => s.patient_id).filter(Boolean)).size,
    };
  });

  const latestRate = recoveryData[recoveryData.length - 1]?.rate ?? 0;
  const previousRate = recoveryData[recoveryData.length - 2]?.rate ?? latestRate;
  const recoveryDelta = latestRate - previousRate;

  // Dynamic therapy performance
  const therapyMap = new Map<string, { completed: number; scheduled: number; total: number }>();
  sessions.forEach((s) => {
    const therapy = String(s.therapy || "Panchakarma");
    const curr = therapyMap.get(therapy) || { completed: 0, scheduled: 0, total: 0 };
    curr.total += 1;
    if (s.status === "completed") curr.completed += 1;
    if (activeStatuses.has(String(s.status))) curr.scheduled += 1;
    therapyMap.set(therapy, curr);
  });
  const sessionData = Array.from(therapyMap.entries()).map(([therapy, v]) => ({
    therapy,
    completed: v.completed,
    scheduled: v.scheduled,
    success_rate: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
  }));

  // Dosha distribution
  const doshaData = [
    { name: 'Vata', value: patients.filter(p => p.dosha?.includes('Vata')).length, color: '#3B82F6' },
    { name: 'Pitta', value: patients.filter(p => p.dosha?.includes('Pitta')).length, color: '#EF4444' },
    { name: 'Kapha', value: patients.filter(p => !p.dosha?.includes('Vata') && !p.dosha?.includes('Pitta')).length, color: '#10B981' }, // Fallback to Kapha or unknown
  ];

  // Dynamic weekly quality trend (proxy 0-5 based on completed ratio)
  const weekBuckets = Array.from({ length: 4 }, (_, i) => {
    const end = new Date();
    end.setDate(end.getDate() - (3 - i) * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return { start, end, label: `W${i + 1}` };
  });
  const satisfactionData = weekBuckets.map((w) => {
    const weekSessions = sessions.filter((s) => {
      if (!s?.datetime) return false;
      const d = new Date(s.datetime);
      return !Number.isNaN(d.getTime()) && d >= w.start && d <= w.end;
    });
    const done = weekSessions.filter((s) => s.status === "completed").length;
    const satisfaction = weekSessions.length > 0 ? Number(((done / weekSessions.length) * 5).toFixed(1)) : 0;
    return { week: w.label, satisfaction, sessions: weekSessions.length };
  });
  const averageSatisfaction = satisfactionData.reduce((sum, w) => sum + w.satisfaction, 0) / Math.max(satisfactionData.filter((w) => w.sessions > 0).length, 1);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-primary">
            {t("doctorAnalytics.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("doctorAnalytics.subtitle")}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => toast({ title: t('doctorAnalytics.filters'), description: language === "hi" ? 'फ़िल्टर विकल्प जल्द आएंगे।' : 'Filter options coming soon.' })}>
            <Filter className="w-4 h-4 mr-2" />
            {t("doctorAnalytics.filters")}
          </Button>
          <Button className="ayur-button-accent" onClick={handleExportReport}>
            <Download className="w-4 h-4 mr-2" />
            {t("doctorAnalytics.export")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="ayur-card p-6 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-primary">{activePatientsCount}</div>
              <div className="text-sm text-muted-foreground">{t("doctorAnalytics.activePatients")}</div>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div className="flex items-center text-sm mt-2">
            <span className="text-muted-foreground ml-1">{totalPatients} total</span>
          </div>
        </Card>

        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-accent">{recoveryRate}%</div>
              <div className="text-sm text-muted-foreground">{t("patient.recoveryProgress")}</div>
            </div>
            <div className="p-3 bg-accent/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-accent" />
            </div>
          </div>
          <div className="flex items-center text-sm mt-2">
            {recoveryDelta >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
            )}
            <span className={recoveryDelta >= 0 ? "text-green-600" : "text-red-600"}>
              {recoveryDelta >= 0 ? "+" : ""}{recoveryDelta}%
            </span>
            <span className="text-muted-foreground ml-1">{t("doctorAnalytics.improvement")}</span>
          </div>
        </Card>

        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-600">{completedSessions}</div>
              <div className="text-sm text-muted-foreground">{t("doctorAnalytics.sessionsCompleted")}</div>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="flex items-center text-sm mt-2">
            <span className="text-muted-foreground">{scheduledSessions} scheduled</span>
          </div>
        </Card>

        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-ayur-soft-gold">{averageSatisfaction.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">{t("doctorAnalytics.avgSatisfaction")}</div>
            </div>
            <div className="p-3 bg-ayur-soft-gold/10 rounded-lg">
              <Star className="w-6 h-6 text-ayur-soft-gold" />
            </div>
          </div>
          <div className="flex items-center text-sm mt-2">
            <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-green-600">{t("doctorAnalytics.excellent")}</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recovery Rate Trend */}
        <Card className="ayur-card p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-playfair text-xl font-semibold flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-primary" />
              {t("doctorAnalytics.recoveryRateTrend")}
            </h3>
            <Badge className={recoveryDelta >= 0 ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}>
              {recoveryDelta >= 0 ? "+" : ""}{recoveryDelta}% {language === "hi" ? "पिछले महीने से" : "vs last month"}
            </Badge>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recoveryData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-muted-foreground" />
                <YAxis className="text-muted-foreground" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Session Success Rates */}
        <Card className="ayur-card p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-primary" />
            {t("doctorAnalytics.therapySuccess")}
          </h3>
          
          <div className="space-y-4">
            {sessionData.length > 0 ? sessionData.map((therapy, index) => (
              <div key={therapy.therapy} className="animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{therapy.therapy}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">{therapy.success_rate}%</div>
                    <div className="text-xs text-muted-foreground">
                      {therapy.completed} completed, {therapy.scheduled} scheduled
                    </div>
                  </div>
                </div>
                <Progress value={therapy.success_rate} className="h-2" />
              </div>
            )) : <div className="text-sm text-muted-foreground">{language === "hi" ? "अभी कोई सत्र डेटा नहीं है।" : "No session data available yet."}</div>}
          </div>
        </Card>

        {/* Dosha Distribution */}
        <Card className="ayur-card p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2 text-primary" />
            {t("doctorAnalytics.doshaDistribution")}
          </h3>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  dataKey="value"
                  data={doshaData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {doshaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            {doshaData.map((dosha) => (
              <div key={dosha.name} className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: dosha.color }}
                  />
                  <span className="font-medium">{dosha.name}</span>
                </div>
                <div className="text-2xl font-bold">{dosha.value}</div>
                <div className="text-xs text-muted-foreground">{t("doctorAnalytics.patients")}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Patient Satisfaction */}
        <Card className="ayur-card p-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <Star className="w-5 h-5 mr-2 text-primary" />
            {t("doctorAnalytics.satisfactionTrend")}
          </h3>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={satisfactionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" className="text-muted-foreground" />
                <YAxis domain={[0, 5]} className="text-muted-foreground" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="satisfaction" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top Performing Treatments & Patient Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="ayur-card p-6 animate-slide-up">
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-primary" />
            {t("doctorAnalytics.topTreatments")}
          </h3>
          
          <div className="space-y-3">
            {sessionData
              .sort((a, b) => b.success_rate - a.success_rate)
              .map((therapy, index) => (
                <div
                  key={therapy.therapy}
                  className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{therapy.therapy}</div>
                      <div className="text-sm text-muted-foreground">
                        {therapy.completed} sessions completed
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">{therapy.success_rate}%</div>
                    <div className="text-xs text-muted-foreground">{t("doctorAnalytics.successRate")}</div>
                  </div>
                </div>
              ))}
            {sessionData.length === 0 && (
              <div className="text-sm text-muted-foreground">{language === "hi" ? "अभी कोई थेरेपी प्रदर्शन डेटा नहीं है।" : "No therapy performance data yet."}</div>
            )}
          </div>
        </Card>

        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-primary" />
            {t("doctorAnalytics.highPriorityPatients")}
          </h3>
          
          <div className="space-y-3">
            {patients
              .map((patient) => {
                const patientSessions = sessions.filter((s: any) => s.patient_id === patient.id);
                const maxPriority = patientSessions.reduce((mx: number, s: any) => {
                  const n = Number(s.totalPriorityScore ?? s.priority) || 0;
                  return Math.max(mx, n);
                }, 0);
                return { patient, maxPriority };
              })
              .filter((x) => x.maxPriority >= 80)
              .sort((a, b) => b.maxPriority - a.maxPriority)
              .map(({ patient, maxPriority }, index) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in cursor-pointer hover:bg-red-100 transition-colors"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={patient.avatar} alt={patient.name} />
                      <AvatarFallback>
                        {(patient.name || 'U P').split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{patient.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {patient.reason_for_visit || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <Badge className="priority-badge-high">
                    {maxPriority}
                  </Badge>
                </div>
              ))}
          </div>

          <Button variant="outline" className="w-full mt-4">
            {t("doctorAnalytics.viewAllPatients")}
          </Button>
        </Card>
      </div>
      </>)}
    </div>
  );
};

export default DoctorAnalytics;