import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  Activity,
  LayoutDashboard,
  Send,
  Settings,
  Users,
  LogOut,
  Bell,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';
import SettingsModal from './SettingsModal';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/send', icon: Send, label: 'Send Message' },
    ...(isAdmin ? [{ path: '/users', icon: Users, label: 'Users' }] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const NavItem = ({ item }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {(sidebarExpanded || mobileMenuOpen) && (
          <span className="text-sm font-medium">{item.label}</span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-slate-900">MsgRouter</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              data-testid="mobile-settings-btn"
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-slate-200 z-50 transition-all duration-200 ${
          mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${sidebarExpanded ? 'lg:w-64' : 'lg:w-16'}`}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-slate-200 ${sidebarExpanded ? 'px-4 justify-between' : 'justify-center'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Activity className="w-6 h-6 text-white" />
            </div>
            {sidebarExpanded && (
              <span className="font-bold text-lg text-slate-900">MsgRouter</span>
            )}
          </div>
          {sidebarExpanded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarExpanded(false)}
              className="hidden lg:flex"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}

          {/* Settings button (Admin only) */}
          {isAdmin && (
            <button
              onClick={() => {
                setSettingsOpen(true);
                setMobileMenuOpen(false);
              }}
              data-testid="settings-btn"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors`}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              {(sidebarExpanded || mobileMenuOpen) && (
                <span className="text-sm font-medium">Settings</span>
              )}
            </button>
          )}
        </nav>

        {/* Expand button (desktop only) */}
        {!sidebarExpanded && (
          <div className="hidden lg:block absolute bottom-20 left-0 right-0 px-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarExpanded(true)}
              className="w-full"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* User section */}
        <div className={`absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 ${sidebarExpanded || mobileMenuOpen ? '' : 'flex justify-center'}`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={`${sidebarExpanded || mobileMenuOpen ? 'w-full justify-start gap-3' : 'p-0'}`}
                data-testid="user-menu-btn"
              >
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                {(sidebarExpanded || mobileMenuOpen) && (
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-900 truncate max-w-[140px]">
                      {user?.email}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.email}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.role} Account</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="logout-btn">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className={`pt-16 lg:pt-0 transition-all duration-200 ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16'}`}>
        {/* Top bar (desktop) */}
        <header className="hidden lg:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-8">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {navItems.find((item) => item.path === location.pathname)?.label || 'Dashboard'}
            </h1>
            <p className="text-sm text-slate-500">
              {location.pathname === '/' && 'System overview and key metrics'}
              {location.pathname === '/send' && 'Send HL7 messages to configured endpoints'}
              {location.pathname === '/users' && 'Manage platform users and roles'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5 text-slate-500" />
            </Button>
            <Button variant="ghost" size="icon">
              <HelpCircle className="w-5 h-5 text-slate-500" />
            </Button>
            {isAdmin && (
              <Button
                onClick={() => setSettingsOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="header-settings-btn"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 lg:p-8">{children}</div>
      </main>

      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
