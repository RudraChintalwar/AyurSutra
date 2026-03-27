import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Calendar,
  Bell,
  BarChart3,
  Settings,
  Leaf,
  FileText,
  Activity,
  ShoppingBag,
  Stethoscope,
  Shield,
  HeartPulse
} from 'lucide-react';

export function PatientSidebar() {
  const { t } = useLanguage();
  const patientItems = [
    { title: t('sidebar.myDashboard'), url: '/patient-dashboard', icon: LayoutDashboard },
    { title: t('sidebar.mySessions'), url: '/patient/sessions', icon: Calendar },
    { title: t('sidebar.messages'), url: '/patient/messages', icon: Bell },
    { title: t('sidebar.dietPlanner'), url: '/diet-plan', icon: Activity },
    { title: t('sidebar.bpmChecker'), url: '/pulse-monitor', icon: HeartPulse },
    { title: t('sidebar.herbalRemedies'), url: '/remedies', icon: Leaf },
    { title: t('sidebar.reportAnalyzer'), url: '/report-analyzer', icon: Stethoscope },
    { title: t('sidebar.medicineVerifier'), url: '/medicine-verifier', icon: Shield },
    { title: t('sidebar.ayurvedicMart'), url: '/emart', icon: ShoppingBag },
    { title: t('sidebar.settings'), url: '/patient/settings', icon: Settings },
  ];

  const { state } = useSidebar();
  const navigate = useNavigate();
  const isCollapsed = state === 'collapsed';

  const handleLogoClick = () => {
    navigate('/');
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
      isActive 
        ? 'bg-primary text-white font-medium' 
        : '!text-black hover:bg-muted hover:!text-black'
    }`;

  return (
    <Sidebar className={isCollapsed ? 'w-14' : 'w-60'} collapsible="icon">
      <SidebarContent>
        {/* Logo Section */}
        <div className="p-4 border-b border-border">
          <button 
            onClick={handleLogoClick}
            className="flex items-center space-x-3 w-full hover:opacity-80 transition-opacity"
          >
            <div className="p-2 bg-primary rounded-lg">
              <Leaf className="w-5 h-5 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div className="text-left">
                <div className="font-playfair text-lg font-semibold text-primary">
                  {t('app.brand')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('app.patientPortal')}
                </div>
              </div>
            )}
          </button>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3">
            {!isCollapsed && t('sidebar.myCare')}
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {patientItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls} style={{ color: 'inherit' }}>
                      <item.icon className="w-5 h-5" style={{ color: 'inherit' }} />
                      {!isCollapsed && <span style={{ color: 'inherit' }}>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}