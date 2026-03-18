import React, { useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { PractitionerSidebar } from './PractitionerSidebar';
import { PatientSidebar } from './PatientSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  LogOut, 
  Bell, 
  Settings, 
  Search,
  Moon,
  Sun,
  Leaf
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { role, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [notificationCount, setNotificationCount] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Page transition loading
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleLogout = () => {
    toast({
      title: "Logging out...",
      description: "See you again soon!",
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
      title: darkMode ? "Light mode activated" : "Dark mode activated",
      description: "Theme preference saved",
    });
  };

  const getPageTitle = () => {
    const path = location.pathname;
    const titles: Record<string, string> = {
      '/patient-dashboard': 'Your Health Journey',
      '/patient/sessions': 'Treatment Sessions', 
      '/patient/messages': 'Messages',
      '/patient/progress': 'Health Progress',
      '/patient/records': 'Medical Records',
      '/patient/settings': 'Account Settings',
      '/doctor-dashboard': 'Practice Overview',
      '/doctor/patients': 'Patient Management',
      '/doctor/calendar': 'Schedule & Calendar',
      '/doctor/messages': 'Patient Communications',
      '/doctor/analytics': 'Practice Analytics',
      '/doctor/settings': 'Practice Settings'
    };
    
    return titles[path] || 'Dashboard';
  };

  const SidebarComponent = role === 'patient' ? PatientSidebar : PractitionerSidebar;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner variant="ayurvedic" size="lg" text="Loading your dashboard..." />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SidebarComponent />
        
        <div className="flex-1 flex flex-col">
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
                        <span>Settings</span>
                      </button>
                      <hr className="border-border" />
                      <button 
                        className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 hover:text-red-700 rounded-md transition-colors flex items-center space-x-2"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
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
                <button className="hover:text-primary transition-colors">Privacy</button>
                <button className="hover:text-primary transition-colors">Terms</button>
                <button className="hover:text-primary transition-colors">Support</button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;