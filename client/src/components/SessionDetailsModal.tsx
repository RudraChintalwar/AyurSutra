import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  FileText,
  Heart,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SessionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session?: {
    id: string;
    patient_id: string;
    datetime: string;
    therapy: string;
    duration_minutes: number;
    status: string;
    notes?: string;
  };
  patient?: {
    id: string;
    name: string;
    avatar?: string;
    phone?: string;
    email: string;
    dosha?: string;
    llm_recommendation?: {
      therapy: string;
      sessions_recommended: number;
      spacing_days: number;
      priority_score: number;
      explanation: string;
    };
  };
}

const SessionDetailsModal: React.FC<SessionDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  session,
  patient 
}) => {
  const { toast } = useToast();

  if (!session || !patient) {
    return null;
  }

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'scheduled':
        return <Clock className="w-4 h-4 text-primary" />;
      case 'cancelled':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (score: number) => {
    if (score >= 80) return 'text-red-600 bg-red-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const handleReschedule = () => {
    toast({
      title: "Reschedule Session",
      description: "Opening scheduling interface...",
    });
    onClose();
  };

  const handleCancel = () => {
    toast({
      title: "Session Cancelled",
      description: "The session has been cancelled and patient will be notified.",
      variant: "destructive"
    });
    onClose();
  };

  const handleComplete = () => {
    toast({
      title: "Session Marked Complete ✅",
      description: "Session notes have been saved and patient updated.",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-primary" />
            <span className="font-playfair">Session Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Info Header */}
          <div className="flex items-start space-x-4 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
            <Avatar className="w-16 h-16">
              <AvatarImage src={patient.avatar} alt={patient.name} />
              <AvatarFallback className="text-lg">
                {patient.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
             <div className="flex-1">
              <h3 className="font-playfair text-xl font-semibold">{patient.name}</h3>
              <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-1" />
                  {patient.phone || 'N/A'}
                </div>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-1" />
                  {patient.email}
                </div>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <Badge className={`dosha-${(patient.dosha || 'vata').toLowerCase()}`}>
                  {patient.dosha || 'Unknown'} Constitution
                </Badge>
                <Badge className={getPriorityColor(patient.llm_recommendation?.priority_score || 0)}>
                  Priority: {patient.llm_recommendation?.priority_score || 'N/A'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Session Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-playfair text-lg font-semibold">Session Information</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(session.status)}
                    <Badge variant={session.status === 'completed' ? 'default' : 'outline'}>
                      {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date & Time</span>
                  <div className="text-right">
                    <div className="font-medium">{formatDateTime(session.datetime)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Therapy</span>
                  <span className="font-medium">{session.therapy}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{session.duration_minutes} minutes</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <div className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 mr-1" />
                    Treatment Room A
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-playfair text-lg font-semibold">Treatment Plan</h4>
              
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-start space-x-2 mb-2">
                  <Heart className="w-4 h-4 mt-1 text-primary" />
                  <div>
                    <div className="font-medium text-sm">Recommended Treatment</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {patient.llm_recommendation?.therapy || 'N/A'} - {patient.llm_recommendation?.sessions_recommended || 0} sessions
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground">Priority Score</div>
                  <div className="flex items-center mt-1">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${patient.llm_recommendation?.priority_score || 0}%` }}
                      />
                    </div>
                    <span className="ml-2 text-xs font-medium">
                      {patient.llm_recommendation?.priority_score || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {session.notes && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Session Notes</span>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg text-sm">
                    {session.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          
          <div className="flex space-x-2">
            {session.status === 'scheduled' && (
              <>
                <Button variant="outline" onClick={handleReschedule}>
                  <Edit className="w-4 h-4 mr-2" />
                  Reschedule
                </Button>
                <Button variant="outline" onClick={handleCancel} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleComplete} className="ayur-button-hero">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Complete
                </Button>
              </>
            )}
            
            {session.status === 'completed' && (
              <Button onClick={() => toast({ title: "Session Report", description: "Generating detailed session report..." })} className="ayur-button-accent">
                <FileText className="w-4 h-4 mr-2" />
                View Report
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionDetailsModal;