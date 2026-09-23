import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield, Mail, Lock, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState('admin@mams.mil');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-icon" aria-hidden>
          <Shield size={24} />
        </div>
        <div className="brand-mark">Military Asset Management</div>
        <h1>Secure Access</h1>
        <p className="subtitle">
          Role-based command for inventory, transfers, and accountability.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={onSubmit}>
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
            />
          </div>
          <div className="field field-with-icon">
            <label htmlFor="password">Password</label>
            <Lock size={16} className="field-icon" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            <LogIn size={16} />
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="demo-accounts">
          <div>Demo accounts (password <code>Password123!</code>):</div>
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
      </div>
    </div>
  );
}
