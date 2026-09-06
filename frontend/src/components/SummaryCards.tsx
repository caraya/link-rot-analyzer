import React from "react";
import type { AnalysisSummary } from "../types.js";
import { Link2, AlertTriangle, CheckCircle2, Layers } from "lucide-react";

interface SummaryCardsProps {
  summary: AnalysisSummary;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const latestYear = Math.max(...summary.cohortYears);
  const latestMetric = summary.survivalByYear[latestYear] || { total: 0, alive: 0, survivalRate: 0 };
  const rottedCount = latestMetric.total - latestMetric.alive;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Analyzed URLs */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Total Benchmark URLs</span>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Link2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold font-mono text-slate-100">
            {summary.totalAnalyzed.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Sampled across {summary.cohortYears.length} crawl cohorts
          </p>
        </div>
      </div>

      {/* Current Rot Rate */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Overall Link Rot Rate</span>
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold font-mono text-rose-400">
            {summary.rotRatePercentage.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {rottedCount.toLocaleString()} rotted / missing in {latestYear} crawl
          </p>
        </div>
      </div>

      {/* Survival Rate */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Latest Survival Rate</span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold font-mono text-emerald-400">
            {latestMetric.survivalRate.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {latestMetric.alive.toLocaleString()} active in {latestYear} crawl
          </p>
        </div>
      </div>

      {/* Historical Cohorts */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Crawl Cohorts Tracked</span>
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold font-mono text-cyan-400">
            {summary.cohortYears.join(", ")}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Common Crawl WARC Parquet index snapshots
          </p>
        </div>
      </div>
    </div>
  );
};