import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import type { ReactNode } from 'react';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="login-page">
      <div className="login-card auth-card">
        <Link to="/" className="auth-home-link" aria-label="Back to home">
          <span className="login-icon" aria-hidden>
            <Shield size={24} />
          </span>
        </Link>
        <div className="brand-mark">Military Asset Management</div>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
        {children}
        {footer}
      </div>
    </div>
  );
}

export function AuthLinks({
  showLogin,
  showRegister,
  showChangePassword,
}: {
  showLogin?: boolean;
  showRegister?: boolean;
  showChangePassword?: boolean;
}) {
  return (
    <div className="auth-links">
      {showLogin && (
        <Link to="/login" className="auth-text-link">
          Back to sign in
        </Link>
      )}
      {showRegister && (
        <Link to="/register" className="auth-text-link">
          Create an account
        </Link>
      )}
      {showChangePassword && (
        <Link to="/change-password" className="auth-text-link">
          Change password
        </Link>
      )}
    </div>
  );
}
