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
  Users,
  Calendar,
  Bell,
  BarChart3,
  Settings,
  Leaf
} from 'lucide-react';

const practitionerItems = [
  { title: 'Dashboard', url: '/doctor-dashboard', icon: LayoutDashboard },
  { title: 'Patients', url: '/doctor/patients', icon: Users },
  { title: 'Calendar', url: '/doctor/calendar', icon: Calendar },
  { title: 'Messages', url: '/doctor/messages', icon: Bell },
  { title: 'Analytics', url: '/doctor/analytics', icon: BarChart3 },
  { title: 'Settings', url: '/doctor/settings', icon: Settings },
];

export function PractitionerSidebar() {
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
                  Practitioner Portal
                </div>
              </div>
            )}
          </button>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3">
            {!isCollapsed && 'Main Menu'}
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {practitionerItems.map((item) => (
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