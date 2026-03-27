import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Bell,
  Calendar,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Settings,
  X,
  MoreVertical,
  Archive
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  channel: string;
  datetime: string;
  read: boolean;
  sender?: string;
}

interface NotificationCenterProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  trigger,
  open,
  onOpenChange
}) => {
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { language } = useLanguage();
  const tx = (en: string, hi: string) => (language === 'hi' ? hi : en);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.uid) return;
      try {
        const sessionsQuery = role === 'doctor'
          ? query(collection(db, 'sessions'), where('practitioner_id', '==', user.uid))
          : query(collection(db, 'sessions'), where('patient_id', '==', user.uid));
        const snap = await getDocs(sessionsQuery);
        const generated: NotificationItem[] = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: language === 'hi'
              ? `सत्र ${data.status === 'scheduled' ? 'आगामी' : 'पूर्ण'}: ${data.therapy || 'पंचकर्म'}`
              : `Session ${data.status === 'scheduled' ? 'Upcoming' : 'Completed'}: ${data.therapy || 'Panchakarma'}`,
            body: language === 'hi'
              ? `${data.therapy || 'थेरेपी'} सत्र — ${data.duration_minutes || 60} मिनट।`
              : `${data.therapy || 'Therapy'} session — ${data.duration_minutes || 60} minutes.`,
            channel: 'in-app',
            datetime: data.datetime || new Date().toISOString(),
            read: data.status === 'completed',
            sender: 'system'
          };
        });
        const directQ = query(collection(db, 'notifications'), where('user_id', '==', user.uid));
        const directSnap = await getDocs(directQ);
        const directNotifications: NotificationItem[] = directSnap.docs.map((doc) => {
          const data: any = doc.data() || {};
          return {
            id: `direct-${doc.id}`,
            title: data.title || tx('Notification', 'सूचना'),
            body: data.body || '',
            channel: data.channel || 'in-app',
            datetime: data.datetime || new Date().toISOString(),
            read: Boolean(data.read),
            sender: data.sender || 'system',
          };
        });
        generated.unshift({
          id: 'welcome',
          title: tx('Welcome to AyurSutra', 'AyurSutra में आपका स्वागत है'),
          body: tx('Your Ayurvedic wellness journey starts here!', 'आपकी आयुर्वेदिक वेलनेस यात्रा यहीं से शुरू होती है!'),
          channel: 'in-app',
          datetime: new Date().toISOString(),
          read: false,
          sender: 'system'
        });
        setNotifications([...directNotifications, ...generated].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()));
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };
    fetchNotifications();
  }, [user, role]);

  const getNotificationIcon = (type: string, sender?: string) => {
    switch (sender) {
      case 'system':
        return <Settings className="w-4 h-4 text-blue-600" />;
      case 'doctor':
        return <User className="w-4 h-4 text-green-600" />;
      case 'llm':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getNotificationBg = (sender?: string, read?: boolean) => {
    const baseClasses = 'p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md';
    const readClasses = read ? 'bg-background border-border' : 'bg-primary/5 border-primary/20';
    
    switch (sender) {
      case 'system':
        return cn(baseClasses, readClasses, 'hover:bg-blue-50');
      case 'doctor':
        return cn(baseClasses, readClasses, 'hover:bg-green-50');
      case 'llm':
        return cn(baseClasses, readClasses, 'hover:bg-yellow-50');
      default:
        return cn(baseClasses, readClasses, 'hover:bg-muted/50');
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    );
    toast({
      title: tx("Notification marked as read", "नोटिफिकेशन पढ़ा हुआ चिह्नित किया गया"),
      duration: 2000
    });
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast({
      title: tx("Notification deleted", "नोटिफिकेशन हटाया गया"),
      duration: 2000
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast({
      title: tx("All notifications marked as read", "सभी नोटिफिकेशन पढ़े हुए चिह्नित किए गए"),
      duration: 2000
    });
  };

  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !notification.read;
    if (activeTab === 'system') return notification.sender === 'system';
    if (activeTab === 'messages') return notification.sender === 'doctor';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTime = (datetime: string) => {
    const now = new Date();
    const notificationDate = new Date(datetime);
    const diffInHours = Math.floor((now.getTime() - notificationDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return tx('Just now', 'अभी अभी');
    if (diffInHours < 24) return language === 'hi' ? `${diffInHours} घंटे पहले` : `${diffInHours}h ago`;
    return notificationDate.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-red-500 text-white animate-pulse">
                {unreadCount}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="w-5 h-5" />
              <span>{tx('Notifications', 'नोटिफिकेशन')}</span>
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white">
                  {unreadCount}
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                {tx('Mark all read', 'सभी पढ़े चिह्नित करें')}
              </Button>
            )}
          </SheetTitle>
          <SheetDescription>
            {tx('Stay updated with your latest notifications', 'अपने नवीनतम नोटिफिकेशन से अपडेट रहें')}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="text-xs">{tx('All', 'सभी')}</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              {tx('Unread', 'अपठित')}
              {unreadCount > 0 && (
                <Badge className="ml-1 w-4 h-4 p-0 text-xs bg-red-500 text-white">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs">{tx('System', 'सिस्टम')}</TabsTrigger>
            <TabsTrigger value="messages" className="text-xs">{tx('Messages', 'संदेश')}</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100vh-200px)] mt-4">
            <div className="space-y-3">
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    className={getNotificationBg(notification.sender, notification.read)}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="p-1.5 bg-muted rounded-full">
                          {getNotificationIcon(notification.channel, notification.sender)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm text-foreground leading-tight">
                              {notification.title}
                            </h4>
                            <div className="flex items-center space-x-1 ml-2">
                              {!notification.read && (
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {notification.body}
                          </p>
                          
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(notification.datetime)}</span>
                              {notification.sender && (
                                <>
                                  <span>•</span>
                                  <span className="capitalize">{notification.sender}</span>
                                </>
                              )}
                            </div>
                            
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="h-6 px-2 text-xs text-primary hover:text-primary-foreground hover:bg-primary"
                              >
                                {tx('Mark read', 'पढ़ा चिह्नित करें')}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    {activeTab === 'unread' 
                      ? tx('No unread notifications', 'कोई अपठित नोटिफिकेशन नहीं')
                      : tx('No notifications found', 'कोई नोटिफिकेशन नहीं मिला')
                    }
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationCenter;