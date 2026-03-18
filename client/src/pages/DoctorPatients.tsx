import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PatientRegistrationModal from '@/components/PatientRegistrationModal';
import FilterModal from '@/components/FilterModal';
import MessageModal from '@/components/MessageModal';
import PatientDetailsModal from '@/components/PatientDetailsModal';
import { 
  Users, 
  Search, 
  Filter,
  Plus,
  Phone,
  Mail,
  Calendar,
  Activity,
  User,
  Star,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { useDoctorData, Patient } from '@/hooks/useDoctorData';
import { useToast } from '@/hooks/use-toast';

const DoctorPatients = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { patients, sessions, loading } = useDoctorData();

  const getDoshaBadge = (dosha: string) => {
    if (dosha.includes('Vata')) return 'dosha-vata';
    if (dosha.includes('Pitta')) return 'dosha-pitta';
    if (dosha.includes('Kapha')) return 'dosha-kapha';
    return 'dosha-vata';
  };

  const getPriorityBadge = (score: number) => {
    if (score >= 80) return { label: 'High', className: 'priority-badge-high' };
    if (score >= 60) return { label: 'Medium', className: 'priority-badge-medium' };
    return { label: 'Low', className: 'priority-badge-low' };
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         patient.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'high-priority') return matchesSearch && (patient.llm_recommendation?.priority_score || 0) >= 80;
    if (activeTab === 'recent') return matchesSearch; // Would filter by recent activity in real app
    
    return matchesSearch;
  });

  const handleScheduleSession = (patient: Patient) => {
    toast({
      title: "Scheduling Session",
      description: `Opening scheduler for ${patient.name}...`,
    });
    navigate('/doctor/calendar');
  };

  const handleViewRecords = (patient: Patient) => {
    toast({
      title: "Patient Records",
      description: `Loading medical records for ${patient.name}...`,
    });
    setShowPatientDetails(true);
  };

  const handleMessagePatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowMessageModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-primary">
            Patient Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your patients and their treatment plans
          </p>
        </div>
        <Button className="ayur-button-accent" onClick={() => setShowRegistrationModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add New Patient
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
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{patients.length}</div>
              <div className="text-sm text-muted-foreground">Total Patients</div>
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
                {patients.filter(p => (p.llm_recommendation?.priority_score || 0) >= 80).length}
              </div>
              <div className="text-sm text-muted-foreground">High Priority</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {sessions.filter(s => s.status === 'scheduled').length}
              </div>
              <div className="text-sm text-muted-foreground">Active Sessions</div>
            </div>
          </div>
        </Card>

        <Card className="ayur-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">85%</div>
              <div className="text-sm text-muted-foreground">Recovery Rate</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient List */}
        <div className="lg:col-span-2">
          <Card className="ayur-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-playfair text-xl font-semibold">Patient List</h3>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search patients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={() => setShowFilterModal(true)}>
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All Patients</TabsTrigger>
                <TabsTrigger value="high-priority">High Priority</TabsTrigger>
                <TabsTrigger value="recent">Recent Activity</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-3">
              {filteredPatients.map((patient, index) => (
                <div
                  key={patient.id}
                  className={`p-4 rounded-lg cursor-pointer transition-all animate-fade-in hover:scale-[1.02] ${
                    selectedPatient?.id === patient.id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-muted/30 hover:bg-muted/50'
                  }`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => setSelectedPatient(patient)}
                >
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={patient.avatar} alt={patient.name} />
                      <AvatarFallback>
                        {patient.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground">{patient.name || 'Unnamed Patient'}</h4>
                        <Badge className={getPriorityBadge(patient.llm_recommendation?.priority_score || 0).className}>
                          Priority: {patient.llm_recommendation?.priority_score || 'N/A'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-3 mt-2">
                        <Badge className={`${getDoshaBadge(patient.dosha || '')} text-xs`}>
                          {patient.dosha || 'Unknown'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{patient.reason_for_visit || 'No reason specified'}</span>
                      </div>
                      
                      <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Phone className="w-3 h-3 mr-1" />
                          {patient.phone || 'No phone'}
                        </div>
                        <div className="flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          {patient.email}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Patient Detail Panel */}
        <div className="lg:col-span-1">
          <Card className="ayur-card p-6 sticky top-6">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-primary" />
              Patient Details
            </h3>
            
            {selectedPatient ? (
              <div className="space-y-4 animate-scale-in">
                <div className="text-center">
                  <Avatar className="w-20 h-20 mx-auto mb-3">
                    <AvatarImage src={selectedPatient.avatar} alt={selectedPatient.name} />
                    <AvatarFallback>
                      {(selectedPatient.name || 'U P').split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <h4 className="font-semibold text-lg">{selectedPatient.name}</h4>
                  <Badge className={`${getDoshaBadge(selectedPatient.dosha || '')} text-xs mt-1`}>
                    {selectedPatient.dosha || 'Unknown'} Constitution
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Contact Information</div>
                    <div className="text-sm mt-1">
                      <div className="flex items-center">
                        <Phone className="w-3 h-3 mr-2" />
                        {selectedPatient.phone}
                      </div>
                      <div className="flex items-center mt-1">
                        <Mail className="w-3 h-3 mr-2" />
                        {selectedPatient.email}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Chief Complaint</div>
                    <div className="text-sm mt-1">{selectedPatient.reason_for_visit || 'No reason specified'}</div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Current Symptoms</div>
                    {selectedPatient.symptoms?.map((symptom: any, index: number) => (
                      <div key={index} className="flex justify-between items-center text-sm mb-1">
                        <span>{symptom.name}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-primary to-accent h-2 rounded-full"
                              style={{ width: `${(symptom.score / 10) * 100}%` }}
                            />
                          </div>
                          <span className="font-medium w-8">{symptom.score}/10</span>
                        </div>
                      </div>
                    )) || <div className="text-sm text-muted-foreground">No symptoms recorded</div>}
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Treatment Plan</div>
                    <div className="p-3 bg-primary/5 rounded-lg">
                      <div className="text-sm font-medium text-primary">
                        {selectedPatient.llm_recommendation?.therapy || 'No therapy prescribed'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {selectedPatient.llm_recommendation?.sessions_recommended || 0} sessions • 
                        Every {selectedPatient.llm_recommendation?.spacing_days || 0} days
                      </div>
                      <div className="text-xs mt-2">
                        {selectedPatient.llm_recommendation?.explanation || ''}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-4 border-t">
                  <Button size="sm" className="ayur-button-hero" onClick={() => selectedPatient && handleScheduleSession(selectedPatient)}>
                    <Calendar className="w-4 h-4 mr-1" />
                    Schedule
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => selectedPatient && handleViewRecords(selectedPatient)}>
                    <Star className="w-4 h-4 mr-1" />
                    Records
                  </Button>
                </div>
                
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => selectedPatient && handleMessagePatient(selectedPatient)}>
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Send Message
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a patient to view details</p>
              </div>
            )}
          </Card>
        </div>
      </div>
      </>)}
      
      {/* Modals */}
      <PatientRegistrationModal
        isOpen={showRegistrationModal}
        onClose={() => setShowRegistrationModal(false)}
      />
      
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        type="patients"
      />
      
      <MessageModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        recipient={selectedPatient ? {
          id: selectedPatient.id,
          name: selectedPatient.name,
          avatar: selectedPatient.avatar,
          role: 'patient'
        } : undefined}
      />
      
      <PatientDetailsModal
        isOpen={showPatientDetails}
        onClose={() => setShowPatientDetails(false)}
        patient={selectedPatient}
      />
    </div>
  );
};

export default DoctorPatients;