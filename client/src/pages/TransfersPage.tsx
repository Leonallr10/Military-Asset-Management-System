import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Plus,
  History,
  Send,
  Pencil,
  Trash2,
  X,
  Save,
} from 'lucide-react';
import { api, type Asset, type Base } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/Pagination';

interface Transfer {
  id: string;
  quantity: number;
  transferredAt: string;
  notes?: string | null;
  status: string;
  asset: Asset;
  fromBase: Base;
  toBase: Base;
  createdBy: { name: string };
}

type TransferForm = {
  fromBaseId: string;
  toBaseId: string;
  assetId: string;
  quantity: number;
  notes: string;
};

export function TransfersPage() {
  const { user, canPurchaseOrTransfer, isAdmin } = useAuth();
  const [rows, setRows] = useState<Transfer[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [baseId, setBaseId] = useState(user?.baseId || '');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TransferForm>({
    fromBaseId: user?.baseId || '',
    toBaseId: '',
    assetId: '',
    quantity: 1,
    notes: '',
  });

  const pagination = usePagination(rows, { resetKey: baseId });

  function load() {
    const params = new URLSearchParams();
    if (baseId) params.set('baseId', baseId);
    api<Transfer[]>(`/api/transfers?${params}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    Promise.all([api<Base[]>('/api/bases'), api<Asset[]>('/api/assets')]).then(
      ([b, a]) => {
        setBases(b);
        setAssets(a);
        const from = user?.baseId || b[0]?.id || '';
        const to = b.find((x) => x.id !== from)?.id || b[0]?.id || '';
        setForm((f) => ({
          ...f,
          fromBaseId: f.fromBaseId || from,
          toBaseId: f.toBaseId || to,
          assetId: f.assetId || a[0]?.id || '',
        }));
      }
    );
  }, [user?.baseId]);

  useEffect(() => {
    load();
  }, [baseId]);

  function startEdit(r: Transfer) {
    setEditingId(r.id);
    setForm({
      fromBaseId: r.fromBase.id,
      toBaseId: r.toBase.id,
      assetId: r.asset.id,
      quantity: r.quantity,
      notes: r.notes || '',
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm((f) => ({ ...f, quantity: 1, notes: '' }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity),
      };
      if (editingId) {
        await api(`/api/transfers/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        cancelEdit();
      } else {
        await api('/api/transfers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setForm((f) => ({ ...f, quantity: 1, notes: '' }));
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
    }
  }

  async function onDelete(id: string) {
    if (
      !window.confirm(
        'Delete this transfer? Inventory at both bases will be reversed.'
      )
    ) {
      return;
    }
    setError('');
    try {
      await api(`/api/transfers/${id}`, { method: 'DELETE' });
      if (editingId === id) cancelEdit();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            <ArrowLeftRight size={26} />
            Transfers
          </h1>
          <p>Move assets between bases with a full timestamped history.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {canPurchaseOrTransfer && (
        <div className="panel" style={{ marginBottom: '1.25rem' }}>
          <div className="panel-header">
            <h2>
              {editingId ? <Pencil size={18} /> : <Plus size={18} />}
              {editingId ? 'Edit transfer' : 'New transfer'}
            </h2>
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                <X size={15} />
                Cancel
              </button>
            )}
          </div>
          <form className="form-grid" onSubmit={onSubmit}>
            <div className="field">
              <label>From base</label>
              <select
                value={form.fromBaseId}
                onChange={(e) => setForm({ ...form, fromBaseId: e.target.value })}
                required
                disabled={!isAdmin && !!user?.baseId}
              >
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>To base</label>
              <select
                value={form.toBaseId}
                onChange={(e) => setForm({ ...form, toBaseId: e.target.value })}
                required
              >
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Asset</label>
              <select
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                required
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Quantity</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: Number(e.target.value) })
                }
                required
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit">
                {editingId ? <Save size={16} /> : <Send size={16} />}
                {editingId ? 'Update transfer' : 'Execute transfer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isAdmin && (
        <div className="filters">
          <div className="field">
            <label>Filter by base</label>
            <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
              <option value="">All</option>
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>
            <History size={18} />
            Transfer history
          </h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>From</th>
                <th>To</th>
                <th>Asset</th>
                <th>Qty</th>
                <th>Status</th>
                <th>By</th>
                {canPurchaseOrTransfer && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((r) => (
                <tr key={r.id} className={editingId === r.id ? 'row-editing' : ''}>
                  <td>{new Date(r.transferredAt).toLocaleString()}</td>
                  <td>{r.fromBase.name}</td>
                  <td>{r.toBase.name}</td>
                  <td>{r.asset.name}</td>
                  <td>{r.quantity}</td>
                  <td>
                    <span className="badge">{r.status}</span>
                  </td>
                  <td>{r.createdBy.name}</td>
                  {canPurchaseOrTransfer && (
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          title="Edit"
                          onClick={() => startEdit(r)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-icon"
                          title="Delete"
                          onClick={() => onDelete(r.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={canPurchaseOrTransfer ? 8 : 7} className="empty">
                    No transfers found.
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
