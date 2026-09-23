import { useMemo, useState, useEffect } from 'react';

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

export function usePagination<T>(
  items: T[],
  options?: { defaultPageSize?: number; resetKey?: string | number }
) {
  const defaultPageSize = options?.defaultPageSize ?? 10;
  const resetKey = options?.resetKey;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function goTo(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages));
  }

  function changePageSize(size: number) {
    setPageSize(size);
  }

  return {
    page,
    pageSize,
    total,
    totalPages,
    pageItems,
    from,
    to,
    goTo,
    setPageSize: changePageSize,
    next: () => goTo(page + 1),
    prev: () => goTo(page - 1),
    canPrev: page > 1 && total > 0,
    canNext: page < totalPages && total > 0,
  };
}
