import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Activity, 
  FileText,
  TrendingUp,
  Star,
  MessageSquare
} from 'lucide-react';
import { Patient } from '@/hooks/useDoctorData';

interface PatientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

const PatientDetailsModal: React.FC<PatientDetailsModalProps> = ({ isOpen, onClose, patient }) => {
  if (!patient) return null;

  const getDoshaBadge = (dosha?: string) => {
    if (!dosha) return 'dosha-vata';
    if (dosha.includes('Vata')) return 'dosha-vata';
    if (dosha.includes('Pitta')) return 'dosha-pitta';
    if (dosha.includes('Kapha')) return 'dosha-kapha';
    return 'dosha-vata';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <User className="w-5 h-5 text-primary" />
            <span>Patient Profile - {patient.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Header */}
          <Card className="p-6">
            <div className="flex items-start space-x-6">
              <Avatar className="w-24 h-24">
                <AvatarImage src={patient.avatar} alt={patient.name} />
                <AvatarFallback>
                  {patient.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-playfair font-bold text-primary mb-2">
                      {patient.name}
                    </h2>
                    <div className="flex items-center space-x-3 mb-3">
                      <Badge className={`${getDoshaBadge(patient.dosha)} px-3 py-1`}>
                        {patient.dosha || 'Unknown'} Constitution
                      </Badge>
                      {/* Priority score is intentionally hidden from patients. */}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button size="sm" className="ayur-button-hero">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Message
                    </Button>
                    <Button size="sm" variant="outline">
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{patient.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{patient.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>ID: {patient.id}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Detailed Information Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="symptoms">Symptoms</TabsTrigger>
              <TabsTrigger value="treatment">Treatment</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center">
                    <User className="w-4 h-4 mr-2 text-primary" />
                    Personal Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Full Name:</strong> {patient.name}</div>
                    <div><strong>Patient ID:</strong> {patient.id}</div>
                    <div><strong>Phone:</strong> {patient.phone || 'N/A'}</div>
                    <div><strong>Email:</strong> {patient.email}</div>
                    <div><strong>Constitution:</strong> {patient.dosha || 'Unknown'} Dominant</div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center">
                    <Activity className="w-4 h-4 mr-2 text-primary" />
                    Health Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Chief Complaint:</strong> {patient.reason_for_visit || 'None specified'}</div>
                    {/* Priority score is intentionally hidden from patients. */}
                    <div><strong>Current Status:</strong> Active Treatment</div>
                    <div><strong>Last Visit:</strong> N/A</div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="symptoms" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-primary" />
                  Current Symptoms Assessment
                </h3>
                <div className="space-y-3">
                  {patient.symptoms?.map((symptom: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="font-medium">{symptom.name}</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all"
                            style={{ width: `${(symptom.score / 10) * 100}%` }}
                          />
                        </div>
                        <span className="font-bold text-sm w-10">{symptom.score}/10</span>
                        <Badge variant={symptom.score >= 7 ? 'destructive' : symptom.score >= 4 ? 'default' : 'secondary'}>
                          {symptom.score >= 7 ? 'High' : symptom.score >= 4 ? 'Moderate' : 'Low'}
                        </Badge>
                      </div>
                    </div>
                  )) || <div className="text-muted-foreground p-4">No symptoms recorded</div>}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="treatment" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center">
                  <Star className="w-4 h-4 mr-2 text-primary" />
                  Current Treatment Plan
                </h3>
                <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
                  <h4 className="font-semibold text-lg text-primary mb-2">
                    {patient.llm_recommendation?.therapy || 'No therapy planned yet'}
                  </h4>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
                    <span>Duration: {patient.llm_recommendation?.sessions_recommended || 0} sessions</span>
                    <span>Frequency: Every {patient.llm_recommendation?.spacing_days || 0} days</span>
                  </div>
                  <p className="text-sm leading-relaxed">
                    {patient.llm_recommendation?.explanation || ''}
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center p-3 bg-primary/5 rounded-lg">
                    <div className="text-xl font-bold text-primary">
                      {patient.llm_recommendation?.sessions_recommended || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Recommended</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-600">0</div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center p-3 bg-accent/5 rounded-lg">
                    <div className="text-xl font-bold text-accent">
                      {patient.llm_recommendation?.sessions_recommended || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Remaining</div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-primary" />
                  Treatment History
                </h3>
                <div className="space-y-3">
                  {[
                    { date: '2024-01-15', treatment: 'Panchakarma Detox - Session 5', status: 'Completed', rating: 5 },
                    { date: '2024-01-12', treatment: 'Abhyanga Massage', status: 'Completed', rating: 4 },
                    { date: '2024-01-10', treatment: 'Shirodhara Therapy', status: 'Completed', rating: 5 },
                    { date: '2024-01-08', treatment: 'Panchakarma Detox - Session 4', status: 'Completed', rating: 4 },
                  ].map((record, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <FileText className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{record.treatment}</div>
                          <div className="text-xs text-muted-foreground">{record.date}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs mb-1">
                          {record.status}
                        </Badge>
                        <div className="flex items-center text-xs">
                          {Array.from({ length: record.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PatientDetailsModal;