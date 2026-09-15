import React from "react";
import { Activity, Search, ShieldAlert, Download, RefreshCw, Compass } from "lucide-react";

interface NavbarProps {
  activeTab: "overview" | "explorer" | "tracker" | "inspector";
  setActiveTab: (tab: "overview" | "explorer" | "tracker" | "inspector") => void;
  onOpenExport: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenExport,
  onRefreshData,
  isRefreshing,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
              Link Rot Analyzer
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                v1.0
              </span>
            </h1>
            <p className="text-xs text-slate-400">Historical Web Decay & Archival Survival Engine</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800/80 shadow-inner">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === "overview"
                ? "bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Overview & D3 Charts
          </button>
          <button
            onClick={() => setActiveTab("explorer")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === "explorer"
                ? "bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            URL Explorer
          </button>
          <button
            onClick={() => setActiveTab("tracker")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === "tracker"
                ? "bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            URL Tracker (Crawl & Wiki)
          </button>
          <button
            onClick={() => setActiveTab("inspector")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === "inspector"
                ? "bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            URL Inspector & Wayback
          </button>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all border border-slate-800 hover:border-slate-700 disabled:opacity-50"
            title="Refresh Analysis Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
          </button>
          <button
            onClick={onOpenExport}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export Data
          </button>
        </div>
      </div>
    </header>
  );
};