import { useMemo, useState } from "react";

/**
 * Reusable client-side table state — search across selected columns, sort, and
 * paginate. Designed for the ΠΑΡΑΓΩΓΗ pages (Πελάτες, Συμβόλαια, Ζημίες,
 * Παραγωγοί) so they all behave consistently.
 */
export interface TableStateOptions<T> {
  /** Full dataset. */
  rows: T[];
  /** Function that turns a row into a single searchable lowercased string. */
  searchableText: (row: T) => string;
  /** Default page size (defaults to 25). */
  pageSize?: number;
  /** Optional initial sort key. */
  initialSortKey?: keyof T;
  initialSortDir?: "asc" | "desc";
}

export interface TableStateResult<T> {
  query: string; setQuery: (s: string) => void;
  page: number; setPage: (p: number) => void;
  pageSize: number; setPageSize: (n: number) => void;
  sortKey: keyof T | null; sortDir: "asc" | "desc";
  toggleSort: (k: keyof T) => void;
  filtered: T[];   // after search + sort
  paged: T[];      // current page only
  totalPages: number;
}

export function useTableState<T>({
  rows, searchableText, pageSize: initialPageSize = 25,
  initialSortKey = null as unknown as keyof T,
  initialSortDir = "asc"
}: TableStateOptions<T>): TableStateResult<T> {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<keyof T | null>(initialSortKey || null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);

  const toggleSort = (k: keyof T) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q ? rows.filter(r => searchableText(r).toLowerCase().includes(q)) : rows.slice();
    if (sortKey) {
      const k = sortKey;
      out.sort((a, b) => {
        const va = a[k] as any, vb = b[k] as any;
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
        const sa = String(va).toLowerCase();
        const sb = String(vb).toLowerCase();
        return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
    }
    return out;
  }, [rows, query, sortKey, sortDir, searchableText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  return {
    query, setQuery: (s: string) => { setQuery(s); setPage(1); },
    page: safePage, setPage,
    pageSize, setPageSize: (n: number) => { setPageSize(n); setPage(1); },
    sortKey, sortDir, toggleSort,
    filtered, paged, totalPages
  };
}
