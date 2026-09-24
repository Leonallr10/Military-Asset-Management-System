import { useEffect, useState, type FormEvent } from 'react';
import {
  Users,
  UserPlus,
  Flame,
  History,
  Undo2,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
} from 'lucide-react';
import { api, type Asset, type Base } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/Pagination';

interface Assignment {
  id: string;
  quantity: number;
  personnelName: string;
  personnelId?: string | null;
  assignedAt: string;
  returnedAt?: string | null;
  notes?: string | null;
  asset: Asset;
  base: Base;
}

interface Expenditure {
  id: string;
  quantity: number;
  reason: string;
  expendedAt: string;
  notes?: string | null;
  asset: Asset;
  base: Base;
}

export function AssignmentsPage() {
  const { user, canAssignOrExpend, isAdmin } = useAuth();
  const [tab, setTab] = useState<'assign' | 'expend'>('assign');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState('');
  const [editingAssignId, setEditingAssignId] = useState<string | null>(null);
  const [editingExpendId, setEditingExpendId] = useState<string | null>(null);
  const [filterBaseId, setFilterBaseId] = useState(user?.baseId || '');
  const [equipmentType, setEquipmentType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  const [assignForm, setAssignForm] = useState({
    baseId: user?.baseId || '',
    assetId: '',
    quantity: 1,
    personnelName: '',
    personnelId: '',
    notes: '',
  });

  const [expendForm, setExpendForm] = useState({
    baseId: user?.baseId || '',
    assetId: '',
    quantity: 1,
    reason: '',
    notes: '',
  });

  const assignPagination = usePagination(assignments, {
    resetKey: `a|${filterBaseId}|${equipmentType}|${dateFrom}|${dateTo}|${activeOnly}`,
  });
  const expendPagination = usePagination(expenditures, {
    resetKey: `e|${filterBaseId}|${equipmentType}|${dateFrom}|${dateTo}`,
  });

  function load() {
    const assignParams = new URLSearchParams();
    const expendParams = new URLSearchParams();
    if (filterBaseId) {
      assignParams.set('baseId', filterBaseId);
      expendParams.set('baseId', filterBaseId);
    }
    if (equipmentType) {
      assignParams.set('equipmentType', equipmentType);
      expendParams.set('equipmentType', equipmentType);
    }
    if (dateFrom) {
      assignParams.set('dateFrom', dateFrom);
      expendParams.set('dateFrom', dateFrom);
    }
    if (dateTo) {
      assignParams.set('dateTo', dateTo);
      expendParams.set('dateTo', dateTo);
    }
    if (activeOnly) assignParams.set('activeOnly', 'true');

    Promise.all([
      api<Assignment[]>(`/api/assignments?${assignParams}`),
      api<Expenditure[]>(`/api/expenditures?${expendParams}`),
    ])
      .then(([a, e]) => {
        setAssignments(a);
        setExpenditures(e);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    Promise.all([api<Base[]>('/api/bases'), api<Asset[]>('/api/assets')]).then(
      ([b, a]) => {
        setBases(b);
        setAssets(a);
        const base = user?.baseId || b[0]?.id || '';
        const asset = a[0]?.id || '';
        setAssignForm((f) => ({
          ...f,
          baseId: f.baseId || base,
          assetId: f.assetId || asset,
        }));
        setExpendForm((f) => ({
          ...f,
          baseId: f.baseId || base,
          assetId: f.assetId || asset,
        }));
      }
    );
  }, [user?.baseId]);

  useEffect(() => {
    load();
  }, [filterBaseId, equipmentType, dateFrom, dateTo, activeOnly]);

  function startEditAssign(r: Assignment) {
    if (r.returnedAt) return;
    setEditingAssignId(r.id);
    setAssignForm({
      baseId: r.base.id,
      assetId: r.asset.id,
      quantity: r.quantity,
      personnelName: r.personnelName,
      personnelId: r.personnelId || '',
      notes: r.notes || '',
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditAssign() {
    setEditingAssignId(null);
    setAssignForm((f) => ({
      ...f,
      quantity: 1,
      personnelName: '',
      personnelId: '',
      notes: '',
    }));
  }

  function startEditExpend(r: Expenditure) {
    setEditingExpendId(r.id);
    setExpendForm({
      baseId: r.base.id,
      assetId: r.asset.id,
      quantity: r.quantity,
      reason: r.reason,
      notes: r.notes || '',
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditExpend() {
    setEditingExpendId(null);
    setExpendForm((f) => ({ ...f, quantity: 1, reason: '', notes: '' }));
  }

  async function submitAssign(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...assignForm,
        quantity: Number(assignForm.quantity),
        personnelId: assignForm.personnelId || undefined,
      };
      if (editingAssignId) {
        await api(`/api/assignments/${editingAssignId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        cancelEditAssign();
      } else {
        await api('/api/assignments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setAssignForm((f) => ({
          ...f,
          quantity: 1,
          personnelName: '',
          personnelId: '',
          notes: '',
        }));
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    }
  }

  async function submitExpend(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...expendForm,
        quantity: Number(expendForm.quantity),
      };
      if (editingExpendId) {
        await api(`/api/expenditures/${editingExpendId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        cancelEditExpend();
      } else {
        await api('/api/expenditures', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setExpendForm((f) => ({ ...f, quantity: 1, reason: '', notes: '' }));
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Expenditure failed');
    }
  }

  async function returnAssignment(id: string) {
    setError('');
    try {
      await api(`/api/assignments/${id}/return`, { method: 'POST' });
      if (editingAssignId === id) cancelEditAssign();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Return failed');
    }
  }

  async function deleteAssignment(id: string) {
    if (
      !window.confirm(
        'Delete this assignment? Active stock reservations will be restored.'
      )
    ) {
      return;
    }
    setError('');
    try {
      await api(`/api/assignments/${id}`, { method: 'DELETE' });
      if (editingAssignId === id) cancelEditAssign();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function deleteExpenditure(id: string) {
    if (
      !window.confirm(
        'Delete this expenditure? Inventory quantity will be restored.'
      )
    ) {
      return;
    }
    setError('');
    try {
      await api(`/api/expenditures/${id}`, { method: 'DELETE' });
      if (editingExpendId === id) cancelEditExpend();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (!canAssignOrExpend) {
    return (
      <div className="error-banner">
        Logistics Officers do not have access to assignments and expenditures.
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            <Users size={26} />
            Assignments & Expenditures
          </h1>
          <p>Issue assets to personnel and record expended stock.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters">
        {isAdmin && (
          <div className="field">
            <label>Base</label>
            <select
              value={filterBaseId}
              onChange={(e) => setFilterBaseId(e.target.value)}
            >
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
        {tab === 'assign' && (
          <div className="field">
            <label>Status</label>
            <select
              value={activeOnly ? 'active' : 'all'}
              onChange={(e) => setActiveOnly(e.target.value === 'active')}
            >
              <option value="all">All</option>
              <option value="active">Active only</option>
            </select>
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'assign' ? 'active' : ''}`}
          onClick={() => setTab('assign')}
        >
          <UserPlus size={15} />
          Assignments
        </button>
        <button
          type="button"
          className={`tab ${tab === 'expend' ? 'active' : ''}`}
          onClick={() => setTab('expend')}
        >
          <Flame size={15} />
          Expenditures
        </button>
      </div>

      {tab === 'assign' && (
        <>
          <div className="panel" style={{ marginBottom: '1.25rem' }}>
            <div className="panel-header">
              <h2>
                {editingAssignId ? <Pencil size={18} /> : <Plus size={18} />}
                {editingAssignId ? 'Edit assignment' : 'Assign assets'}
              </h2>
              {editingAssignId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={cancelEditAssign}
                >
                  <X size={15} />
                  Cancel
                </button>
              )}
            </div>
            <form className="form-grid" onSubmit={submitAssign}>
              <div className="field">
                <label>Base</label>
                <select
                  value={assignForm.baseId}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, baseId: e.target.value })
                  }
                  disabled={!isAdmin && !!user?.baseId}
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
                  value={assignForm.assetId}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, assetId: e.target.value })
                  }
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
                  value={assignForm.quantity}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      quantity: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Personnel name</label>
                <input
                  value={assignForm.personnelName}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      personnelName: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Service ID</label>
                <input
                  value={assignForm.personnelId}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      personnelId: e.target.value,
                    })
                  }
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <textarea
                  value={assignForm.notes}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, notes: e.target.value })
                  }
                />
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit">
                  {editingAssignId ? <Save size={16} /> : <UserPlus size={16} />}
                  {editingAssignId ? 'Update assignment' : 'Assign'}
                </button>
              </div>
            </form>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>
                <History size={18} />
                Assignment history
              </h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Assigned</th>
                    <th>Base</th>
                    <th>Asset</th>
                    <th>Qty</th>
                    <th>Personnel</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignPagination.pageItems.map((r) => (
                    <tr
                      key={r.id}
                      className={
                        editingAssignId === r.id ? 'row-editing' : undefined
                      }
                    >
                      <td>{new Date(r.assignedAt).toLocaleString()}</td>
                      <td>{r.base.name}</td>
                      <td>{r.asset.name}</td>
                      <td>{r.quantity}</td>
                      <td>
                        {r.personnelName}
                        {r.personnelId ? ` (${r.personnelId})` : ''}
                      </td>
                      <td>
                        <span className="badge">
                          {r.returnedAt ? 'Returned' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          {!r.returnedAt && (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon"
                                title="Edit"
                                onClick={() => startEditAssign(r)}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => returnAssignment(r.id)}
                              >
                                <Undo2 size={15} />
                                Return
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="btn btn-danger btn-icon"
                            title="Delete"
                            onClick={() => deleteAssignment(r.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!assignments.length && (
                    <tr>
                      <td colSpan={7} className="empty">
                        No assignments yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={assignPagination.page}
              pageSize={assignPagination.pageSize}
              total={assignPagination.total}
              totalPages={assignPagination.totalPages}
              from={assignPagination.from}
              to={assignPagination.to}
              canPrev={assignPagination.canPrev}
              canNext={assignPagination.canNext}
              onPrev={assignPagination.prev}
              onNext={assignPagination.next}
              onGoTo={assignPagination.goTo}
              onPageSizeChange={assignPagination.setPageSize}
            />
          </div>
        </>
      )}

      {tab === 'expend' && (
        <>
          <div className="panel" style={{ marginBottom: '1.25rem' }}>
            <div className="panel-header">
              <h2>
                {editingExpendId ? <Pencil size={18} /> : <Plus size={18} />}
                {editingExpendId ? 'Edit expenditure' : 'Record expenditure'}
              </h2>
              {editingExpendId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={cancelEditExpend}
                >
                  <X size={15} />
                  Cancel
                </button>
              )}
            </div>
            <form className="form-grid" onSubmit={submitExpend}>
              <div className="field">
                <label>Base</label>
                <select
                  value={expendForm.baseId}
                  onChange={(e) =>
                    setExpendForm({ ...expendForm, baseId: e.target.value })
                  }
                  disabled={!isAdmin && !!user?.baseId}
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
                  value={expendForm.assetId}
                  onChange={(e) =>
                    setExpendForm({ ...expendForm, assetId: e.target.value })
                  }
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
                  value={expendForm.quantity}
                  onChange={(e) =>
                    setExpendForm({
                      ...expendForm,
                      quantity: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Reason</label>
                <input
                  value={expendForm.reason}
                  onChange={(e) =>
                    setExpendForm({ ...expendForm, reason: e.target.value })
                  }
                  required
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <textarea
                  value={expendForm.notes}
                  onChange={(e) =>
                    setExpendForm({ ...expendForm, notes: e.target.value })
                  }
                />
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit">
                  {editingExpendId ? <Save size={16} /> : <Flame size={16} />}
                  {editingExpendId
                    ? 'Update expenditure'
                    : 'Record expenditure'}
                </button>
              </div>
            </form>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>
                <History size={18} />
                Expenditure history
              </h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Base</th>
                    <th>Asset</th>
                    <th>Qty</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expendPagination.pageItems.map((r) => (
                    <tr
                      key={r.id}
                      className={
                        editingExpendId === r.id ? 'row-editing' : undefined
                      }
                    >
                      <td>{new Date(r.expendedAt).toLocaleString()}</td>
                      <td>{r.base.name}</td>
                      <td>{r.asset.name}</td>
                      <td>{r.quantity}</td>
                      <td>{r.reason}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            title="Edit"
                            onClick={() => startEditExpend(r)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-icon"
                            title="Delete"
                            onClick={() => deleteExpenditure(r.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!expenditures.length && (
                    <tr>
                      <td colSpan={6} className="empty">
                        No expenditures yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={expendPagination.page}
              pageSize={expendPagination.pageSize}
              total={expendPagination.total}
              totalPages={expendPagination.totalPages}
              from={expendPagination.from}
              to={expendPagination.to}
              canPrev={expendPagination.canPrev}
              canNext={expendPagination.canNext}
              onPrev={expendPagination.prev}
              onNext={expendPagination.next}
              onGoTo={expendPagination.goTo}
              onPageSizeChange={expendPagination.setPageSize}
            />
          </div>
        </>
      )}
    </div>
  );
}
