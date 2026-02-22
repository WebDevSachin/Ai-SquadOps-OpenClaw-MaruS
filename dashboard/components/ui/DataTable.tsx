"use client";

import {
  useState,
  useMemo,
  useCallback,
  ReactNode,
  isValidElement,
} from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  X,
} from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";

export type SortDirection = "asc" | "desc" | null;

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  filterable?: boolean;
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  pagination?: boolean;
  pageSize?: number;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyField,
  searchable = true,
  searchPlaceholder = "Search...",
  searchKeys,
  filterable = false,
  filters = [],
  pagination = true,
  pageSize = 10,
  loading = false,
  emptyMessage = "No data found",
  onRowClick,
  className = "",
}: DataTableProps<T>) {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Get searchable keys if not provided
  const effectiveSearchKeys = useMemo(
    () =>
      searchKeys ||
      (columns
        .filter((col) => col.filterable !== false)
        .map((col) => col.key as keyof T)),
    [searchKeys, columns]
  );

  // Filter data based on search and filters
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        effectiveSearchKeys.some((key) => {
          const value = item[key];
          if (value == null) return false;
          return String(value).toLowerCase().includes(query);
        })
      );
    }

    // Apply filters
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value && value !== "all") {
        result = result.filter((item) => {
          const itemValue = item[key];
          return String(itemValue).toLowerCase() === value.toLowerCase();
        });
      }
    });

    return result;
  }, [data, searchQuery, activeFilters, effectiveSearchKeys]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal == null) return sortDirection === "asc" ? 1 : -1;
      if (bVal == null) return sortDirection === "asc" ? -1 : 1;

      // Handle numeric comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Handle string comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (sortDirection === "asc") {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });
  }, [filteredData, sortKey, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, pagination, currentPage, pageSize]);

  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Handle sort
  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        if (sortDirection === "asc") {
          setSortDirection("desc");
        } else if (sortDirection === "desc") {
          setSortKey(null);
          setSortDirection(null);
        }
      } else {
        setSortKey(key);
        setSortDirection("asc");
      }
      setCurrentPage(1);
    },
    [sortKey, sortDirection]
  );

  // Handle filter change
  const handleFilterChange = useCallback((key: string, value: string) => {
    setActiveFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setCurrentPage(1);
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilters({});
    setSearchQuery("");
    setCurrentPage(1);
  }, []);

  // Get unique filter values for each filter
  const filterOptions = useMemo(() => {
    return filters.map((filter) => ({
      ...filter,
      options: [
        { value: "all", label: `All ${filter.label}s` },
        ...Array.from(
          new Set(
            data
              .map((item) => item[filter.key])
              .filter((val) => val != null)
              .map(String)
          )
        ).map((value) => ({ value, label: value })),
      ],
    }));
  }, [filters, data]);

  // Has active filters
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    Object.values(activeFilters).some((v) => v && v !== "all");

  // Render header cell
  const renderHeaderCell = (column: Column<T>) => {
    const isSorted = sortKey === column.key;
    const SortIcon = isSorted
      ? sortDirection === "asc"
        ? ChevronUp
        : ChevronDown
      : ChevronsUpDown;

    return (
      <th
        className={`px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${
          column.sortable !== false ? "cursor-pointer select-none" : ""
        } ${column.headerClassName || ""}`}
        onClick={() => column.sortable !== false && handleSort(column.key)}
      >
        <div className="flex items-center gap-1.5">
          {column.label}
          {column.sortable !== false && (
            <SortIcon
              className={`w-4 h-4 transition-colors ${
                isSorted ? "text-indigo-400" : "text-gray-600"
              }`}
            />
          )}
        </div>
      </th>
    );
  };

  // Render skeleton rows
  if (loading) {
    return (
      <div className={`card overflow-hidden !p-0 ${className}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3">
                    <Skeleton height={12} width={60} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: pageSize }).map((_, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-4">
                      <Skeleton height={16} width="80%" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Search */}
        {searchable && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="input-with-icon text-sm w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Filter Toggle */}
        {filterable && filters.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? "primary" : "secondary"}
              size="sm"
              leftIcon={<Filter className="w-4 h-4" />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
              {hasActiveFilters && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                  {Object.values(activeFilters).filter((v) => v && v !== "all").length +
                    (searchQuery.trim() ? 1 : 0)}
                </span>
              )}
            </Button>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filter Panel */}
      {filterable && showFilters && filters.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
          {filterOptions.map((filter) => (
            <div key={filter.key} className="flex items-center gap-2">
              <label className="text-sm text-gray-400">{filter.label}:</label>
              <select
                value={activeFilters[filter.key] || "all"}
                onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {columns.map((column) => renderHeaderCell(column))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr
                    key={String(item[keyField])}
                    className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                      onRowClick ? "cursor-pointer" : ""
                    }`}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-4 text-sm text-gray-300 ${
                          column.className || ""
                        }`}
                      >
                        {column.render
                          ? column.render(item)
                          : String(item[column.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <div className="text-sm text-gray-500">
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, sortedData.length)} of{" "}
              {sortedData.length} results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataTable;
