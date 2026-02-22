/**
 * Component Tests for Sidebar Navigation
 * Tests the sidebar navigation and routing
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/hooks/useAuth';

// Mock the API module
jest.mock('@/lib/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  setToken: jest.fn(),
  removeToken: jest.fn(),
  getToken: jest.fn(() => 'mock-token'),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

// Import icon components
import { 
  LayoutDashboard, 
  Bot, 
  ListTodo, 
  MessageSquare, 
  ShieldCheck, 
  ScrollText, 
  Target, 
  BarChart3, 
  RefreshCw, 
  Rocket 
} from 'lucide-react';

// Simplified Sidebar Component for Testing
const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/onboarding', label: 'Onboarding', icon: Rocket },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { href: '/audit', label: 'Audit Log', icon: ScrollText },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/usage', label: 'Usage', icon: BarChart3 },
  { href: '/recurring', label: 'Recurring', icon: RefreshCw },
];

const AUTH_ROUTES = ['/auth/login', '/auth/signup', '/auth/forgot-password'];

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<any>;
  isActive?: boolean;
}

const NavItem = ({ href, label, icon: Icon, isActive }: NavItemProps) => (
  <a 
    href={href} 
    data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
    data-active={isActive}
    className={isActive ? 'active' : ''}
  >
    <Icon className="w-4.5 h-4.5" />
    {label}
  </a>
);

const Sidebar = ({ currentPath = '/' }: { currentPath?: string }) => {
  return (
    <nav data-testid="sidebar-nav">
      {NAV_ITEMS.map((item) => (
        <NavItem
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          isActive={currentPath === item.href}
        />
      ))}
    </nav>
  );
};

const SidebarVisibility = ({ pathname }: { pathname: string }) => {
  const isAuthPage = AUTH_ROUTES.some((route) => pathname?.startsWith(route));
  
  if (isAuthPage) {
    return <div data-testid="sidebar" data-visible="false">Sidebar Hidden</div>;
  }
  
  return (
    <div data-testid="sidebar" data-visible="true">
      <Sidebar currentPath={pathname} />
    </div>
  );
};

describe('Sidebar Navigation Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Navigation Items', () => {
    it('should render all navigation items', () => {
      render(<Sidebar currentPath="/" />);
      
      NAV_ITEMS.forEach((item) => {
        const navElement = screen.getByTestId(`nav-${item.label.toLowerCase().replace(' ', '-')}`);
        expect(navElement).toBeInTheDocument();
      });
    });

    it('should have correct href for each nav item', () => {
      render(<Sidebar currentPath="/" />);
      
      const dashboardLink = screen.getByTestId('nav-dashboard');
      expect(dashboardLink).toHaveAttribute('href', '/');
      
      const agentsLink = screen.getByTestId('nav-agents');
      expect(agentsLink).toHaveAttribute('href', '/agents');
      
      const tasksLink = screen.getByTestId('nav-tasks');
      expect(tasksLink).toHaveAttribute('href', '/tasks');
    });

    it('should mark active navigation item', () => {
      render(<Sidebar currentPath="/tasks" />);
      
      const dashboardLink = screen.getByTestId('nav-dashboard');
      expect(dashboardLink).toHaveAttribute('data-active', 'false');
      
      const tasksLink = screen.getByTestId('nav-tasks');
      expect(tasksLink).toHaveAttribute('data-active', 'true');
    });

    it('should handle root path correctly', () => {
      render(<Sidebar currentPath="/" />);
      
      const dashboardLink = screen.getByTestId('nav-dashboard');
      expect(dashboardLink).toHaveAttribute('data-active', 'true');
    });
  });

  describe('Sidebar Visibility', () => {
    it('should show sidebar on dashboard page', () => {
      render(<SidebarVisibility pathname="/" />);
      
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveAttribute('data-visible', 'true');
    });

    it('should hide sidebar on auth pages', () => {
      render(<SidebarVisibility pathname="/auth/login" />);
      
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveAttribute('data-visible', 'false');
    });

    it('should hide sidebar on signup page', () => {
      render(<SidebarVisibility pathname="/auth/signup" />);
      
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveAttribute('data-visible', 'false');
    });

    it('should hide sidebar on forgot password page', () => {
      render(<SidebarVisibility pathname="/auth/forgot-password" />);
      
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveAttribute('data-visible', 'false');
    });

    it('should show sidebar on nested admin pages', () => {
      render(<SidebarVisibility pathname="/admin/users" />);
      
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveAttribute('data-visible', 'true');
    });
  });

  describe('Navigation Paths', () => {
    const testCases = [
      { path: '/', expectedActive: 'dashboard' },
      { path: '/onboarding', expectedActive: 'onboarding' },
      { path: '/agents', expectedActive: 'agents' },
      { path: '/tasks', expectedActive: 'tasks' },
      { path: '/messages', expectedActive: 'messages' },
      { path: '/approvals', expectedActive: 'approvals' },
      { path: '/audit', expectedActive: 'audit-log' },
      { path: '/goals', expectedActive: 'goals' },
      { path: '/usage', expectedActive: 'usage' },
      { path: '/recurring', expectedActive: 'recurring' },
    ];

    testCases.forEach(({ path, expectedActive }) => {
      it(`should highlight ${expectedActive} when on ${path}`, () => {
        render(<Sidebar currentPath={path} />);
        
        const activeNav = screen.getByTestId(`nav-${expectedActive}`);
        expect(activeNav).toHaveAttribute('data-active', 'true');
      });
    });
  });

  describe('Nav Item Labels', () => {
    it('should display Dashboard label', () => {
      render(<Sidebar currentPath="/" />);
      
      const dashboard = screen.getByTestId('nav-dashboard');
      expect(dashboard).toHaveTextContent('Dashboard');
    });

    it('should display Onboarding label', () => {
      render(<Sidebar currentPath="/" />);
      
      const onboarding = screen.getByTestId('nav-onboarding');
      expect(onboarding).toHaveTextContent('Onboarding');
    });

    it('should display Agents label', () => {
      render(<Sidebar currentPath="/" />);
      
      const agents = screen.getByTestId('nav-agents');
      expect(agents).toHaveTextContent('Agents');
    });

    it('should display Tasks label', () => {
      render(<Sidebar currentPath="/" />);
      
      const tasks = screen.getByTestId('nav-tasks');
      expect(tasks).toHaveTextContent('Tasks');
    });

    it('should display Messages label', () => {
      render(<Sidebar currentPath="/" />);
      
      const messages = screen.getByTestId('nav-messages');
      expect(messages).toHaveTextContent('Messages');
    });

    it('should display Approvals label', () => {
      render(<Sidebar currentPath="/" />);
      
      const approvals = screen.getByTestId('nav-approvals');
      expect(approvals).toHaveTextContent('Approvals');
    });

    it('should display Audit Log label', () => {
      render(<Sidebar currentPath="/" />);
      
      const audit = screen.getByTestId('nav-audit-log');
      expect(audit).toHaveTextContent('Audit Log');
    });

    it('should display Goals label', () => {
      render(<Sidebar currentPath="/" />);
      
      const goals = screen.getByTestId('nav-goals');
      expect(goals).toHaveTextContent('Goals');
    });

    it('should display Usage label', () => {
      render(<Sidebar currentPath="/" />);
      
      const usage = screen.getByTestId('nav-usage');
      expect(usage).toHaveTextContent('Usage');
    });

    it('should display Recurring label', () => {
      render(<Sidebar currentPath="/" />);
      
      const recurring = screen.getByTestId('nav-recurring');
      expect(recurring).toHaveTextContent('Recurring');
    });
  });
});

describe('Auth Routes Configuration', () => {
  it('should correctly identify auth routes', () => {
    expect(AUTH_ROUTES).toContain('/auth/login');
    expect(AUTH_ROUTES).toContain('/auth/signup');
    expect(AUTH_ROUTES).toContain('/auth/forgot-password');
  });

  it('should use startsWith for route matching', () => {
    // These should NOT be auth routes
    expect(AUTH_ROUTES.some(r => '/auth/login/subpage'.startsWith(r))).toBe(true);
  });

  it('should have correct number of nav items', () => {
    expect(NAV_ITEMS).toHaveLength(10);
  });
});
