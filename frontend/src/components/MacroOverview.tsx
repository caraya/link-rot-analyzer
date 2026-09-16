import React, { useState, useEffect } from "react";
import type { SummaryResponse, HistoricalUrlAnalysis } from "../types.js";
import { fetchSummary, fetchUrls } from "../api.js";
import { SummaryCards } from "./SummaryCards.js";
import { SurvivalCurveChart } from "./SurvivalCurveChart.js";
import { StatusDistributionChart } from "./StatusDistributionChart.js";
import { TldSurvivalChart } from "./TldSurvivalChart.js";
import { Loader2, AlertCircle, RefreshCw, BarChart2 } from "lucide-react";

interface MacroOverviewProps {
  onInspectUrl: (url: string) => void;
  onDataLoaded?: (summary: SummaryResponse, urls: HistoricalUrlAnalysis[]) => void;
}

export const MacroOverview: React.FC<MacroOverviewProps> = ({ onInspectUrl, onDataLoaded }) => {
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, urlsRes] = await Promise.all([
        fetchSummary(),
        fetchUrls({ limit: 1000 }),
      ]);
      setSummaryData(summaryRes);
      if (onDataLoaded) {
        onDataLoaded(summaryRes, urlsRes.urls);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load macro dataset from local API server. Ensure `npm run server` is running."
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-400 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <p className="text-sm font-medium">Loading Common Crawl macro persistence benchmarks...</p>
        <p className="text-xs text-slate-500">Evaluating survival metrics and cross-cohort persistence data</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-8 text-center max-w-lg mx-auto my-12 text-rose-300">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h2 className="text-base font-bold mb-1 text-slate-100">Benchmark Data Unavailable</h2>
        <p className="text-xs mb-4 text-rose-200/80">{error}</p>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry Benchmark Load
        </button>
      </div>
    );
  }

  if (!summaryData) return null;

  return (
    <div className="space-y-6">
      {/* Workspace Sub-header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Macro Web Decay Benchmarks</h2>
            <p className="text-xs text-slate-400">
              Cross-cohort persistence analysis across {summaryData.summary.cohortYears.length} Common Crawl index snapshots
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/60 transition-all self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
          Reload Analysis
        </button>
      </div>

      <SummaryCards summary={summaryData.summary} />

      {/* D3 Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SurvivalCurveChart summary={summaryData.summary} />
        </div>
        <div>
          <StatusDistributionChart summary={summaryData.summary} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TldSurvivalChart tlds={summaryData.tldMetrics} />

        {/* Top Domains Table */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Top Domains Analyzed</h3>
              <p className="text-xs text-slate-400">Highest volume domains in baseline dataset</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {summaryData.topDomains.length} Domains
            </span>
          </div>

          <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800/80 font-medium">
                  <th className="py-2.5 px-3">Domain</th>
                  <th className="py-2.5 px-3 text-center">URLs</th>
                  <th className="py-2.5 px-3 text-center">Alive</th>
                  <th className="py-2.5 px-3 text-right">Survival Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {summaryData.topDomains.map((d) => (
                  <tr key={d.domain} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-200 font-sans truncate max-w-[160px]">
                      {d.domain}
                    </td>
                    <td className="py-2 px-3 text-center text-slate-400">{d.total}</td>
                    <td className="py-2 px-3 text-center text-emerald-400">{d.alive}</td>
                    <td className="py-2 px-3 text-right font-semibold text-cyan-400">
                      {d.survivalRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
