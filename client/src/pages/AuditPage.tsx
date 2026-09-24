import { useEffect, useState } from 'react';
import { ScrollText, History, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/Pagination';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details: string;
  ipAddress?: string | null;
  createdAt: string;
  user?: { name: string; email: string; role: string } | null;
}

const DETAIL_LABELS: Record<string, string> = {
  email: 'Email',
  baseId: 'Base',
  assetId: 'Asset',
  quantity: 'Qty',
  personnelName: 'Personnel',
  personnelId: 'Service ID',
  notes: 'Notes',
  reason: 'Reason',
  fromBaseId: 'From base',
  toBaseId: 'To base',
  assignmentId: 'Assignment',
  role: 'Role',
  vendor: 'Vendor',
  status: 'Status',
};

function actionTone(action: string) {
  const a = action.toUpperCase();
  if (a.includes('DELETE') || a.includes('EXPEND')) return 'danger';
  if (a.includes('CREATE') || a.includes('LOGIN') || a.includes('REGISTER'))
    return 'success';
  if (a.includes('UPDATE') || a.includes('RETURN') || a.includes('TRANSFER'))
    return 'accent';
  if (a.includes('PASSWORD')) return 'warning';
  return 'neutral';
}

function parseDetails(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return null;
  }
}

function prettyValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DetailChips({ raw }: { raw: string }) {
  const data = parseDetails(raw);
  if (!data) {
    return <span className="audit-detail-plain">{raw || '—'}</span>;
  }

  const entries = Object.entries(data).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );

  if (!entries.length) return <span className="audit-detail-plain">—</span>;

  return (
    <div className="audit-detail-grid">
      {entries.map(([key, value]) => (
        <div key={key} className="audit-detail-item">
          <span className="audit-detail-key">
            {DETAIL_LABELS[key] || key}
          </span>
          <span className="audit-detail-value" title={prettyValue(value)}>
            {prettyValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AuditPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const pagination = usePagination(rows, {
    resetKey: `${action}|${entityType}|${dateFrom}|${dateTo}`,
  });

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('limit', '200');
    if (action) params.set('action', action);
    if (entityType) params.set('entityType', entityType);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    setError('');
    api<AuditRow[]>(`/api/audit?${params}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [action, entityType, dateFrom, dateTo]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            <ScrollText size={26} />
            Audit log
          </h1>
          <p>
            Transaction history for purchases, transfers, assignments, and auth
            events
            {!isAdmin ? ' (your actions)' : ''}.
          </p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters">
        <div className="field">
          <label>Action</label>
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g. PURCHASE"
          />
        </div>
        <div className="field">
          <label>Entity</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">All</option>
            <option value="Purchase">Purchase</option>
            <option value="Transfer">Transfer</option>
            <option value="Assignment">Assignment</option>
            <option value="Expenditure">Expenditure</option>
            <option value="User">User</option>
          </select>
        </div>
        <div className="field">
          <label>From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="field">
          <label>To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      <div className="panel audit-panel">
        <div className="panel-header">
          <h2>
            <History size={18} />
            Audit trail
          </h2>
          <span className="panel-hint">{rows.length} events</span>
        </div>
        <div className="table-wrap audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Entity</th>
                <th>User</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((r) => (
                <tr key={r.id}>
                  <td className="audit-when">
                    <div className="audit-when-date">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                    <div className="audit-when-time">
                      {new Date(r.createdAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td>
                    <span className={`audit-action tone-${actionTone(r.action)}`}>
                      {r.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <div className="audit-entity">
                      <span className="audit-entity-type">{r.entityType}</span>
                      {r.entityId ? (
                        <code className="audit-entity-id" title={r.entityId}>
                          {r.entityId}
                        </code>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="audit-user">
                      <span className="audit-user-avatar" aria-hidden>
                        <UserRound size={14} />
                      </span>
                      <div className="audit-user-meta">
                        <span className="audit-user-name">
                          {r.user?.name || 'System'}
                        </span>
                        {r.user?.email ? (
                          <span className="audit-user-email">{r.user.email}</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td>
                    <DetailChips raw={r.details} />
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="empty">
                    No audit entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          from={pagination.from}
          to={pagination.to}
          canPrev={pagination.canPrev}
          canNext={pagination.canNext}
          onPrev={pagination.prev}
          onNext={pagination.next}
          onGoTo={pagination.goTo}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>
    </div>
  );
}
