import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { 
  TrendingUp,
  Calendar,
  Activity,
  BarChart3,
  Target,
  Clock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';

const ProgressPage = () => {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [patientSessions, setPatientSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user?.uid) return;
      try {
        const q = query(collection(db, 'sessions'), where('patient_id', '==', user.uid));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPatientSessions(data);
      } catch (err) {
        console.error("Error fetching sessions:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [user]);

  const currentPatient = user as any;
  
  const completedSessions = patientSessions.filter(s => s.status === 'completed').length;
  const recommendedSessions = currentPatient?.llm_recommendation?.sessions_recommended || 5;
  const progressPercentage = Math.min(Math.round((completedSessions / recommendedSessions) * 100), 100);
  
  // Dynamic Chart data simulation based on user health score and completed sessions
  const baseScore = currentPatient?.healthScore || 50;
  const improvementPerSession = 5;
  
  const chartData = Array.from({ length: Math.max(completedSessions + 1, 4) }, (_, i) => ({
    session: `${t("progress.session")} ${i}`,
    overall: Math.min(baseScore + (i * improvementPerSession), 100),
    vitality: Math.min(baseScore - 10 + (i * (improvementPerSession + 2)), 100)
  }));

  const recoveryData = [
    { name: t("progress.recovery"), value: progressPercentage, fill: 'hsl(var(--primary))' },
    { name: t("progress.remaining"), value: 100 - progressPercentage, fill: 'hsl(var(--muted))' }
  ];

  // Dynamic session type breakdown
  const sessionTypes = patientSessions.reduce((acc, session) => {
    if (!acc[session.therapy]) {
      acc[session.therapy] = { completed: 0, total: 0 };
    }
    acc[session.therapy].total += 1;
    if (session.status === 'completed') acc[session.therapy].completed += 1;
    return acc;
  }, {} as Record<string, { completed: number, total: number }>);

  const sessionTypeData = Object.keys(sessionTypes).map((type, index) => ({
    type,
    completed: sessionTypes[type].completed,
    total: sessionTypes[type].total,
    color: index % 2 === 0 ? 'hsl(var(--primary))' : 'hsl(var(--ayur-saffron))'
  }));

  const symptoms = currentPatient?.symptoms || [{ name: t("progress.generalFatigue"), score: 6 }];
  const averageImprovement = progressPercentage; // Use overall progress for simplicity

  if (loading) return <div className="p-6 text-center">{t("progress.loading")}</div>;

  if (role !== 'patient') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">{t("progress.analyticsDashboard")}</h2>
          <p className="text-muted-foreground">
            {t("progress.switchToPatient")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-playfair text-3xl font-bold text-primary mb-2">
          {t("progress.myProgress")}
        </h1>
        <p className="text-muted-foreground">
          {t("progress.trackJourney")}
        </p>
      </div>

      {/* Progress Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="ayur-card p-4 animate-slide-up">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{progressPercentage}%</div>
              <div className="text-sm text-muted-foreground">{t("progress.overallRecovery")}</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Activity className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">{Math.round(averageImprovement)}%</div>
              <div className="text-sm text-muted-foreground">{t("progress.symptomImprovement")}</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-ayur-soft-gold/10 rounded-lg">
              <Calendar className="w-5 h-5 text-ayur-soft-gold" />
            </div>
            <div>
              <div className="text-2xl font-bold text-ayur-soft-gold">{patientSessions.length}</div>
              <div className="text-sm text-muted-foreground">{t("progress.totalSessions")}</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {completedSessions}
              </div>
              <div className="text-sm text-muted-foreground">{t("patient.completed")}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Symptom Progression Chart */}
        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-primary" />
            {t("progress.symptomOverTime")}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="session" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="vitality" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--accent))', strokeWidth: 0, r: 4 }}
                  name={t("progress.vitality")}
                />
                <Line 
                  type="monotone" 
                  dataKey="overall" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                  name={t("progress.overallScore")}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center space-x-6 mt-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-accent"></div>
              <span>{t("progress.vitality")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span>{t("progress.overallScore")}</span>
            </div>
          </div>
        </Card>

        {/* Recovery Radial Chart */}
        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2 text-primary" />
            {t("progress.recoveryProgress")}
          </h3>
          <div className="h-64 flex items-center justify-center">
            <div className="relative">
              <ResponsiveContainer width={200} height={200}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={recoveryData}>
                  <RadialBar 
                    dataKey="value" 
                    cornerRadius={10} 
                    fill="hsl(var(--primary))"
                    className="animate-scale-in"
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{progressPercentage}%</div>
                  <div className="text-sm text-muted-foreground">{t("progress.recovered")}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              {t("progress.excellentContinue")}
            </p>
          </div>
        </Card>
      </div>

      {/* Current Symptoms Status */}
      <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.6s' }}>
        <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-primary" />
          {t("progress.currentSymptomStatus")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {symptoms.map((symptom: { name: string, score: number }, index: number) => {
            const initialScore = symptom.score + 3; // Simulate initial higher scores
            const improvementPercent = ((initialScore - symptom.score) / initialScore) * 100;
            
            return (
              <div key={index} className="p-4 bg-muted/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{symptom.name}</h4>
                  <Badge 
                    variant={symptom.score <= 3 ? 'default' : symptom.score <= 6 ? 'secondary' : 'destructive'}
                  >
                    {symptom.score}/10
                  </Badge>
                </div>
                <ProgressBar 
                  value={(10 - symptom.score) * 10} 
                  className="mb-2 h-2"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t("progress.improvement")}: {Math.max(Math.round(improvementPercent), 0)}%</span>
                  <span>
                    {symptom.score <= 3 ? t("common.excellent") : symptom.score <= 6 ? t("common.good") : t("common.needsAttention")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Session Types Progress */}
      <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.7s' }}>
        <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-primary" />
          {t("progress.treatmentBreakdown")}
        </h3>
        <div className="space-y-4">
          {sessionTypeData.map((session, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: session.color }}
                ></div>
                <span className="font-medium">{session.type}</span>
              </div>
              <div className="flex items-center space-x-4">
                <ProgressBar 
                  value={(session.completed / session.total) * 100} 
                  className="w-24 h-2"
                />
                <span className="text-sm text-muted-foreground min-w-0">
                  {session.completed}/{session.total}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default ProgressPage;