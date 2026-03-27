import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  Calendar,
  MessageSquare,
  FileText,
  Users,
  Phone,
  Video,
  Settings,
  Search,
  Filter,
  Download,
  Share,
  MoreHorizontal,
  Zap,
  Clock,
  Bell
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface QuickActionsProps {
  variant?: 'floating' | 'embedded' | 'sidebar';
  className?: string;
  onAction?: (action: string) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ 
  variant = 'embedded', 
  className = '',
  onAction 
}) => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAction = (action: string, label: string) => {
    onAction?.(action);
    
    // Handle specific actions
    switch (action) {
      case 'schedule':
        toast({
          title: t("quick.openingScheduler"),
          description: t("quick.loadingBooking"),
        });
        if (role === 'patient') {
          navigate('/patient/sessions');
        } else {
          navigate('/doctor/calendar');
        }
        break;
        
      case 'message':
        toast({
          title: t("quick.openingMessages"),
          description: t("quick.loadingCommunication"),
        });
        navigate(`/${role}/messages`);
        break;
        
      case 'records':
        toast({
          title: t("quick.accessingRecords"),
          description: t("quick.loadingMedicalRecords"),
        });
        if (role === 'patient') {
          navigate('/patient/records');
        } else {
          navigate('/doctor/patients');
        }
        break;
        
      case 'emergency':
        toast({
          title: t("quick.emergencyActivated"),
          description: t("quick.connectingEmergency"),
          variant: "destructive",
        });
        break;
        
      case 'video-call':
        toast({
          title: t("quick.startingVideoCall"),
          description: t("quick.connectingTelehealth"),
        });
        break;
        
      default:
        toast({
          title: label,
          description: t("quick.actionTriggered", { label }),
        });
    }
  };

  const patientActions = [
    { 
      id: 'schedule', 
      label: t("quick.scheduleSession"), 
      icon: <Calendar className="w-4 h-4" />, 
      color: 'bg-primary text-primary-foreground',
      urgent: false
    },
    { 
      id: 'message', 
      label: t("quick.messageDoctor"), 
      icon: <MessageSquare className="w-4 h-4" />, 
      color: 'bg-blue-500 text-white',
      urgent: false
    },
    { 
      id: 'records', 
      label: t("quick.viewRecords"), 
      icon: <FileText className="w-4 h-4" />, 
      color: 'bg-green-500 text-white',
      urgent: false
    },
    { 
      id: 'video-call', 
      label: t("quick.videoConsultation"), 
      icon: <Video className="w-4 h-4" />, 
      color: 'bg-purple-500 text-white',
      urgent: false
    },
    { 
      id: 'emergency', 
      label: t("quick.emergencyHelp"), 
      icon: <Phone className="w-4 h-4" />, 
      color: 'bg-red-500 text-white animate-pulse',
      urgent: true
    },
  ];

  const doctorActions = [
    { 
      id: 'schedule', 
      label: t("quick.schedulePatient"), 
      icon: <Calendar className="w-4 h-4" />, 
      color: 'bg-primary text-primary-foreground',
      urgent: false
    },
    { 
      id: 'add-patient', 
      label: t("quick.addPatient"), 
      icon: <Users className="w-4 h-4" />, 
      color: 'bg-accent text-accent-foreground',
      urgent: false
    },
    { 
      id: 'message', 
      label: t("quick.sendMessage"), 
      icon: <MessageSquare className="w-4 h-4" />, 
      color: 'bg-blue-500 text-white',
      urgent: false
    },
    { 
      id: 'records', 
      label: t("quick.patientRecords"), 
      icon: <FileText className="w-4 h-4" />, 
      color: 'bg-green-500 text-white',
      urgent: false
    },
    { 
      id: 'emergency', 
      label: t("quick.emergencyAlert"), 
      icon: <Bell className="w-4 h-4" />, 
      color: 'bg-red-500 text-white animate-pulse',
      urgent: true
    },
  ];

  const actions = role === 'patient' ? patientActions : doctorActions;
  const urgentActions = actions.filter(action => action.urgent);
  const regularActions = actions.filter(action => !action.urgent);

  if (variant === 'floating') {
    return (
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <TooltipProvider>
          <div className="flex flex-col space-y-2">
            {/* Emergency Actions - Always Visible */}
            {urgentActions.map((action) => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className={`${action.color} shadow-lg hover:scale-105 transition-all duration-200`}
                    onClick={() => handleAction(action.id, action.label)}
                  >
                    {action.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{action.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}

            {/* Expandable Regular Actions */}
            {isExpanded && regularActions.map((action, index) => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className={`${action.color} shadow-lg hover:scale-105 transition-all duration-200 animate-slide-up`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => handleAction(action.id, action.label)}
                  >
                    {action.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{action.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}

            {/* Main Toggle Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-all duration-200"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <Plus className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-45' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{isExpanded ? t("quick.closeMenu") : t("quick.quickActions")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <Card className={`p-4 ${className}`}>
        <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center">
          <Zap className="w-4 h-4 mr-2" />
          {t("quick.quickActions")}
        </h4>
        <div className="space-y-2">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className="w-full justify-start text-left h-auto py-2"
              onClick={() => handleAction(action.id, action.label)}
            >
              <div className={`p-1.5 rounded-md mr-3 ${action.color}`}>
                {action.icon}
              </div>
              <span className="text-xs">{action.label}</span>
            </Button>
          ))}
        </div>
      </Card>
    );
  }

  // Embedded variant (default)
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {regularActions.slice(0, 3).map((action) => (
        <Button
          key={action.id}
          size="sm"
          className={`${action.color} flex items-center space-x-2 hover:scale-105 transition-all duration-200`}
          onClick={() => handleAction(action.id, action.label)}
        >
          {action.icon}
          <span className="hidden sm:inline">{action.label}</span>
        </Button>
      ))}
      
      {(regularActions.length > 3 || urgentActions.length > 0) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{t("quick.moreActions")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {regularActions.slice(3).map((action) => (
              <DropdownMenuItem
                key={action.id}
                onClick={() => handleAction(action.id, action.label)}
                className="flex items-center space-x-2"
              >
                {action.icon}
                <span>{action.label}</span>
              </DropdownMenuItem>
            ))}
            
            {urgentActions.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-red-600">{t("quick.emergency")}</DropdownMenuLabel>
                {urgentActions.map((action) => (
                  <DropdownMenuItem
                    key={action.id}
                    onClick={() => handleAction(action.id, action.label)}
                    className="flex items-center space-x-2 text-red-600 focus:text-red-600"
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default QuickActions;