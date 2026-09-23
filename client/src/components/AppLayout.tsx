import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ArrowLeftRight,
  Users,
  Shield,
  LogOut,
  ChevronUp,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const roleClass: Record<string, string> = {
  ADMIN: 'role-admin',
  BASE_COMMANDER: 'role-commander',
  LOGISTICS_OFFICER: 'role-logistics',
};

const roleLabel: Record<string, string> = {
  ADMIN: 'Admin',
  BASE_COMMANDER: 'Base Commander',
  LOGISTICS_OFFICER: 'Logistics Officer',
};

const SIDEBAR_KEY = 'mams_sidebar_collapsed';

function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);

  return isMobile;
}

export function AppLayout() {
  const { user, logout, canPurchaseOrTransfer, canAssignOrExpend } = useAuth();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Close mobile drawer when switching to desktop
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        if (isMobile) setMobileOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isMobile]);

  function toggleSidebar() {
    if (isMobile) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
      setMenuOpen(false);
    }
  }

  const sidebarExpanded = isMobile ? mobileOpen : !collapsed;
  const showLabels = !collapsed || isMobile;

  const initials =
    user?.name
      ?.split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  const shellClass = [
    'app-shell',
    !isMobile && collapsed ? 'sidebar-collapsed' : '',
    isMobile && mobileOpen ? 'sidebar-mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass}>
      <aside
        className={`sidebar ${mobileOpen ? 'open' : ''}`}
        aria-hidden={isMobile && !mobileOpen}
      >
        <div className="brand">
          <span className="brand-icon" aria-hidden>
            <Shield size={18} strokeWidth={2.2} />
          </span>
          {showLabels && (
            <div className="brand-text">
              <span className="brand-mark">MAMS</span>
              <span className="brand-title">Asset Command</span>
            </div>
          )}
        </div>

        <nav
          className="nav-links"
          onClick={() => {
            if (isMobile) setMobileOpen(false);
          }}
        >
          <NavLink to="/" end title="Dashboard">
            <LayoutDashboard size={18} />
            {showLabels && <span>Dashboard</span>}
          </NavLink>
          {canPurchaseOrTransfer && (
            <NavLink to="/purchases" title="Purchases">
              <ShoppingCart size={18} />
              {showLabels && <span>Purchases</span>}
            </NavLink>
          )}
          {canPurchaseOrTransfer && (
            <NavLink to="/transfers" title="Transfers">
              <ArrowLeftRight size={18} />
              {showLabels && <span>Transfers</span>}
            </NavLink>
          )}
          {canAssignOrExpend && (
            <NavLink to="/assignments" title="Assignments & Expenditures">
              <Users size={18} />
              {showLabels && <span>Assignments & Expenditures</span>}
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer" ref={menuRef}>
          {menuOpen && (
            <div className="user-dropdown" role="menu">
              <button
                type="button"
                className="user-dropdown-item danger"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className={`user-menu-trigger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={user?.name || 'Account menu'}
          >
            <span className="user-avatar" aria-hidden>
              {initials}
            </span>
            {showLabels && (
              <>
                <span className="user-meta">
                  <strong>{user?.name}</strong>
                  <span className={`badge ${roleClass[user?.role || '']}`}>
                    {roleLabel[user?.role || ''] || user?.role}
                  </span>
                  {user?.base && (
                    <span className="user-base">
                      <MapPin size={12} />
                      {user.base.name}
                    </span>
                  )}
                </span>
                <ChevronUp
                  size={16}
                  className={`user-chevron ${menuOpen ? 'open' : ''}`}
                />
              </>
            )}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="main-toolbar">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={
              isMobile
                ? mobileOpen
                  ? 'Close sidebar'
                  : 'Open sidebar'
                : collapsed
                  ? 'Expand sidebar'
                  : 'Collapse sidebar'
            }
            aria-expanded={sidebarExpanded}
            title={
              isMobile
                ? mobileOpen
                  ? 'Close sidebar'
                  : 'Open sidebar'
                : collapsed
                  ? 'Expand sidebar'
                  : 'Collapse sidebar'
            }
          >
            {isMobile ? (
              mobileOpen ? (
                <PanelLeftClose size={18} />
              ) : (
                <PanelLeftOpen size={18} />
              )
            ) : collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
            <span className="sidebar-toggle-label">
              {isMobile
                ? mobileOpen
                  ? 'Close'
                  : 'Menu'
                : collapsed
                  ? 'Expand'
                  : 'Collapse'}
            </span>
          </button>
        </div>
        <Outlet />
      </main>

      {isMobile && mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}
