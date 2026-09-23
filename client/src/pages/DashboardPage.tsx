import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  PackageCheck,
  Activity,
  UserCheck,
  Flame,
  ShoppingCart,
  ArrowDownToLine,
  ArrowUpFromLine,
  X,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { api, type Asset, type Base, type DashboardMetrics } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/Pagination';

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

type DetailTab = 'purchases' | 'in' | 'out';

type NetMovementDetail = {
  purchases: any[];
  transferIn: any[];
  transferOut: any[];
};

export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [bases, setBases] = useState<Base[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [baseId, setBaseId] = useState(user?.baseId || '');
  const [equipmentType, setEquipmentType] = useState('');
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('purchases');
  const [detail, setDetail] = useState<NetMovementDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api<Base[]>('/api/bases'),
      api<Asset[]>('/api/assets'),
    ]).then(([b, a]) => {
      setBases(b);
      setAssets(a);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (baseId) params.set('baseId', baseId);
    if (equipmentType) params.set('equipmentType', equipmentType);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    setError('');
    api<DashboardMetrics>(`/api/dashboard/metrics?${params}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [baseId, equipmentType, dateFrom, dateTo]);

  async function openNetMovement(tab: DetailTab = 'purchases') {
    const params = new URLSearchParams();
    if (baseId) params.set('baseId', baseId);
    if (equipmentType) params.set('equipmentType', equipmentType);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    setActiveTab(tab);
    setDetailLoading(true);
    setModalOpen(true);
    try {
      const d = await api<NetMovementDetail>(
        `/api/dashboard/net-movement-detail?${params}`
      );
      setDetail(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load detail');
      setModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  const m = data?.metrics;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            <LayoutDashboard size={26} />
            Operations Dashboard
          </h1>
          <p>
            Opening / closing balances, net movement, assignments and
            expenditures
            {assets.length ? ` · ${assets.length} asset types` : ''}
          </p>
        </div>
      </div>

      <div className="filters">
        {isAdmin && (
          <div className="field">
            <label>Base</label>
            <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
              <option value="">All bases</option>
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label className="inline-icon">
            <Filter size={11} /> Equipment type
          </label>
          <select
            value={equipmentType}
            onChange={(e) => setEquipmentType(e.target.value)}
          >
            <option value="">All types</option>
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

      {error && <div className="error-banner">{error}</div>}

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card-top">
            <div className="metric-label">Opening Balance</div>
            <span className="metric-icon">
              <Package size={16} />
            </span>
          </div>
          <div className="metric-value">{m?.openingBalance ?? '—'}</div>
        </div>
        <div className="metric-card success">
          <div className="metric-card-top">
            <div className="metric-label">Closing Balance</div>
            <span className="metric-icon">
              <PackageCheck size={16} />
            </span>
          </div>
          <div className="metric-value">{m?.closingBalance ?? '—'}</div>
        </div>
        <div
          className="metric-card accent clickable"
          onClick={() => openNetMovement('purchases')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && openNetMovement('purchases')}
          title="View purchases, transfer in, transfer out"
        >
          <div className="metric-card-top">
            <div className="metric-label">Net Movement</div>
            <span className="metric-icon">
              <Activity size={16} />
            </span>
          </div>
          <div className="metric-value">{m?.netMovement ?? '—'}</div>
        </div>
        <div className="metric-card warning">
          <div className="metric-card-top">
            <div className="metric-label">Assigned</div>
            <span className="metric-icon">
              <UserCheck size={16} />
            </span>
          </div>
          <div className="metric-value">{m?.assigned ?? '—'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-top">
            <div className="metric-label">Expended</div>
            <span className="metric-icon">
              <Flame size={16} />
            </span>
          </div>
          <div className="metric-value">{m?.expended ?? '—'}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>
            <Activity size={18} />
            Net movement composition
          </h2>
          <span className="panel-hint">Click a row to view filtered records</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Quantity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                className="clickable-row"
                onClick={() => openNetMovement('purchases')}
                onKeyDown={(e) =>
                  e.key === 'Enter' && openNetMovement('purchases')
                }
                role="button"
                tabIndex={0}
              >
                <td>
                  <span className="inline-icon">
                    <ShoppingCart size={15} /> Purchases
                  </span>
                </td>
                <td>{m?.purchases ?? 0}</td>
                <td className="row-chevron">
                  <ChevronRight size={16} />
                </td>
              </tr>
              <tr
                className="clickable-row"
                onClick={() => openNetMovement('in')}
                onKeyDown={(e) => e.key === 'Enter' && openNetMovement('in')}
                role="button"
                tabIndex={0}
              >
                <td>
                  <span className="inline-icon">
                    <ArrowDownToLine size={15} /> Transfer In
                  </span>
                </td>
                <td>{m?.transferIn ?? 0}</td>
                <td className="row-chevron">
                  <ChevronRight size={16} />
                </td>
              </tr>
              <tr
                className="clickable-row"
                onClick={() => openNetMovement('out')}
                onKeyDown={(e) => e.key === 'Enter' && openNetMovement('out')}
                role="button"
                tabIndex={0}
              >
                <td>
                  <span className="inline-icon">
                    <ArrowUpFromLine size={15} /> Transfer Out
                  </span>
                </td>
                <td>{m?.transferOut ?? 0}</td>
                <td className="row-chevron">
                  <ChevronRight size={16} />
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Net (P + In − Out)</strong>
                </td>
                <td>
                  <strong>{m?.netMovement ?? 0}</strong>
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <NetMovementModal
          detail={detail}
          loading={detailLoading}
          tab={activeTab}
          onTabChange={setActiveTab}
          filters={{
            base:
              bases.find((b) => b.id === baseId)?.name ||
              (baseId ? 'Selected base' : 'All bases'),
            equipmentType: equipmentType || 'All types',
            dateFrom,
            dateTo,
          }}
          onClose={() => {
            setModalOpen(false);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}

function NetMovementModal({
  detail,
  loading,
  tab,
  onTabChange,
  filters,
  onClose,
}: {
  detail: NetMovementDetail | null;
  loading: boolean;
  tab: DetailTab;
  onTabChange: (t: DetailTab) => void;
  filters: {
    base: string;
    equipmentType: string;
    dateFrom: string;
    dateTo: string;
  };
  onClose: () => void;
}) {
  const purchaseCount = detail?.purchases.length ?? 0;
  const inCount = detail?.transferIn.length ?? 0;
  const outCount = detail?.transferOut.length ?? 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="inline-icon">
              <Activity size={18} /> Net Movement Detail
            </h2>
            <p className="modal-filters">
              {filters.base} · {filters.equipmentType} · {filters.dateFrom} →{' '}
              {filters.dateTo}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <X size={16} />
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${tab === 'purchases' ? 'active' : ''}`}
              onClick={() => onTabChange('purchases')}
            >
              <ShoppingCart size={15} />
              Purchases ({purchaseCount})
            </button>
            <button
              type="button"
              className={`tab ${tab === 'in' ? 'active' : ''}`}
              onClick={() => onTabChange('in')}
            >
              <ArrowDownToLine size={15} />
              Transfer In ({inCount})
            </button>
            <button
              type="button"
              className={`tab ${tab === 'out' ? 'active' : ''}`}
              onClick={() => onTabChange('out')}
            >
              <ArrowUpFromLine size={15} />
              Transfer Out ({outCount})
            </button>
          </div>

          {loading && <div className="empty">Loading records…</div>}

          {!loading && detail && tab === 'purchases' && (
            <DetailTable
              resetKey={`purchases-${filters.dateFrom}-${filters.dateTo}`}
              rows={detail.purchases}
              columns={[
                ['Date', (r) => formatDate(r.purchasedAt)],
                ['Base', (r) => r.base?.name],
                ['Asset', (r) => r.asset?.name],
                ['Type', (r) => r.asset?.equipmentType],
                ['Qty', (r) => r.quantity],
                ['Vendor', (r) => r.vendor || '—'],
                ['By', (r) => r.createdBy?.name || '—'],
              ]}
            />
          )}
          {!loading && detail && tab === 'in' && (
            <DetailTable
              resetKey={`in-${filters.dateFrom}-${filters.dateTo}`}
              rows={detail.transferIn}
              columns={[
                ['Date', (r) => formatDate(r.transferredAt)],
                ['From', (r) => r.fromBase?.name],
                ['To', (r) => r.toBase?.name],
                ['Asset', (r) => r.asset?.name],
                ['Type', (r) => r.asset?.equipmentType],
                ['Qty', (r) => r.quantity],
                ['By', (r) => r.createdBy?.name || '—'],
              ]}
            />
          )}
          {!loading && detail && tab === 'out' && (
            <DetailTable
              resetKey={`out-${filters.dateFrom}-${filters.dateTo}`}
              rows={detail.transferOut}
              columns={[
                ['Date', (r) => formatDate(r.transferredAt)],
                ['From', (r) => r.fromBase?.name],
                ['To', (r) => r.toBase?.name],
                ['Asset', (r) => r.asset?.name],
                ['Type', (r) => r.asset?.equipmentType],
                ['Qty', (r) => r.quantity],
                ['By', (r) => r.createdBy?.name || '—'],
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailTable({
  rows,
  columns,
  resetKey,
}: {
  rows: any[];
  columns: [string, (r: any) => unknown][];
  resetKey?: string;
}) {
  const pagination = usePagination(rows, {
    defaultPageSize: 10,
    resetKey: resetKey ?? rows.length,
  });

  if (!rows.length) {
    return <div className="empty">No records match the current filters.</div>;
  }

  const qtyIdx = columns.findIndex(([h]) => h === 'Qty');
  const totalQty =
    qtyIdx >= 0
      ? rows.reduce((s, r) => s + (Number(columns[qtyIdx][1](r)) || 0), 0)
      : null;

  return (
    <div className="table-wrap panel detail-table">
      <table>
        <thead>
          <tr>
            {columns.map(([h]) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pagination.pageItems.map((r) => (
            <tr key={r.id}>
              {columns.map(([h, fn]) => (
                <td key={h}>
                  {h === 'Type' && fn(r) ? (
                    <span className="badge">{String(fn(r))}</span>
                  ) : (
                    String(fn(r) ?? '—')
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totalQty !== null && (
          <tfoot>
            <tr>
              {columns.map(([h], i) => (
                <td key={h}>
                  {i === 0 ? (
                    <strong>Total ({rows.length} records)</strong>
                  ) : h === 'Qty' ? (
                    <strong>{totalQty}</strong>
                  ) : (
                    ''
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
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
  );
}

function formatDate(v: string) {
  return new Date(v).toLocaleString();
}
