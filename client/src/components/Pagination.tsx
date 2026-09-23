import { useEffect, useId, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { PAGE_SIZE_OPTIONS } from '../hooks/usePagination';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  from,
  to,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onGoTo,
  onPageSizeChange,
}: PaginationProps) {
  if (total === 0) return null;

  const pages = visiblePages(page, totalPages);

  return (
    <div className="pagination" role="navigation" aria-label="Table pagination">
      <div className="pagination-left">
        <p className="pagination-info">
          <span className="pagination-range">
            {from}–{to}
          </span>
          <span className="pagination-of">of {total} records</span>
        </p>

        <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-nav"
          onClick={() => onGoTo(1)}
          disabled={!canPrev}
          aria-label="First page"
          title="First page"
        >
          <ChevronsLeft size={15} />
        </button>
        <button
          type="button"
          className="pagination-nav"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft size={15} />
        </button>

        <div className="pagination-pages" role="group" aria-label="Page numbers">
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`e-${i}`} className="pagination-ellipsis" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`pagination-page ${p === page ? 'active' : ''}`}
                onClick={() => onGoTo(p as number)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          className="pagination-nav"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight size={15} />
        </button>
        <button
          type="button"
          className="pagination-nav"
          onClick={() => onGoTo(totalPages)}
          disabled={!canNext}
          aria-label="Last page"
          title="Last page"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
}

function PageSizeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (size: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;

    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      className={`pagination-size ${open ? 'is-open' : ''}`}
      ref={rootRef}
    >
      <span className="pagination-size-label" id={`${listId}-label`}>
        Rows per page
      </span>
      <div className="pagination-size-dropdown">
        <button
          type="button"
          className="pagination-size-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={`${listId}-label`}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{value}</span>
          <ChevronDown size={14} className="pagination-size-chevron" />
        </button>

        {open && (
          <ul
            id={listId}
            className="pagination-size-menu"
            role="listbox"
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <li key={n} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={n === value}
                  className={`pagination-size-option ${
                    n === value ? 'is-selected' : ''
                  }`}
                  onClick={() => {
                    onChange(n);
                    setOpen(false);
                  }}
                >
                  {n}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function visiblePages(current: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}
