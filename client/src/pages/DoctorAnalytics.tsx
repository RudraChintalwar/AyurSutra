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

const DoctorAnalytics = () => {
  const { patients, sessions, loading } = useDoctorData();
  const { toast } = useToast();

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
      toast({ title: 'Report Exported \u2705', description: 'CSV file downloaded successfully.' });
    } catch (err) {
      toast({ title: 'Export Failed', description: 'Could not generate report.', variant: 'destructive' });
    }
  };

  // Generate analytics data
  const totalPatients = patients.length;
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  const scheduledSessions = sessions.filter(s => s.status === 'scheduled').length;
  const averagePriority = totalPatients > 0 
    ? Math.round(patients.reduce((sum, p) => sum + (p.llm_recommendation?.priority_score || 0), 0) / totalPatients)
    : 0;

  // Recovery rate data
  const recoveryData = [
    { month: 'Jul', rate: 78, patients: 15 },
    { month: 'Aug', rate: 82, patients: 18 },
    { month: 'Sep', rate: 85, patients: 22 },
    { month: 'Oct', rate: 88, patients: 25 },
  ];

  // Session completion data
  const sessionData = [
    { therapy: 'Virechana', completed: 8, scheduled: 3, success_rate: 92 },
    { therapy: 'Vamana', completed: 5, scheduled: 2, success_rate: 88 },
    { therapy: 'Basti', completed: 12, scheduled: 4, success_rate: 95 },
    { therapy: 'Abhyanga', completed: 15, scheduled: 6, success_rate: 90 },
  ];

  // Dosha distribution
  const doshaData = [
    { name: 'Vata', value: patients.filter(p => p.dosha?.includes('Vata')).length, color: '#3B82F6' },
    { name: 'Pitta', value: patients.filter(p => p.dosha?.includes('Pitta')).length, color: '#EF4444' },
    { name: 'Kapha', value: patients.filter(p => !p.dosha?.includes('Vata') && !p.dosha?.includes('Pitta')).length, color: '#10B981' }, // Fallback to Kapha or unknown
  ];

  // Patient satisfaction data
  const satisfactionData = [
    { week: 'W1', satisfaction: 4.2, sessions: 8 },
    { week: 'W2', satisfaction: 4.5, sessions: 12 },
    { week: 'W3', satisfaction: 4.3, sessions: 10 },
    { week: 'W4', satisfaction: 4.6, sessions: 15 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-primary">
            Analytics & Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Track practice performance and patient outcomes
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => toast({ title: 'Filters', description: 'Filter options coming soon.' })}>
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button className="ayur-button-accent" onClick={handleExportReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
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
              <div className="text-2xl font-bold text-primary">{totalPatients}</div>
              <div className="text-sm text-muted-foreground">Active Patients</div>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div className="flex items-center text-sm mt-2">
            <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-green-600">+15%</span>
            <span className="text-muted-foreground ml-1">vs last month</span>
          </div>
        </Card>

        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-accent">85%</div>
              <div className="text-sm text-muted-foreground">Recovery Rate</div>
            </div>
            <div className="p-3 bg-accent/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-accent" />
            </div>
          </div>
          <div className="flex items-center text-sm mt-2">
            <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-green-600">+3%</span>
            <span className="text-muted-foreground ml-1">improvement</span>
          </div>
        </Card>

        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-600">{completedSessions}</div>
              <div className="text-sm text-muted-foreground">Sessions Completed</div>
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
              <div className="text-2xl font-bold text-ayur-soft-gold">4.5</div>
              <div className="text-sm text-muted-foreground">Avg Satisfaction</div>
            </div>
            <div className="p-3 bg-ayur-soft-gold/10 rounded-lg">
              <Star className="w-6 h-6 text-ayur-soft-gold" />
            </div>
          </div>
          <div className="flex items-center text-sm mt-2">
            <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-green-600">Excellent</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recovery Rate Trend */}
        <Card className="ayur-card p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-playfair text-xl font-semibold flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-primary" />
              Recovery Rate Trend
            </h3>
            <Badge className="bg-green-100 text-green-700 border-green-200">
              +10% This Quarter
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
            Therapy Success Rates
          </h3>
          
          <div className="space-y-4">
            {sessionData.map((therapy, index) => (
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
            ))}
          </div>
        </Card>

        {/* Dosha Distribution */}
        <Card className="ayur-card p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2 text-primary" />
            Patient Dosha Distribution
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
                <div className="text-xs text-muted-foreground">patients</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Patient Satisfaction */}
        <Card className="ayur-card p-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <Star className="w-5 h-5 mr-2 text-primary" />
            Patient Satisfaction Trend
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
            Top Performing Treatments
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
                    <div className="text-xs text-muted-foreground">success rate</div>
                  </div>
                </div>
              ))}
          </div>
        </Card>

        <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-primary" />
            High Priority Patients
          </h3>
          
          <div className="space-y-3">
            {patients
              .filter(p => (p.llm_recommendation?.priority_score || 0) >= 80)
              .map((patient, index) => (
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
                    {patient.llm_recommendation?.priority_score || 0}
                  </Badge>
                </div>
              ))}
          </div>

          <Button variant="outline" className="w-full mt-4">
            View All Patients
          </Button>
        </Card>
      </div>
      </>)}
    </div>
  );
};

export default DoctorAnalytics;