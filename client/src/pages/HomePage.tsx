import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeftRight,
  LayoutDashboard,
  ScrollText,
  Shield,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CAPABILITIES = [
  {
    code: '01',
    title: 'Purchases',
    detail: 'Record inbound acquisitions by base, asset type, and quantity with full ledger context.',
    icon: ShoppingCart,
  },
  {
    code: '02',
    title: 'Transfers',
    detail: 'Move inventory between bases with clear origin, destination, and status tracking.',
    icon: ArrowLeftRight,
  },
  {
    code: '03',
    title: 'Assignments & Expenditures',
    detail: 'Assign assets to personnel and log expenditures with accountable quantity records.',
    icon: Users,
  },
  {
    code: '04',
    title: 'Dashboard',
    detail: 'Net movement, opening and closing balances, and filtered metrics across the force.',
    icon: LayoutDashboard,
  },
  {
    code: '05',
    title: 'Audit trail',
    detail: 'Role-scoped history so every purchase, transfer, and assignment stays reviewable.',
    icon: ScrollText,
  },
] as const;

const ROLES = [
  {
    title: 'Admin',
    code: 'ADM',
    summary: 'Cross-base visibility, full purchase and transfer authority, assignments, and system-wide oversight.',
  },
  {
    title: 'Base Commander',
    code: 'CDR',
    summary: 'Base-scoped command of purchases, transfers, assignments, and expenditures for their installation.',
  },
  {
    title: 'Logistics Officer',
    code: 'LOG',
    summary: 'Execute purchases and transfers within assigned base limits; no assignment or expenditure authority.',
  },
] as const;

const STACK = ['React', 'Express', 'Prisma', 'Supabase Postgres'] as const;

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

export function HomePage() {
  const { user } = useAuth();
  const [navSolid, setNavSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const caps = useReveal<HTMLElement>();
  const roles = useReveal<HTMLElement>();

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const primaryHref = user ? '/app' : '/login';
  const primaryLabel = user ? 'Open console' : 'Enter system';

  return (
    <div className="home">
      <div className="home-scanline" aria-hidden />

      <header className={`home-nav ${navSolid ? 'is-solid' : ''}`}>
        <a className="home-nav-brand" href="#top">
          <span className="home-nav-icon" aria-hidden>
            <Shield size={18} strokeWidth={2.2} />
          </span>
          <span className="home-nav-brand-text">
            <span className="home-nav-mark">MAMS</span>
            <span className="home-nav-sub">Asset Command</span>
          </span>
        </a>

        <nav className="home-nav-links" aria-label="Primary">
          <a href="#capabilities">Capabilities</a>
          <a href="#stack">Stack</a>
          <a href="#access">Access</a>
        </nav>

        <div className="home-nav-actions">
          {!user && (
            <Link className="home-btn home-btn-ghost" to="/register">
              Register
            </Link>
          )}
          <Link className="home-btn home-btn-primary" to={primaryHref}>
            {primaryLabel}
            <ArrowRight size={16} />
          </Link>
          <button
            type="button"
            className="home-nav-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="home-nav-drawer" role="dialog" aria-label="Navigation">
          <a href="#capabilities" onClick={() => setMenuOpen(false)}>
            Capabilities
          </a>
          <a href="#stack" onClick={() => setMenuOpen(false)}>
            Stack
          </a>
          <a href="#access" onClick={() => setMenuOpen(false)}>
            Access
          </a>
          {!user && (
            <Link to="/register" onClick={() => setMenuOpen(false)}>
              Register
            </Link>
          )}
          <Link to={primaryHref} onClick={() => setMenuOpen(false)}>
            {primaryLabel}
          </Link>
        </div>
      )}

      <main id="top">
        <section className="home-hero" aria-labelledby="home-hero-brand">
          <div className="home-hero-plane" aria-hidden>
            <img
              className="home-hero-img"
              src="/home-hero.jpg"
              alt=""
              width={1920}
              height={1080}
            />
            <div className="home-hero-grid" />
            <div className="home-hero-vignette" />
          </div>

          <div className="home-hero-content">
            <p className="home-hero-brand" id="home-hero-brand">
              MAMS
            </p>
            <p className="home-hero-fullname">Military Asset Management System</p>
            <h1 className="home-hero-title">
              Accountable military logistics, from purchase to expenditure.
            </h1>
            <p className="home-hero-lead">
              A role-scoped command console for base inventory, transfers, and audit-ready movement.
            </p>
            <div className="home-hero-ctas">
              <Link className="home-btn home-btn-primary home-btn-lg" to={primaryHref}>
                {primaryLabel}
                <ArrowRight size={18} />
              </Link>
              <a className="home-btn home-btn-ghost home-btn-lg" href="#capabilities">
                View capabilities
              </a>
            </div>
          </div>
        </section>

        <section
          id="capabilities"
          className={`home-section home-capabilities ${caps.visible ? 'is-in' : ''}`}
          ref={caps.ref}
          aria-labelledby="capabilities-heading"
        >
          <div className="home-section-inner">
            <header className="home-section-head">
              <p className="home-kicker">Mission set</p>
              <h2 id="capabilities-heading">Capabilities</h2>
              <p className="home-section-lead">
                Five operational surfaces that keep every asset movement visible and attributable.
              </p>
            </header>

            <ul className="home-cap-list">
              {CAPABILITIES.map((cap, i) => {
                const Icon = cap.icon;
                return (
                  <li
                    key={cap.code}
                    className="home-cap-row"
                    style={{ '--i': i } as CSSProperties}
                  >
                    <span className="home-cap-code mono">{cap.code}</span>
                    <span className="home-cap-icon" aria-hidden>
                      <Icon size={20} strokeWidth={1.8} />
                    </span>
                    <div className="home-cap-body">
                      <h3>{cap.title}</h3>
                      <p>{cap.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section
          className={`home-section home-roles ${roles.visible ? 'is-in' : ''}`}
          ref={roles.ref}
          aria-labelledby="roles-heading"
        >
          <div className="home-section-inner">
            <header className="home-section-head">
              <p className="home-kicker">Authority matrix</p>
              <h2 id="roles-heading">Command roles</h2>
              <p className="home-section-lead">
                Access is enforced by role — operators see and act only within their mandate.
              </p>
            </header>

            <ul className="home-role-list">
              {ROLES.map((role, i) => (
                <li
                  key={role.code}
                  className="home-role-row"
                  style={{ '--i': i } as CSSProperties}
                >
                  <span className="home-role-code mono">{role.code}</span>
                  <h3 className="home-role-title">{role.title}</h3>
                  <p className="home-role-summary">{role.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="stack" className="home-section home-stack" aria-labelledby="stack-heading">
          <div className="home-section-inner home-stack-strip">
            <h2 id="stack-heading" className="visually-hidden">
              Built with
            </h2>
            <p className="home-stack-line mono">
              <span className="home-stack-label">STACK</span>
              <span className="home-stack-sep" aria-hidden>
                //
              </span>
              {STACK.map((item, i) => (
                <span key={item} className="home-stack-item">
                  {i > 0 && (
                    <span className="home-stack-dot" aria-hidden>
                      ·
                    </span>
                  )}
                  {item}
                </span>
              ))}
            </p>
          </div>
        </section>

        <section id="access" className="home-section home-access" aria-labelledby="access-heading">
          <div className="home-section-inner home-access-band">
            <div className="home-access-copy">
              <p className="home-kicker">Secure entry</p>
              <h2 id="access-heading">Enter the command console</h2>
              <p>
                Sign in to manage inventory across purchases, transfers, and assignments.
                Demo accounts are listed on the login screen.
              </p>
            </div>
            <div className="home-access-actions">
              <Link className="home-btn home-btn-primary home-btn-lg" to={primaryHref}>
                {primaryLabel}
                <ArrowRight size={18} />
              </Link>
              {!user && (
                <>
                  <Link className="home-btn home-btn-ghost" to="/register">
                    Create account
                  </Link>
                  <Link className="home-btn home-btn-ghost" to="/login">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <Shield size={16} aria-hidden />
            <strong>MAMS</strong>
            <span>Military Asset Management System</span>
          </div>
          <p>Portfolio demonstration — accountable logistics command.</p>
        </div>
      </footer>
    </div>
  );
}
