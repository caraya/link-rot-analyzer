import React, { useState } from "react";
import type { SummaryResponse, HistoricalUrlAnalysis } from "./types.js";
import { Navbar } from "./components/Navbar.js";
import { MacroOverview } from "./components/MacroOverview.js";
import { UrlExplorerTable } from "./components/UrlExplorerTable.js";
import { UrlInspector } from "./components/UrlInspector.js";
import { UrlTracker } from "./components/UrlTracker.js";
import { ExportModal } from "./components/ExportModal.js";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "explorer" | "tracker" | "inspector">("overview");
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [allUrls, setAllUrls] = useState<HistoricalUrlAnalysis[]>([]);
  const [inspectTargetUrl, setInspectUrl] = useState<string | undefined>(undefined);
  const [exportOpen, setExportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleInspectUrl = (url: string) => {
    setInspectUrl(url);
    setActiveTab("inspector");
  };

  const handleDataLoaded = (summary: SummaryResponse, urls: HistoricalUrlAnalysis[]) => {
    setSummaryData(summary);
    setAllUrls(urls);
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenExport={() => setExportOpen(true)}
        onRefreshData={handleRefresh}
        isRefreshing={false}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {/* Tab 1: Macro Web Decay Benchmarks (D3 Charts & High-level Statistics) */}
        {activeTab === "overview" && (
          <MacroOverview
            key={refreshKey}
            onInspectUrl={handleInspectUrl}
            onDataLoaded={handleDataLoaded}
          />
        )}

        {/* Tab 2: URL Explorer Table */}
        {activeTab === "explorer" && (
          <UrlExplorerTable
            key={refreshKey}
            onInspectUrl={handleInspectUrl}
            cohortYears={summaryData?.summary.cohortYears}
          />
        )}

        {/* Tab 3: Dual-Source URL Tracker (Common Crawl & Wikipedia) */}
        {activeTab === "tracker" && (
          <UrlTracker onInspectUrl={handleInspectUrl} />
        )}

        {/* Tab 4: Single-URL Inspector & Wayback Machine Fallbacks */}
        {activeTab === "inspector" && (
          <UrlInspector initialUrl={inspectTargetUrl} />
        )}
      </main>

      {/* Global Export Modal */}
      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        data={summaryData}
        urls={allUrls}
      />
    </div>
  );
};