import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Calendar,
  Clock,
  Search,
  Filter,
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Plus
} from 'lucide-react';
import { useDoctorData } from '@/hooks/useDoctorData';
import { useToast } from '@/hooks/use-toast';

interface FullScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FullScheduleModal: React.FC<FullScheduleModalProps> = ({ isOpen, onClose }) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const { sessions, patients } = useDoctorData();
  const { toast } = useToast();

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  const formatDate = (dateTime: string) => {
    return new Date(dateTime).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  };

  const getWeekDays = (date: Date) => {
    const days = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay() + 1); // Start from Monday
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getSessionsForDate = (date: Date) => {
    return sessions.filter((session: any) => {
      const sessionDate = new Date(session.datetime);
      return sessionDate.toDateString() === date.toDateString();
    });
  };

  const filteredSessions = sessions.filter((session: any) => {
    if (!searchTerm) return true;
    const patient = patients.find((p: any) => p.id === session.patient_id);
    return patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           session.therapy?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const weekDays = getWeekDays(currentWeek);
  const timeSlots = Array.from({ length: 10 }, (_, i) => `${9 + i}:00`);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeek);
    newDate.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newDate);
  };

  const handleSessionClick = (sessionId: string) => {
    toast({
      title: "Opening Session Details",
      description: "Loading detailed session information...",
    });
  };

  const handleNewSession = () => {
    toast({
      title: "Schedule New Session",
      description: "Opening appointment booking interface...",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calendar className="w-6 h-6 text-primary" />
              <span className="font-playfair">Full Schedule View</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('week')}
              >
                Week
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('month')}
              >
                Month
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[80vh]">
          {/* Controls */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-lg font-medium">
                  {currentWeek.toLocaleDateString('en-IN', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </div>
                <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search patients or therapies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <Button onClick={handleNewSession} className="ayur-button-hero" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Session
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto">
            {viewMode === 'week' ? (
              <div className="grid grid-cols-8 h-full">
                {/* Time column */}
                <div className="border-r bg-muted/20">
                  <div className="h-12 border-b flex items-center justify-center font-medium">
                    Time
                  </div>
                  {timeSlots.map((time) => (
                    <div key={time} className="h-16 border-b flex items-center justify-center text-sm text-muted-foreground">
                      {time}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day, dayIndex) => (
                  <div key={dayIndex} className="border-r">
                    <div className="h-12 border-b flex flex-col items-center justify-center bg-muted/10">
                      <div className="font-medium">
                        {day.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {day.getDate()}
                      </div>
                    </div>

                    {/* Time slots for this day */}
                    {timeSlots.map((time, timeIndex) => {
                      const sessionsInSlot = getSessionsForDate(day).filter(session => {
                        const sessionHour = new Date(session.datetime).getHours();
                        return sessionHour === 9 + timeIndex;
                      });

                      return (
                        <div key={time} className="h-16 border-b relative p-1">
                          {sessionsInSlot.map((session) => {
                            const patient = patients.find((p: any) => p.id === session.patient_id);
                            return (
                              <div
                                key={session.id}
                                onClick={() => handleSessionClick(session.id)}
                                className="absolute inset-1 bg-primary/10 border border-primary/20 rounded p-1 cursor-pointer hover:bg-primary/20 transition-colors"
                              >
                                <div className="text-xs font-medium truncate">
                                  {patient?.name}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {session.therapy}
                                </div>
                                <Badge 
                                  variant={session.status === 'completed' ? 'default' : 'outline'}
                                  className="text-xs mt-1"
                                >
                                  {session.status}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              /* Month view - List format */
              <div className="p-4 space-y-4">
                <div className="text-lg font-medium mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-primary" />
                  All Sessions ({filteredSessions.length})
                </div>
                {filteredSessions.map((session) => {
                  const patient = patients.find((p: any) => p.id === session.patient_id);
                  return (
                    <div
                      key={session.id}
                      className="p-4 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => handleSessionClick(session.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={patient?.avatar} alt={patient?.name} />
                            <AvatarFallback>
                              {patient?.name?.split(' ').map(n => n[0]).join('') || ''}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{patient?.name}</div>
                            <div className="text-sm text-muted-foreground">{session.therapy}</div>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDate(session.datetime)} • {formatDateTime(session.datetime)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <Badge 
                            variant={session.status === 'completed' ? 'default' : 'outline'}
                          >
                            {session.status}
                          </Badge>
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="sm">
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {filteredSessions.length} sessions
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FullScheduleModal;