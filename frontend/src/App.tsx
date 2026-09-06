import React, { useState, useEffect } from "react";
import type { SummaryResponse, HistoricalUrlAnalysis } from "./types.js";
import { fetchSummary, fetchUrls } from "./api.js";
import { Navbar } from "./components/Navbar.js";
import { SummaryCards } from "./components/SummaryCards.js";
import { SurvivalCurveChart } from "./components/SurvivalCurveChart.js";
import { StatusDistributionChart } from "./components/StatusDistributionChart.js";
import { TldSurvivalChart } from "./components/TldSurvivalChart.js";
import { UrlExplorerTable } from "./components/UrlExplorerTable.js";
import { UrlInspector } from "./components/UrlInspector.js";
import { ExportModal } from "./components/ExportModal.js";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "explorer" | "inspector">("overview");
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [allUrls, setAllUrls] = useState<HistoricalUrlAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inspectTargetUrl, setInspectUrl] = useState<string | undefined>(undefined);
  const [exportOpen, setExportOpen] = useState(false);
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
      setAllUrls(urlsRes.urls);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to local API server. Ensure `npm run server` is running."
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

  const handleInspectUrl = (url: string) => {
    setInspectUrl(url);
    setActiveTab("inspector");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenExport={() => setExportOpen(true)}
        onRefreshData={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <p className="text-sm">Connecting to local Link Rot API server...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-8 text-center max-w-lg mx-auto my-12 text-rose-300">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h2 className="text-base font-bold mb-1 text-slate-100">API Connection Error</h2>
            <p className="text-xs mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Connection
            </button>
          </div>
        ) : summaryData ? (
          <>
            {/* Overview & D3 Visual Charts Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
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
            )}

            {/* URL Explorer Tab */}
            {activeTab === "explorer" && (
              <UrlExplorerTable
                onInspectUrl={handleInspectUrl}
                cohortYears={summaryData.summary.cohortYears}
              />
            )}

            {/* URL Inspector & Wayback Machine Tab */}
            {activeTab === "inspector" && <UrlInspector initialUrl={inspectTargetUrl} />}
          </>
        ) : null}
      </main>

      {/* Export Modal */}
      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        data={summaryData}
        urls={allUrls}
      />
    </div>
  );
};