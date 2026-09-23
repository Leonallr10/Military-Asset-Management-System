import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  UserPlus,
  User,
  MapPin,
  Shield,
} from 'lucide-react';
import { api, type Base } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AuthLinks, AuthShell } from '../components/AuthShell';

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [bases, setBases] = useState<Base[]>([]);
  const [basesLoading, setBasesLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    rank: '',
    role: 'LOGISTICS_OFFICER' as 'BASE_COMMANDER' | 'LOGISTICS_OFFICER',
    baseId: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function loadBases() {
    setBasesLoading(true);
    setError('');
    api<Base[]>('/api/bases/public')
      .then((rows) => {
        setBases(rows);
        setForm((f) => ({ ...f, baseId: f.baseId || rows[0]?.id || '' }));
      })
      .catch((err) => {
        setBases([]);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load bases. Is the API running the latest deploy?'
        );
      })
      .finally(() => setBasesLoading(false));
  }

  useEffect(() => {
    loadBases();
  }, []);

  if (!loading && user) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!form.baseId) {
      setError('Select an assigned base');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        rank: form.rank.trim() || undefined,
        role: form.role,
        baseId: form.baseId,
      });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Register with JWT session issuance. Admin accounts are provisioned separately."
      footer={<AuthLinks showLogin />}
    >
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={onSubmit} className="auth-form">
        <div className="field field-with-icon">
          <label htmlFor="name">Full name</label>
          <User size={16} className="field-icon" />
          <input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoComplete="name"
          />
        </div>
        <div className="field field-with-icon">
          <label htmlFor="reg-email">Email</label>
          <Mail size={16} className="field-icon" />
          <input
            id="reg-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
          />
        </div>
        <div className="field field-with-icon">
          <label htmlFor="rank">Rank (optional)</label>
          <Shield size={16} className="field-icon" />
          <input
            id="rank"
            value={form.rank}
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
            placeholder="e.g. Capt"
          />
        </div>
        <div className="field field-with-icon">
          <label htmlFor="role">Role</label>
          <Shield size={16} className="field-icon" />
          <select
            id="role"
            value={form.role}
            onChange={(e) =>
              setForm({
                ...form,
                role: e.target.value as 'BASE_COMMANDER' | 'LOGISTICS_OFFICER',
              })
            }
            required
          >
            <option value="LOGISTICS_OFFICER">Logistics Officer</option>
            <option value="BASE_COMMANDER">Base Commander</option>
          </select>
        </div>
        <div className="field field-with-icon">
          <label htmlFor="baseId">Assigned base</label>
          <MapPin size={16} className="field-icon" />
          <select
            id="baseId"
            value={form.baseId}
            onChange={(e) => setForm({ ...form, baseId: e.target.value })}
            required
            disabled={basesLoading || !bases.length}
          >
            {basesLoading && <option value="">Loading bases…</option>}
            {!basesLoading && !bases.length && (
              <option value="">No bases available</option>
            )}
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>
        {!basesLoading && !bases.length && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={loadBases}
          >
            Retry loading bases
          </button>
        )}
        <div className="field field-with-icon">
          <label htmlFor="reg-password">Password</label>
          <Lock size={16} className="field-icon" />
          <input
            id="reg-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Min 8 chars, letter + number"
          />
        </div>
        <div className="field field-with-icon">
          <label htmlFor="confirm">Confirm password</label>
          <Lock size={16} className="field-icon" />
          <input
            id="confirm"
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={submitting || basesLoading || !bases.length}
        >
          <UserPlus size={16} />
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
