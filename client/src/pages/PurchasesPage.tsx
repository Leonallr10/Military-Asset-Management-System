import { FormEvent, useEffect, useState } from 'react';
import {
  ShoppingCart,
  Plus,
  History,
  Save,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { api, type Asset, type Base } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/Pagination';

interface Purchase {
  id: string;
  quantity: number;
  unitCost?: number | null;
  purchasedAt: string;
  vendor?: string | null;
  notes?: string | null;
  asset: Asset;
  base: Base;
  createdBy: { name: string };
}

type PurchaseForm = {
  baseId: string;
  assetId: string;
  quantity: number;
  vendor: string;
  notes: string;
};

const emptyForm = (baseId = '', assetId = ''): PurchaseForm => ({
  baseId,
  assetId,
  quantity: 1,
  vendor: '',
  notes: '',
});

export function PurchasesPage() {
  const { user, canPurchaseOrTransfer, isAdmin } = useAuth();
  const [rows, setRows] = useState<Purchase[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [baseId, setBaseId] = useState(user?.baseId || '');
  const [equipmentType, setEquipmentType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<PurchaseForm>(emptyForm(user?.baseId || ''));
  const [editingId, setEditingId] = useState<string | null>(null);

  const pagination = usePagination(rows, {
    resetKey: `${baseId}|${equipmentType}|${dateFrom}|${dateTo}`,
  });

  function load() {
    const params = new URLSearchParams();
    if (baseId) params.set('baseId', baseId);
    if (equipmentType) params.set('equipmentType', equipmentType);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    api<Purchase[]>(`/api/purchases?${params}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    Promise.all([api<Base[]>('/api/bases'), api<Asset[]>('/api/assets')]).then(
      ([b, a]) => {
        setBases(b);
        setAssets(a);
        setForm((f) => ({
          ...f,
          baseId: f.baseId || user?.baseId || b[0]?.id || '',
          assetId: f.assetId || a[0]?.id || '',
        }));
      }
    );
  }, [user?.baseId]);

  useEffect(() => {
    load();
  }, [baseId, equipmentType, dateFrom, dateTo]);

  function startEdit(r: Purchase) {
    setEditingId(r.id);
    setForm({
      baseId: r.base.id,
      assetId: r.asset.id,
      quantity: r.quantity,
      vendor: r.vendor || '',
      notes: r.notes || '',
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm((f) => emptyForm(f.baseId || user?.baseId || '', f.assetId));
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
        await api(`/api/purchases/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        cancelEdit();
      } else {
        await api('/api/purchases', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setForm((f) => ({ ...f, quantity: 1, vendor: '', notes: '' }));
      }
      load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingId
            ? 'Failed to update purchase'
            : 'Failed to record purchase'
      );
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Delete this purchase? Inventory will be adjusted.')) {
      return;
    }
    setError('');
    try {
      await api(`/api/purchases/${id}`, { method: 'DELETE' });
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
            <ShoppingCart size={26} />
            Purchases
          </h1>
          <p>Record and review asset acquisitions by base and equipment type.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {canPurchaseOrTransfer && (
        <div className="panel" style={{ marginBottom: '1.25rem' }}>
          <div className="panel-header">
            <h2>
              {editingId ? <Pencil size={18} /> : <Plus size={18} />}
              {editingId ? 'Edit purchase' : 'Record purchase'}
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
              <label>Base</label>
              <select
                value={form.baseId}
                onChange={(e) => setForm({ ...form, baseId: e.target.value })}
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
              <label>Asset</label>
              <select
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                required
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.equipmentType})
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
            <div className="field">
              <label>Vendor</label>
              <input
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
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
                <Save size={16} />
                {editingId ? 'Update purchase' : 'Save purchase'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="filters">
        {isAdmin && (
          <div className="field">
            <label>Base</label>
            <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
              <option value="">All</option>
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label>Equipment type</label>
          <select
            value={equipmentType}
            onChange={(e) => setEquipmentType(e.target.value)}
          >
            <option value="">All</option>
            <option value="VEHICLE">Vehicle</option>
            <option value="WEAPON">Weapon</option>
            <option value="AMMUNITION">Ammunition</option>
            <option value="OTHER">Other</option>
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

      <div className="panel">
        <div className="panel-header">
          <h2>
            <History size={18} />
            Purchase history
          </h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Base</th>
                <th>Asset</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Vendor</th>
                <th>Recorded by</th>
                {canPurchaseOrTransfer && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((r) => (
                <tr key={r.id} className={editingId === r.id ? 'row-editing' : ''}>
                  <td>{new Date(r.purchasedAt).toLocaleString()}</td>
                  <td>{r.base.name}</td>
                  <td>{r.asset.name}</td>
                  <td>
                    <span className="badge">{r.asset.equipmentType}</span>
                  </td>
                  <td>{r.quantity}</td>
                  <td>{r.vendor || '—'}</td>
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
                    No purchases found.
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
