import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthLinks, AuthShell } from '../components/AuthShell';

export function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from the current password');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({
        email: email.trim(),
        currentPassword,
        newPassword,
      });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password update failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Change password"
      subtitle="Enter the account email, current password, and a new password."
      footer={<AuthLinks showLogin showRegister />}
    >
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={onSubmit} className="auth-form">
        <div className="field field-with-icon">
          <label htmlFor="change-email">Account email</label>
          <Mail size={16} className="field-icon" />
          <input
            id="change-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            placeholder="you@base.mil"
          />
        </div>
        <div className="field field-with-icon">
          <label htmlFor="current-password">Current password</label>
          <Lock size={16} className="field-icon" />
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="field field-with-icon">
          <label htmlFor="new-password">New password</label>
          <Lock size={16} className="field-icon" />
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Min 8 chars, letter + number"
          />
        </div>
        <div className="field field-with-icon">
          <label htmlFor="confirm-password">Confirm new password</label>
          <Lock size={16} className="field-icon" />
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          <ShieldCheck size={16} />
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
}
