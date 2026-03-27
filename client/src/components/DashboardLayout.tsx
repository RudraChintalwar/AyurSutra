import React, { useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { PractitionerSidebar } from './PractitionerSidebar';
import { PatientSidebar } from './PatientSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
  LogOut, 
  Bell, 
  Settings, 
  Search,
  Moon,
  Sun,
  Leaf,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import LanguageSelector from '@/components/common/LanguageSelector';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { role, user, logout, linkGoogleCalendar, refreshProfile } = useAuth() as any;
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [notificationCount, setNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Fetch dynamic notification count from Firestore
  useEffect(() => {
    const fetchNotificationCount = async () => {
      if (!user?.uid) return;
      try {
        const sessionsQuery = role === 'doctor'
          ? query(collection(db, 'sessions'))
          : query(collection(db, 'sessions'), where('patient_id', '==', user.uid));
        const snap = await getDocs(sessionsQuery);
        const important = snap.docs.filter((d) => {
          const st = (d.data() as any)?.status;
          return ['pending_review', 'confirmed', 'scheduled', 'reschedule_requested'].includes(st);
        });
        setNotificationCount(important.length);
      } catch (err) {
        console.error('Error fetching notification count:', err);
      }
    };
    fetchNotificationCount();
  }, [user, role]);

  // Page transition loading
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    const linked = searchParams.get('calendar_linked');
    const calErr = searchParams.get('calendar_error');
    if (linked === '1') {
      toast({
        title: t('layout.calendar.connected'),
        description: t('layout.calendar.connectedDesc'),
      });
      refreshProfile?.();
      const next = new URLSearchParams(searchParams);
      next.delete('calendar_linked');
      setSearchParams(next, { replace: true });
    }
    if (calErr) {
      toast({
        title: t('layout.calendar.failed'),
        description: decodeURIComponent(calErr),
        variant: 'destructive',
      });
      const next = new URLSearchParams(searchParams);
      next.delete('calendar_error');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, refreshProfile, t]);

  const handleLogout = () => {
    toast({
      title: t("layout.logout.title"),
      description: t("layout.logout.desc"),
    });
    setTimeout(() => {
      logout();
      navigate('/');
    }, 1000);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
    toast({
      title: darkMode ? t("layout.theme.light") : t("layout.theme.dark"),
      description: t("layout.theme.saved"),
    });
  };

  const getPageTitle = () => {
    const path = location.pathname;
    const titles: Record<string, string> = {
      '/patient-dashboard': t('page.patientDashboard'),
      '/patient/sessions': t('page.patientSessions'), 
      '/patient/messages': t('page.patientMessages'),
      '/patient/progress': t('page.patientProgress'),
      '/patient/records': t('page.patientRecords'),
      '/patient/settings': t('page.patientSettings'),
      '/pulse-monitor': t('page.pulseMonitor'),
      '/doctor-dashboard': t('page.doctorDashboard'),
      '/doctor/patients': t('page.doctorPatients'),
      '/doctor/calendar': t('page.doctorCalendar'),
      '/doctor/messages': t('page.doctorMessages'),
      '/doctor/analytics': t('page.doctorAnalytics'),
      '/doctor/settings': t('page.doctorSettings')
    };
    
    return titles[path] || t('page.default');
  };

  const SidebarComponent = role === 'patient' ? PatientSidebar : PractitionerSidebar;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner variant="ayurvedic" size="lg" text={t("layout.loading")} />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SidebarComponent />
        
        <div className="flex-1 flex flex-col">
          {user && user.calendarSyncConnected !== true && (
            <div className="bg-amber-50/95 border-b border-amber-200 px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-amber-950">
              <div className="flex items-start gap-2">
                <CalendarIcon className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  <span className="font-medium">{t("layout.calendar.linkTitle")}</span> — {t("layout.calendar.linkDesc")}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 bg-white shrink-0"
                onClick={() => linkGoogleCalendar().catch((e: Error) => toast({ variant: 'destructive', title: t('layout.calendar.failed'), description: e.message }))}
              >
                {t("layout.calendar.connect")}
              </Button>
            </div>
          )}
          {/* Enhanced Top Header */}
          <header className="h-16 border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-40 flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <SidebarTrigger />
              
              {/* Logo and Title */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-primary rounded-lg">
                    <Leaf className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span className="font-playfair text-lg font-semibold text-primary hidden sm:block">
                    Panchakarma
                  </span>
                </div>
                <div className="hidden sm:block text-muted-foreground">•</div>
                <h1 className="font-medium text-foreground">{getPageTitle()}</h1>
              </div>
            </div>
            
            {/* Header Actions */}
            <div className="flex items-center space-x-3">
              {/* Search */}
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                <Search className="w-4 h-4" />
              </Button>
              <LanguageSelector />

              {/* Dark Mode Toggle */}
              <Button variant="ghost" size="sm" onClick={toggleDarkMode}>
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>

              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative"
                onClick={() => {
                  setNotificationCount(0);
                  toast({
                    title: "Notifications",
                    description: "No new notifications",
                  });
                }}
              >
                <Bell className="w-4 h-4" />
                {notificationCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-red-500 text-white animate-pulse">
                    {notificationCount}
                  </Badge>
                )}
              </Button>

              {/* User Menu */}
              <div className="flex items-center space-x-3 pl-3 border-l border-border">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{role === 'doctor' ? 'Doctor' : 'Patient'}</p>
                </div>
                
                <div className="relative group">
                  <Avatar className="w-8 h-8 cursor-pointer ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Dropdown Menu */}
                  <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="p-2 space-y-1">
                      <button 
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors flex items-center space-x-2"
                        onClick={() => navigate(`/${role}/settings`)}
                      >
                        <Settings className="w-4 h-4" />
                        <span>{t("layout.settings")}</span>
                      </button>
                      <hr className="border-border" />
                      <button 
                        className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 hover:text-red-700 rounded-md transition-colors flex items-center space-x-2"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{t("layout.signOut")}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content with Loading */}
          <main className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner variant="ayurvedic" size="lg" />
              </div>
            ) : (
              <div className="animate-fade-in">
                {children}
              </div>
            )}
          </main>

          {/* Professional Footer */}
          <footer className="border-t border-border px-6 py-4 bg-card">
            <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
              <p className="text-xs text-muted-foreground">
                © 2025 Panchakarma Management. Bringing ancient wisdom to modern healthcare.
              </p>
              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                <button className="hover:text-primary transition-colors">{t("layout.privacy")}</button>
                <button className="hover:text-primary transition-colors">{t("layout.terms")}</button>
                <button className="hover:text-primary transition-colors">{t("layout.support")}</button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;