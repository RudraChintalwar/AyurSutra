import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  Stethoscope
} from 'lucide-react';

const patientItems = [
  { title: 'My Dashboard', url: '/patient-dashboard', icon: LayoutDashboard },
  { title: 'My Sessions', url: '/patient/sessions', icon: Calendar },
  { title: 'Diet Planner', url: '/diet-plan', icon: Activity },
  { title: 'Herbal Remedies', url: '/remedies', icon: Leaf },
  { title: 'Report Analyzer', url: '/report-analyzer', icon: Stethoscope },
  { title: 'Ayurvedic Mart', url: '/emart', icon: ShoppingBag },
  { title: 'Settings', url: '/patient/settings', icon: Settings },
];

export function PatientSidebar() {
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
                  Panchakarma
                </div>
                <div className="text-xs text-muted-foreground">
                  Patient Portal
                </div>
              </div>
            )}
          </button>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3">
            {!isCollapsed && 'My Care'}
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