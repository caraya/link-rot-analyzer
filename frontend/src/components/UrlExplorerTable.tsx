import React, { useState, useEffect } from "react";
import type { HistoricalUrlAnalysis, UrlsResponse } from "../types.js";
import { fetchUrls } from "../api.js";
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
} from "lucide-react";

interface UrlExplorerTableProps {
  onInspectUrl: (url: string) => void;
  cohortYears: number[];
}

export const UrlExplorerTable: React.FC<UrlExplorerTableProps> = ({
  onInspectUrl,
  cohortYears,
}) => {
  const [data, setData] = useState<UrlsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "alive" | "rotted">("all");
  const [cohortFilter, setCohortFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  const loadUrls = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUrls({
        page,
        limit,
        status: statusFilter,
        cohort: cohortFilter,
        search,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load URLs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUrls();
  }, [page, statusFilter, cohortFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUrls();
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            URL Benchmark Explorer
            {data && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-normal">
                {data.pagination.totalItems.toLocaleString()} URLs
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Search, filter, and inspect historical web crawl persistence
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by domain or path..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </form>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            <button
              onClick={() => {
                setStatusFilter("all");
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusFilter === "all" ? "bg-slate-800 text-cyan-300 font-medium" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setStatusFilter("alive");
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusFilter === "alive" ? "bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Alive
            </button>
            <button
              onClick={() => {
                setStatusFilter("rotted");
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusFilter === "rotted" ? "bg-rose-500/20 text-rose-300 font-medium border border-rose-500/30" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Rotted
            </button>
          </div>

          {/* Cohort Filter */}
          <select
            value={cohortFilter || ""}
            onChange={(e) => {
              setCohortFilter(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="">All Sample Cohorts</option>
            {cohortYears.map((year) => (
              <option key={year} value={year}>
                Sampled in {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <p className="text-xs">Loading benchmark dataset...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 text-xs">
            <p className="font-semibold">{error}</p>
          </div>
        ) : data && data.urls.length > 0 ? (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800/80 font-medium">
                <th className="py-3 px-4">Target URL</th>
                <th className="py-3 px-4">Sample Year</th>
                {cohortYears.map((year) => (
                  <th key={year} className="py-3 px-3 text-center">
                    {year} Status
                  </th>
                ))}
                <th className="py-3 px-4 text-center">Current Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {data.urls.map((row: HistoricalUrlAnalysis) => (
                <tr key={row.url} className="hover:bg-slate-800/40 transition-colors">
                  {/* URL */}
                  <td className="py-3 px-4 max-w-xs sm:max-w-md truncate font-sans text-slate-200">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-cyan-400 hover:underline flex items-center gap-1.5 group"
                      title={row.url}
                    >
                      <span className="truncate">{row.url}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400 shrink-0" />
                    </a>
                  </td>

                  {/* Sampled Cohort Year */}
                  <td className="py-3 px-4 text-slate-400">{row.initialCrawlYear}</td>

                  {/* Per-Cohort Status Columns */}
                  {cohortYears.map((year) => {
                    const st = row.statusByYear[year]?.fetchStatus;
                    return (
                      <td key={year} className="py-3 px-3 text-center">
                        {st === 200 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                            200 OK
                          </span>
                        ) : st !== null && st !== undefined ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px]">
                            {st}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Current Rot Status */}
                  <td className="py-3 px-4 text-center">
                    {row.isCurrentlyRotted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-sans font-medium text-[11px]">
                        <XCircle className="w-3 h-3" /> Rotted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans font-medium text-[11px]">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onInspectUrl(row.url)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all font-sans text-xs"
                      title="Inspect live status & Wayback Machine archives"
                    >
                      <ShieldAlert className="w-3 h-3" /> Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-slate-500 text-xs">
            No matching URLs found for the selected filters.
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {data && data.pagination.totalPages > 1 && (
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing page <span className="text-slate-200 font-medium">{data.pagination.page}</span> of{" "}
            <span className="text-slate-200 font-medium">{data.pagination.totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page === data.pagination.totalPages}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};