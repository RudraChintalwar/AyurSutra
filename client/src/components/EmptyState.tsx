import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Calendar, 
  Users, 
  MessageSquare, 
  FileText, 
  Search,
  Plus,
  Leaf
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  type: 'patients' | 'sessions' | 'messages' | 'records' | 'search' | 'general';
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  title,
  description,
  actionLabel,
  onAction,
  className
}) => {
  const getEmptyStateContent = () => {
    switch (type) {
      case 'patients':
        return {
          icon: <Users className="w-12 h-12 text-muted-foreground/60" />,
          title: title || 'No Patients Found',
          description: description || 'Start by registering your first patient to begin their Ayurvedic journey.',
          actionLabel: actionLabel || 'Register Patient',
          actionIcon: <Plus className="w-4 h-4" />
        };
      case 'sessions':
        return {
          icon: <Calendar className="w-12 h-12 text-muted-foreground/60" />,
          title: title || 'No Sessions Scheduled',
          description: description || 'Schedule your first therapy session to begin the healing process.',
          actionLabel: actionLabel || 'Schedule Session',
          actionIcon: <Calendar className="w-4 h-4" />
        };
      case 'messages':
        return {
          icon: <MessageSquare className="w-12 h-12 text-muted-foreground/60" />,
          title: title || 'No Messages',
          description: description || 'Your conversation history will appear here once you start messaging.',
          actionLabel: actionLabel || 'Start Conversation',
          actionIcon: <MessageSquare className="w-4 h-4" />
        };
      case 'records':
        return {
          icon: <FileText className="w-12 h-12 text-muted-foreground/60" />,
          title: title || 'No Records Found',
          description: description || 'Patient records and treatment history will be stored here.',
          actionLabel: actionLabel || 'Add Record',
          actionIcon: <Plus className="w-4 h-4" />
        };
      case 'search':
        return {
          icon: <Search className="w-12 h-12 text-muted-foreground/60" />,
          title: title || 'No Results Found',
          description: description || 'Try adjusting your search criteria or filters to find what you\'re looking for.',
          actionLabel: actionLabel || 'Clear Filters',
          actionIcon: null
        };
      default:
        return {
          icon: <Leaf className="w-12 h-12 text-muted-foreground/60" />,
          title: title || 'Nothing Here Yet',
          description: description || 'This section will populate as you use the application.',
          actionLabel: actionLabel,
          actionIcon: null
        };
    }
  };

  const content = getEmptyStateContent();

  return (
    <Card className={cn(
      'flex flex-col items-center justify-center p-12 text-center space-y-4 bg-gradient-to-br from-background to-muted/30',
      className
    )}>
      <div className="animate-bounce-in">
        {content.icon}
      </div>
      
      <div className="space-y-2">
        <h3 className="font-playfair text-xl font-semibold text-foreground">
          {content.title}
        </h3>
        <p className="text-muted-foreground max-w-md">
          {content.description}
        </p>
      </div>

      {onAction && content.actionLabel && (
        <Button 
          onClick={onAction}
          className="ayur-button-hero mt-4"
        >
          {content.actionIcon}
          {content.actionLabel}
        </Button>
      )}
    </Card>
  );
};

export default EmptyState;