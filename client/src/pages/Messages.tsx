import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell,
  MessageSquare,
  Calendar,
  Phone,
  Mail,
  Clock,
  Bot,
  UserCheck,
  Settings
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

interface Notification {
  id: string;
  title: string;
  body: string;
  channel: string;
  datetime: string;
  read: boolean;
  patient_id: string;
  sender?: string;
}

const Messages = () => {
  const { user, role } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.uid) return;
      try {
        // Build notifications from sessions
        const sessionsQuery = role === 'doctor'
          ? query(collection(db, 'sessions'))
          : query(collection(db, 'sessions'), where('patient_id', '==', user.uid));
        const snap = await getDocs(sessionsQuery);
        const generatedNotifications: Notification[] = snap.docs.map((doc, i) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: `Session ${data.status === 'scheduled' ? 'Scheduled' : 'Completed'}: ${data.therapy || 'Panchakarma'}`,
            body: `Your ${data.therapy || 'therapy'} session is ${data.status}. Duration: ${data.duration_minutes || 60} minutes.`,
            channel: 'in-app',
            datetime: data.datetime || new Date().toISOString(),
            read: data.status === 'completed',
            patient_id: data.patient_id || '',
            sender: 'system'
          };
        });
        // Add a welcome notification
        generatedNotifications.unshift({
          id: 'welcome',
          title: 'Welcome to AyurSutra',
          body: 'Your account has been set up. Explore your dashboard to get started with your Ayurvedic wellness journey!',
          channel: 'in-app',
          datetime: new Date().toISOString(),
          read: false,
          patient_id: user.uid,
          sender: 'system'
        });
        setNotifications(generatedNotifications);
        if (generatedNotifications.length > 0) setSelectedNotification(generatedNotifications[0]);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };
    fetchNotifications();
  }, [user, role]);

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'in-app': return <Bell className="w-4 h-4" />;
      case 'sms': return <Phone className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getSenderIcon = (sender?: string) => {
    switch (sender) {
      case 'doctor': return <UserCheck className="w-4 h-4 text-blue-500" />;
      case 'llm': return <Bot className="w-4 h-4 text-purple-500" />;
      case 'system': return <Settings className="w-4 h-4 text-gray-500" />;
      default: return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSenderLabel = (sender?: string) => {
    switch (sender) {
      case 'doctor': return 'Doctor';
      case 'llm': return 'AI Assistant';
      case 'system': return 'System';
      default: return 'Notification';
    }
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  const getPatientName = (patientId: string) => {
    return patientId?.slice(0, 8) || 'Unknown Patient';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-playfair text-3xl font-bold text-primary mb-2">
          {role === 'patient' ? 'My Messages' : 'Patient Notifications'}
        </h1>
        <p className="text-muted-foreground">
          {role === 'patient' 
            ? 'Stay updated with your treatment plan and appointments' 
            : 'Monitor all patient communications and automated notifications'
          }
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notifications List */}
        <div className="lg:col-span-1">
          <Card className="ayur-card p-4 h-fit">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-playfair text-lg font-semibold">Notifications</h3>
              <Badge variant="secondary">
                {notifications.filter(n => !n.read).length} unread
              </Badge>
            </div>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid grid-cols-3 w-full mb-4">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="unread" className="text-xs">Unread</TabsTrigger>
                <TabsTrigger value="important" className="text-xs">High Priority</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-2">
                {notifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all animate-slide-up hover:scale-[1.01] ${
                      selectedNotification?.id === notification.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-muted/30 hover:bg-muted/50'
                    } ${!notification.read ? 'border-l-4 border-l-accent' : ''}`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => setSelectedNotification(notification)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getChannelIcon(notification.channel)}
                        {role === 'doctor' && (
                          <div className="flex items-center space-x-1">
                            {getSenderIcon(notification.sender)}
                            <span className="text-xs text-muted-foreground">
                              {getSenderLabel(notification.sender)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDateTime(notification.datetime)}
                      </div>
                    </div>

                    <h4 className={`font-medium text-sm mb-1 ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {notification.title}
                    </h4>

                    {role === 'doctor' && (
                      <div className="text-xs text-muted-foreground mb-2">
                        Patient: {getPatientName(notification.patient_id)}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.body}
                    </p>

                    {!notification.read && (
                      <div className="flex items-center justify-end mt-2">
                        <Badge variant="secondary" className="text-xs">
                          New
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="unread" className="space-y-2">
                {notifications.filter(n => !n.read).map((notification, index) => (
                  <div
                    key={notification.id}
                    className="p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => setSelectedNotification(notification)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getChannelIcon(notification.channel)}
                        {role === 'doctor' && getSenderIcon(notification.sender)}
                      </div>
                      <Badge variant="secondary" className="text-xs">New</Badge>
                    </div>
                    <h4 className="font-medium text-sm">{notification.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{notification.body}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="important" className="space-y-2">
                <div className="text-center text-muted-foreground py-8">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No high priority notifications</p>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Notification Detail */}
        <div className="lg:col-span-2">
          <Card className="ayur-card p-6 h-fit">
            {selectedNotification ? (
              <div className="animate-scale-in">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    {getChannelIcon(selectedNotification.channel)}
                    <div>
                      <h3 className="font-playfair text-xl font-semibold">
                        {selectedNotification.title}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                        <span>
                          {formatDateTime(selectedNotification.datetime)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {selectedNotification.channel.toUpperCase()}
                        </Badge>
                        {role === 'doctor' && (
                          <div className="flex items-center space-x-1">
                            {getSenderIcon(selectedNotification.sender)}
                            <span>{getSenderLabel(selectedNotification.sender)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {!selectedNotification.read && (
                    <Badge className="animate-pulse-gentle">Unread</Badge>
                  )}
                </div>

                {role === 'doctor' && (
                  <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage 
                          src={undefined} 
                          alt="Patient" 
                        />
                        <AvatarFallback>P</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">
                          {getPatientName(selectedNotification.patient_id)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Patient ID: {selectedNotification.patient_id}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="prose prose-sm max-w-none mb-6">
                  <p className="text-foreground leading-relaxed">
                    {selectedNotification.body}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 pt-4 border-t">
                  {selectedNotification.channel === 'sms' && (
                    <Button variant="outline" size="sm">
                      <Phone className="w-4 h-4 mr-2" />
                      Preview SMS
                    </Button>
                  )}
                  {selectedNotification.channel === 'email' && (
                    <Button variant="outline" size="sm">
                      <Mail className="w-4 h-4 mr-2" />
                      Preview Email
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <Calendar className="w-4 h-4 mr-2" />
                    View Related Session
                  </Button>
                  {!selectedNotification.read && (
                    <Button size="sm" className="ayur-button-accent">
                      Mark as Read
                    </Button>
                  )}
                </div>

                {/* SMS/Email Preview Modal Simulation */}
                {selectedNotification.channel !== 'in-app' && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2 flex items-center">
                      {selectedNotification.channel === 'sms' ? (
                        <>
                          <Phone className="w-4 h-4 mr-2" />
                          SMS Preview
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          Email Preview
                        </>
                      )}
                    </h4>
                    <div className="text-sm bg-white p-3 rounded border font-mono">
                      <div className="text-xs text-muted-foreground mb-1">
                        {selectedNotification.channel === 'sms' ? 'SMS to' : 'Email to'}: +91-9876543210
                      </div>
                      <div className="font-medium">{selectedNotification.title}</div>
                      <div className="mt-1">{selectedNotification.body}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Sent via Panchakarma Management System
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a notification to view details</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Messages;