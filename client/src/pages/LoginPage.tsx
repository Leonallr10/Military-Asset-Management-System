import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Mail, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthLinks, AuthShell } from '../components/AuthShell';
import { PasswordField } from '../components/PasswordField';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="JWT-secured access to inventory, transfers, and accountability."
      footer={
        <>
          <AuthLinks showRegister showChangePassword />
          <div className="demo-accounts">
            <div>
              Demo accounts (password <code>Password123!</code>):
            </div>
            <div>
              <code>admin@mams.mil</code> — Admin
            </div>
            <div>
              <code>commander.fax@mams.mil</code> — Base Commander
            </div>
            <div>
              <code>logistics.fax@mams.mil</code> — Logistics Officer
            </div>
          </div>
        </>
      }
    >
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={onSubmit} className="auth-form">
        <div className="field field-with-icon">
          <label htmlFor="email">Email</label>
          <Mail size={16} className="field-icon" />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            placeholder="you@base.mil"
          />
        </div>
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          required
          autoComplete="current-password"
        />
        <div className="auth-form-meta">
          <Link to="/change-password" className="auth-text-link">
            Change password
          </Link>
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          <LogIn size={16} />
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
