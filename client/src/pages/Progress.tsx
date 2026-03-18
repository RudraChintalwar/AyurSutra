import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp,
  Calendar,
  Activity,
  BarChart3,
  Target,
  Clock
} from 'lucide-react';
import { mockData } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';

const ProgressPage = () => {
  const { role } = useAuth();
  const currentPatientId = 'p1'; // Simulate logged in as Asha Nair
  const currentPatient = mockData.patients.find(p => p.id === currentPatientId);
  const patientSessions = mockData.sessions.filter(s => s.patient_id === currentPatientId);
  
  // Chart data preparation
  const chartData = mockData.chart_data.p1_symptom_history.map(entry => ({
    date: new Date(entry.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    headache: entry.headache,
    bloating: entry.bloating,
    overall: Math.round((entry.headache + entry.bloating) / 2)
  }));

  const recoveryData = [
    { name: 'Recovery', value: 85, fill: 'hsl(var(--primary))' },
    { name: 'Remaining', value: 15, fill: 'hsl(var(--muted))' }
  ];

  const sessionTypeData = [
    { type: 'Virechana', completed: 1, total: 3, color: 'hsl(var(--ayur-saffron))' },
    { type: 'Abhyanga', completed: 0, total: 2, color: 'hsl(var(--ayur-soft-gold))' },
    { type: 'Consultation', completed: 2, total: 2, color: 'hsl(var(--primary))' }
  ];

  const symptoms = currentPatient?.symptoms || [];
  const averageImprovement = symptoms.reduce((acc, symptom) => {
    const initial = symptom.score + 3; // Simulate initial higher scores
    const improvement = ((initial - symptom.score) / initial) * 100;
    return acc + improvement;
  }, 0) / symptoms.length;

  if (role !== 'patient') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Switch to patient view to see progress tracking, or visit the Analytics page for practitioner insights.
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
          My Progress
        </h1>
        <p className="text-muted-foreground">
          Track your Panchakarma journey and health improvements
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
              <div className="text-2xl font-bold text-primary">85%</div>
              <div className="text-sm text-muted-foreground">Overall Recovery</div>
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
              <div className="text-sm text-muted-foreground">Symptom Improvement</div>
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
              <div className="text-sm text-muted-foreground">Total Sessions</div>
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
                {patientSessions.filter(s => s.status === 'completed').length}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
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
            Symptom Progress Over Time
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
                  dataKey="headache" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--accent))', strokeWidth: 0, r: 4 }}
                  name="Headache"
                />
                <Line 
                  type="monotone" 
                  dataKey="bloating" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                  name="Bloating"
                />
                <Line 
                  type="monotone" 
                  dataKey="overall" 
                  stroke="hsl(var(--ayur-soft-gold))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: 'hsl(var(--ayur-soft-gold))', strokeWidth: 0, r: 3 }}
                  name="Overall"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center space-x-6 mt-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-accent"></div>
              <span>Headache</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span>Bloating</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-ayur-soft-gold"></div>
              <span>Overall Trend</span>
            </div>
          </div>
        </Card>

        {/* Recovery Radial Chart */}
        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2 text-primary" />
            Recovery Progress
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
                  <div className="text-3xl font-bold text-primary">85%</div>
                  <div className="text-sm text-muted-foreground">Recovered</div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              Excellent progress! Continue with your current treatment plan.
            </p>
          </div>
        </Card>
      </div>

      {/* Current Symptoms Status */}
      <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.6s' }}>
        <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-primary" />
          Current Symptom Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {symptoms.map((symptom, index) => {
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
                <Progress 
                  value={(10 - symptom.score) * 10} 
                  className="mb-2 h-2"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Improvement: {Math.round(improvementPercent)}%</span>
                  <span>
                    {symptom.score <= 3 ? 'Excellent' : symptom.score <= 6 ? 'Good' : 'Needs attention'}
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
          Treatment Sessions Breakdown
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
                <Progress 
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