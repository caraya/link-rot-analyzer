import React from "react";
import type { SummaryResponse, HistoricalUrlAnalysis } from "../types.js";
import { Download, X, FileJson, FileSpreadsheet } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SummaryResponse | null;
  urls: HistoricalUrlAnalysis[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  data,
  urls,
}) => {
  if (!isOpen) return null;

  const downloadJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      summary: data?.summary,
      tldMetrics: data?.tldMetrics,
      topDomains: data?.topDomains,
      urls,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `link-rot-analysis-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    if (!urls || urls.length === 0) return;

    const cohortYears = data?.summary.cohortYears || [2018, 2021, 2024];
    const headers = ["URL", "Initial Year", "Current Status", ...cohortYears.map((y) => `${y} Status`)];

    const rows = urls.map((u) => {
      const yearStatuses = cohortYears.map((y) => u.statusByYear[y]?.fetchStatus ?? "Missing");
      return [
        `"${u.url.replace(/"/g, '""')}"`,
        u.initialCrawlYear,
        u.isCurrentlyRotted ? "Rotted" : "Active",
        ...yearStatuses,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `link-rot-analysis-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">Export Analysis Dataset</h3>
            <p className="text-xs text-slate-400">Download report metrics and sampled benchmark URLs</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-6">
          Export the full dataset containing {urls.length.toLocaleString()} benchmark URLs, historical cohort presence flags, and computed top-level domain survival rates.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={downloadJson}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/50 transition-all text-slate-200 group"
          >
            <FileJson className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Export JSON</span>
          </button>

          <button
            onClick={downloadCsv}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all text-slate-200 group"
          >
            <FileSpreadsheet className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Export CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};