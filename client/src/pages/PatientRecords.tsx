import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  FileText,
  Download,
  Search,
  Calendar,
  Activity,
  Heart,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Stethoscope,
  Pill,
  TestTube
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { mockData } from '@/data/mockData';

const PatientRecords = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  const currentPatientId = 'p1';
  const currentPatient = mockData.patients.find(p => p.id === currentPatientId);
  const patientSessions = mockData.sessions.filter(s => s.patient_id === currentPatientId);

  // Generate medical records data
  const medicalRecords = [
    {
      id: 'r1',
      date: '2025-09-28',
      type: 'Session Report',
      title: 'Basti Treatment - Session 1',
      doctor: 'Dr. Kavya Rao',
      status: 'completed',
      summary: 'First Basti session completed successfully. Patient responded well to treatment.',
      details: {
        symptoms_before: { insomnia: 7, stiff_joints: 5 },
        symptoms_after: { insomnia: 5, stiff_joints: 3 },
        observations: 'Patient showed immediate relief in joint stiffness. Sleep quality improved.',
        recommendations: 'Continue with warm oil intake and maintain sleep hygiene.'
      }
    },
    {
      id: 'r2',
      date: '2025-09-15',
      type: 'Initial Assessment',
      title: 'Panchakarma Consultation',
      doctor: 'Dr. Sargun Mehta',
      status: 'completed',
      summary: 'Comprehensive Ayurvedic assessment and treatment plan development.',
      details: {
        dosha_analysis: 'Vata imbalance with nervous system involvement',
        pulse_diagnosis: 'Irregular, fast pulse indicating Vata aggravation',
        tongue_examination: 'Dry, slightly coated indicating toxin accumulation',
        treatment_plan: 'Basti therapy recommended for 5 sessions'
      }
    },
    {
      id: 'r3',
      date: '2025-08-30',
      type: 'Lab Report',
      title: 'Pre-treatment Health Assessment',
      doctor: 'Lab Technician',
      status: 'completed',
      summary: 'Complete blood count and metabolic panel within normal ranges.',
      details: {
        hemoglobin: '12.5 g/dL (Normal)',
        blood_pressure: '120/80 mmHg (Normal)',
        cholesterol: '180 mg/dL (Normal)',
        blood_sugar: '95 mg/dL (Normal)'
      }
    }
  ];

  // Progress data for charts
  const progressData = mockData.chart_data.p3_symptom_history.map(entry => ({
    date: new Date(entry.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    insomnia: entry.insomnia,
    stiff_joints: entry.stiff_joints,
    overall: Math.round((entry.insomnia + entry.stiff_joints) / 2)
  }));

  const filteredRecords = medicalRecords.filter(record =>
    record.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.doctor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-primary">
            Medical Records
          </h1>
          <p className="text-muted-foreground mt-1">
            Your complete health history and treatment records
          </p>
        </div>
        <Button className="ayur-button-accent">
          <Download className="w-4 h-4 mr-2" />
          Export Records
        </Button>
      </div>

      {/* Patient Summary */}
      <Card className="ayur-card p-6 animate-slide-up">
        <div className="flex items-start space-x-6 mb-6">
          <Avatar className="w-24 h-24">
            <AvatarImage src={currentPatient?.avatar} alt={currentPatient?.name} />
            <AvatarFallback>
              {currentPatient?.name?.split(' ').map(n => n[0]).join('') || 'P'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-playfair text-2xl font-semibold">{currentPatient?.name}</h2>
                <p className="text-muted-foreground">Patient ID: {currentPatientId}</p>
              </div>
              <Badge className="dosha-vata px-3 py-1">
                {currentPatient?.dosha} Constitution
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-primary/5 rounded-lg">
                <div className="text-lg font-bold text-primary">{patientSessions.length}</div>
                <div className="text-sm text-muted-foreground">Total Sessions</div>
              </div>
              <div className="text-center p-3 bg-green-100 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {patientSessions.filter(s => s.status === 'completed').length}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center p-3 bg-accent/5 rounded-lg">
                <div className="text-lg font-bold text-accent">85%</div>
                <div className="text-sm text-muted-foreground">Recovery Rate</div>
              </div>
              <div className="text-center p-3 bg-ayur-soft-gold/10 rounded-lg">
                <div className="text-lg font-bold text-ayur-soft-gold">
                  {currentPatient?.llm_recommendation.priority_score}
                </div>
                <div className="text-sm text-muted-foreground">Health Score</div>
              </div>
            </div>
          </div>
        </div>

        {/* Health Progress Chart */}
        <div className="mt-6">
          <h3 className="font-playfair text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-primary" />
            Symptom Progress Over Time
          </h3>
          
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-muted-foreground" />
                <YAxis domain={[0, 10]} className="text-muted-foreground" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="insomnia" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Insomnia"
                />
                <Line 
                  type="monotone" 
                  dataKey="stiff_joints" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={2}
                  name="Joint Stiffness"
                />
                <Line 
                  type="monotone" 
                  dataKey="overall" 
                  stroke="hsl(var(--ayur-soft-gold))" 
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  name="Overall"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-1 bg-primary rounded"></div>
              <span className="text-sm">Insomnia Severity</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-1 bg-accent rounded"></div>
              <span className="text-sm">Joint Stiffness</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-1 bg-ayur-soft-gold rounded border-2 border-dashed border-ayur-soft-gold"></div>
              <span className="text-sm">Overall Progress</span>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="records" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="records">Medical Records</TabsTrigger>
          <TabsTrigger value="vitals">Vital Signs</TabsTrigger>
          <TabsTrigger value="medications">Treatments</TabsTrigger>
          <TabsTrigger value="reports">Lab Reports</TabsTrigger>
        </TabsList>

        {/* Medical Records */}
        <TabsContent value="records" className="space-y-6">
          <Card className="ayur-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-playfair text-xl font-semibold">Medical Records</h3>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {filteredRecords.map((record, index) => (
                <div
                  key={record.id}
                  className="p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-lg ${
                        record.type === 'Session Report' ? 'bg-primary/10' :
                        record.type === 'Initial Assessment' ? 'bg-accent/10' :
                        'bg-green-100'
                      }`}>
                        {record.type === 'Session Report' && <Heart className="w-6 h-6 text-primary" />}
                        {record.type === 'Initial Assessment' && <User className="w-6 h-6 text-accent" />}
                        {record.type === 'Lab Report' && <TestTube className="w-6 h-6 text-green-600" />}
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-lg">{record.title}</h4>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDate(record.date)}
                          </div>
                          <div className="flex items-center">
                            <Stethoscope className="w-4 h-4 mr-1" />
                            {record.doctor}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{record.summary}</p>
                        
                        <div className="flex items-center space-x-2 mt-3">
                          <Badge variant="outline" className="text-xs">
                            {record.type}
                          </Badge>
                          <Badge className={
                            record.status === 'completed' 
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-blue-100 text-blue-700 border-blue-200'
                          }>
                            {record.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="sm">
                      <FileText className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Vital Signs */}
        <TabsContent value="vitals" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="ayur-card p-6">
              <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-primary" />
                Current Vitals
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <Heart className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <div className="font-medium">Blood Pressure</div>
                      <div className="text-sm text-muted-foreground">Last recorded</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">120/80</div>
                    <div className="text-sm text-green-600">Normal</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Activity className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">Heart Rate</div>
                      <div className="text-sm text-muted-foreground">Resting BPM</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">72 BPM</div>
                    <div className="text-sm text-green-600">Normal</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium">Temperature</div>
                      <div className="text-sm text-muted-foreground">Body temperature</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">98.6°F</div>
                    <div className="text-sm text-green-600">Normal</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="ayur-card p-6">
              <h3 className="font-playfair text-xl font-semibold mb-4">Vital Trends</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Blood Pressure Stability</span>
                    <span className="text-sm text-green-600">95%</span>
                  </div>
                  <Progress value={95} className="h-2" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Heart Rate Variability</span>
                    <span className="text-sm text-green-600">88%</span>
                  </div>
                  <Progress value={88} className="h-2" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Sleep Quality</span>
                    <span className="text-sm text-accent">78%</span>
                  </div>
                  <Progress value={78} className="h-2" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Stress Levels</span>
                    <span className="text-sm text-muted-foreground">Low</span>
                  </div>
                  <Progress value={25} className="h-2" />
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Treatments */}
        <TabsContent value="medications" className="space-y-6">
          <Card className="ayur-card p-6">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <Pill className="w-5 h-5 mr-2 text-primary" />
              Current Treatments & Medications
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">Basti (Medicated Enema)</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Primary Panchakarma treatment for Vata imbalance
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-sm">
                      <span className="text-muted-foreground">Frequency: Every 3 days</span>
                      <span className="text-muted-foreground">Duration: 5 sessions</span>
                    </div>
                  </div>
                  <Badge className="bg-primary/10 text-primary">
                    Active Treatment
                  </Badge>
                </div>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">Herbal Tea Blend</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Calming herbs for improved sleep and digestion
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-sm">
                      <span className="text-muted-foreground">Dosage: 2 cups daily</span>
                      <span className="text-muted-foreground">With meals</span>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    Ongoing
                  </Badge>
                </div>
              </div>

              <div className="p-4 border border-border rounded-lg opacity-60">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">Warm Oil Massage</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Self-administered daily oil massage for joint relief
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-sm">
                      <span className="text-muted-foreground">Frequency: Daily</span>
                      <span className="text-muted-foreground">Before bath</span>
                    </div>
                  </div>
                  <Badge variant="outline">
                    Completed
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Lab Reports */}
        <TabsContent value="reports" className="space-y-6">
          <Card className="ayur-card p-6">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <TestTube className="w-5 h-5 mr-2 text-primary" />
              Laboratory Reports
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Complete Blood Count</h4>
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    Normal
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hemoglobin</span>
                    <span>12.5 g/dL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">WBC Count</span>
                    <span>6,800/μL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platelet Count</span>
                    <span>250,000/μL</span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Last Updated: Aug 30, 2025
                </div>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Metabolic Panel</h4>
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    Normal
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Blood Sugar</span>
                    <span>95 mg/dL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cholesterol</span>
                    <span>180 mg/dL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Creatinine</span>
                    <span>0.9 mg/dL</span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Last Updated: Aug 30, 2025
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-800">All Clear</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Your latest lab results show all values within normal ranges. 
                    Continue with your current treatment plan.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatientRecords;