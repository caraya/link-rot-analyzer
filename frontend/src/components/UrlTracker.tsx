import React, { useState, useEffect } from "react";
import type {
  BatchTrackResponse,
  TrackedUrlResult,
  CohortConfig,
  CohortPreset,
} from "../types.js";
import { trackUrls, fetchCohorts } from "../api.js";
import {
  Compass,
  Search,
  BookOpen,
  Layers,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Download,
  Trash2,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Archive,
  Sliders,
  History,
  Check,
} from "lucide-react";

interface UrlTrackerProps {
  onInspectUrl?: ((url: string) => void) | undefined;
}

const PRESET_WIKIPEDIA_URLS = [
  "https://archive.org",
  "https://www.w3.org/TR/html52/",
  "https://commoncrawl.org",
  "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404",
  "https://github.com/torvalds/linux",
];

const PRESET_STANDARDS_URLS = [
  "https://www.w3.org/Protocols/",
  "https://en.wikipedia.org/wiki/Link_rot",
  "https://stanford.edu/research/libraries",
  "https://mit.edu/education/open-courseware",
  "https://example.com/nonexistent-broken-page-404",
];

const DEFAULT_PRESETS: CohortPreset[] = [
  {
    id: "default-triad",
    name: "Default Triad (2018 – 2024)",
    description: "Standard 6-year benchmark with 3-year intervals (2018, 2021, 2024)",
    startYear: 2018,
    years: [2018, 2021, 2024],
  },
  {
    id: "full-history",
    name: "Full 11+ Year History (2013 – 2024)",
    description: "Deep historical tracking back to 2013 (2013, 2016, 2019, 2022, 2024)",
    startYear: 2013,
    years: [2013, 2016, 2019, 2022, 2024],
  },
  {
    id: "decade-span",
    name: "10-Year Decade (2014 – 2024)",
    description: "Decade-long decay analysis (2014, 2017, 2020, 2022, 2024)",
    startYear: 2014,
    years: [2014, 2017, 2020, 2022, 2024],
  },
  {
    id: "recent-5yr",
    name: "Recent 5-Year (2019 – 2024)",
    description: "Recent web decay over the past 5 years (2019, 2021, 2024)",
    startYear: 2019,
    years: [2019, 2021, 2024],
  },
  {
    id: "annual-recent",
    name: "Annual Snapshots (2020 – 2024)",
    description: "High-granularity yearly snapshots (2020, 2021, 2022, 2023, 2024)",
    startYear: 2020,
    years: [2020, 2021, 2022, 2023, 2024],
  },
];

const ALL_POSSIBLE_YEARS = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

export const UrlTracker: React.FC<UrlTrackerProps> = ({ onInspectUrl }) => {
  const [inputText, setInputText] = useState(PRESET_WIKIPEDIA_URLS.join("\n"));
  const [checkLive, setCheckLive] = useState(true);
  const [checkWayback, setCheckWayback] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackedData, setTrackedData] = useState<BatchTrackResponse | null>(null);

  // Cohort Configuration States
  const [presets, setPresets] = useState<CohortPreset[]>(DEFAULT_PRESETS);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("default-triad");
  const [startYear, setStartYear] = useState<number>(2018);
  const [endYear, setEndYear] = useState<number>(2024);
  const [stepYears, setStepYears] = useState<number>(3);
  const [selectedYears, setSelectedYears] = useState<number[]>([2018, 2021, 2024]);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [showCohortDetails, setShowCohortDetails] = useState<boolean>(false);

  const [activeFilter, setActiveFilter] = useState<
    "all" | "wiki" | "crawl" | "dead_wiki" | "alive" | "rotted"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load available presets and cohorts from server on mount
  useEffect(() => {
    fetchCohorts()
      .then((data) => {
        if (data.presets && data.presets.length > 0) {
          setPresets(data.presets);
        }
      })
      .catch(() => {
        // Use default presets fallback
      });
  }, []);

  const handleSelectPreset = (preset: CohortPreset) => {
    setSelectedPresetId(preset.id);
    setIsCustomMode(false);
    setStartYear(preset.startYear);
    setSelectedYears(preset.years);
  };

  const handleStartYearChange = (newStartYear: number) => {
    setStartYear(newStartYear);
    setIsCustomMode(true);
    setSelectedPresetId("custom");

    // Automatically generate stepped years from newStartYear to endYear
    const years: number[] = [];
    for (let yr = newStartYear; yr < endYear; yr += stepYears) {
      years.push(yr);
    }
    if (!years.includes(endYear)) {
      years.push(endYear);
    }
    setSelectedYears(years);
  };

  const handleStepYearsChange = (newStep: number) => {
    setStepYears(newStep);
    setIsCustomMode(true);
    setSelectedPresetId("custom");

    const years: number[] = [];
    for (let yr = startYear; yr < endYear; yr += newStep) {
      years.push(yr);
    }
    if (!years.includes(endYear)) {
      years.push(endYear);
    }
    setSelectedYears(years);
  };

  const toggleIndividualYear = (year: number) => {
    setIsCustomMode(true);
    setSelectedPresetId("custom");
    setSelectedYears((prev) => {
      let updated: number[];
      if (prev.includes(year)) {
        if (prev.length <= 1) return prev; // Keep at least one year
        updated = prev.filter((y) => y !== year);
      } else {
        updated = [...prev, year].sort((a, b) => a - b);
      }
      if (updated.length > 0) {
        setStartYear(Math.min(...updated));
        setEndYear(Math.max(...updated));
      }
      return updated;
    });
  };

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUrls = inputText
      .split(/[\r\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean);

    if (rawUrls.length === 0) {
      setError("Please enter at least one URL to track.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await trackUrls(rawUrls, {
        checkLive,
        checkWayback,
        cohortYears: selectedYears,
        startYear,
        endYear,
        stepYears,
      });
      setTrackedData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to track URLs");
    } finally {
      setLoading(false);
    }
  };

  const handleExportJson = () => {
    if (!trackedData) return;
    const blob = new Blob([JSON.stringify(trackedData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `url_tracking_results_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!trackedData) return;
    const headers = [
      "URL",
      "Domain",
      "Cited_On_Wikipedia",
      "Wikipedia_Article_Count",
      "Common_Crawl_Present_Cohorts",
      "Common_Crawl_Survival",
      "Live_Is_Alive",
      "Live_Status_Code",
      "Wayback_Snapshots_Count",
      "Rot_Risk",
      "Status_Label",
    ];

    const rows = trackedData.results.map((r) => [
      `"${r.url.replace(/"/g, '""')}"`,
      `"${r.domain}"`,
      r.summary.inWikipedia ? "TRUE" : "FALSE",
      r.wikipedia.totalCitations,
      r.commonCrawl.presentCount,
      r.commonCrawl.survivalStatus,
      r.summary.isAliveLive ? "TRUE" : "FALSE",
      r.liveStatus?.statusCode ?? "N/A",
      r.wayback?.totalSnapshotCount ?? 0,
      r.summary.rotRisk,
      `"${r.summary.statusLabel}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `url_tracking_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter results based on active tab and search query
  const filteredResults: TrackedUrlResult[] = (trackedData?.results || []).filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.wikipedia.articles.some((a) =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

    if (!matchesSearch) return false;

    if (activeFilter === "wiki") return item.summary.inWikipedia;
    if (activeFilter === "crawl") return item.summary.inCommonCrawl;
    if (activeFilter === "dead_wiki") return item.summary.inWikipedia && !item.summary.isAliveLive;
    if (activeFilter === "alive") return item.summary.isAliveLive;
    if (activeFilter === "rotted") return !item.summary.isAliveLive;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and Form Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Common Crawl & Wikipedia URL Tracker
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-normal">
                  Configurable Cohorts
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Track link survival across customizable Common Crawl historical archives (from 2013 to present) and Wikipedia citations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInputText(PRESET_WIKIPEDIA_URLS.join("\n"))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/60 transition-all"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" /> Preset: Wikipedia Links
            </button>
            <button
              type="button"
              onClick={() => setInputText(PRESET_STANDARDS_URLS.join("\n"))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/60 transition-all"
            >
              <BookOpen className="w-3 h-3 text-amber-400" /> Preset: Standards
            </button>
            <button
              type="button"
              onClick={() => setInputText("")}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all"
              title="Clear form"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* URL Input Form */}
        <form onSubmit={handleTrackSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Enter URLs to track (one per line, comma or space separated):
            </label>
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="https://archive.org&#10;https://www.w3.org/TR/html52/&#10;https://commoncrawl.org&#10;https://example.com/some-page"
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
          </div>

          {/* Configurable Common Crawl Cohorts Panel */}
          <div className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Common Crawl Historical Depth Configuration
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  Tracking {selectedYears.length} Cohorts ({Math.min(...selectedYears)} → {Math.max(...selectedYears)})
                </span>
                <button
                  type="button"
                  onClick={() => setShowCohortDetails(!showCohortDetails)}
                  className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <Sliders className="w-3 h-3" /> {showCohortDetails ? "Hide Custom Details" : "Custom Settings"}
                </button>
              </div>
            </div>

            {/* Depth Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400 block">
                Choose how far back to evaluate web history:
              </label>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => {
                  const isSelected = selectedPresetId === p.id && !isCustomMode;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-left flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800"
                      }`}
                      title={p.description}
                    >
                      {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                      <span>{p.name}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMode(true);
                    setSelectedPresetId("custom");
                    setShowCohortDetails(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isCustomMode
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800"
                  }`}
                >
                  ⚙️ Custom Year Selection
                </button>
              </div>
            </div>

            {/* Custom Depth Controls (Sliders / Step / Checkboxes) */}
            {(showCohortDetails || isCustomMode) && (
              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Start Year Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>How far back to start (Start Year):</span>
                      <strong className="text-cyan-400 font-mono">{startYear}</strong>
                    </label>
                    <select
                      value={startYear}
                      onChange={(e) => handleStartYearChange(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-500"
                    >
                      {ALL_POSSIBLE_YEARS.filter((y) => y <= 2024).map((yr) => (
                        <option key={yr} value={yr}>
                          {yr} ({yr === 2013 ? "Earliest CDX Index Available" : `${2024 - yr} Years Ago`})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sampling Step Interval */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Sampling Step Interval:</span>
                      <strong className="text-cyan-400 font-mono">Every {stepYears} {stepYears === 1 ? "Year" : "Years"}</strong>
                    </label>
                    <select
                      value={stepYears}
                      onChange={(e) => handleStepYearsChange(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-500"
                    >
                      <option value={1}>Every 1 Year (All Annual Crawls)</option>
                      <option value={2}>Every 2 Years (Biannual)</option>
                      <option value={3}>Every 3 Years (Triad Snapshots)</option>
                      <option value={4}>Every 4 Years (Quadrennial)</option>
                    </select>
                  </div>
                </div>

                {/* Individual Year Toggles */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] text-slate-400 block">
                    Toggle individual historical crawl years:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_POSSIBLE_YEARS.map((yr) => {
                      const isChecked = selectedYears.includes(yr);
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => toggleIndividualYear(yr)}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                            isChecked
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold"
                              : "bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800"
                          }`}
                        >
                          {isChecked ? `✔ ${yr}` : yr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checkLive}
                  onChange={(e) => setCheckLive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
                />
                <span>Include Live HTTP Verification (200 OK vs Dead)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checkWayback}
                  onChange={(e) => setCheckWayback(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
                />
                <span>Include Wayback Machine Archival History</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !inputText.trim() || selectedYears.length === 0}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md hover:shadow-cyan-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Tracking {selectedYears.length} Cohorts & Wikipedia...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Track URLs Across {selectedYears.length} Cohorts
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold">Tracking Error</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {trackedData && (
        <div className="space-y-6">
          {/* Summary Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Total Tracked</span>
                <Globe className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-100">
                {trackedData.summary.totalUrls}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Submitted URLs</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>On Wikipedia</span>
                <BookOpen className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-300">
                {trackedData.summary.inWikipediaCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {Math.round((trackedData.summary.inWikipediaCount / (trackedData.summary.totalUrls || 1)) * 100)}% citation rate
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>In Common Crawl</span>
                <Layers className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl font-bold font-mono text-cyan-300">
                {trackedData.summary.inCommonCrawlCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Across {trackedData.cohortsQueried?.length || selectedYears.length} Cohorts
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Live Active</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {trackedData.summary.aliveCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {trackedData.summary.rottedCount} dead / unreachable
              </div>
            </div>

            <div className="bg-slate-900/80 border border-rose-500/20 bg-rose-500/5 p-4 rounded-xl col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-rose-300 text-xs mb-1">
                <span>Wikipedia Dead Links</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-400">
                {trackedData.summary.wikipediaDeadLinkRiskCount}
              </div>
              <div className="text-[11px] text-rose-300/80 mt-1">
                Cited on Wiki but rotted
              </div>
            </div>
          </div>

          {/* Filter Bar & Export Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeFilter === "all"
                    ? "bg-slate-800 text-cyan-300 border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All ({trackedData.results.length})
              </button>
              <button
                onClick={() => setActiveFilter("wiki")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeFilter === "wiki"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                On Wikipedia ({trackedData.summary.inWikipediaCount})
              </button>
              <button
                onClick={() => setActiveFilter("crawl")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeFilter === "crawl"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                In Common Crawl ({trackedData.summary.inCommonCrawlCount})
              </button>
              <button
                onClick={() => setActiveFilter("dead_wiki")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeFilter === "dead_wiki"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Wiki Dead Link Risks ({trackedData.summary.wikipediaDeadLinkRiskCount})
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter results..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all shrink-0"
                title="Export JSON"
              >
                <Download className="w-3.5 h-3.5" /> JSON
              </button>
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all shrink-0"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-4">
            {filteredResults.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-8 text-center text-slate-400 text-xs">
                No URLs match the selected filter or search criteria.
              </div>
            ) : (
              filteredResults.map((item, idx) => {
                const isCriticalRisk = item.summary.rotRisk === "critical";
                const isHighRisk = item.summary.rotRisk === "high";
                const cohortEntries = Object.entries(item.commonCrawl.cohorts).sort(
                  (a, b) => Number(a[0]) - Number(b[0])
                );

                return (
                  <div
                    key={`${item.url}-${idx}`}
                    className={`bg-slate-900/90 border rounded-xl p-5 shadow-sm transition-all ${
                      isCriticalRisk
                        ? "border-rose-500/40 bg-rose-950/10"
                        : isHighRisk
                        ? "border-amber-500/30 bg-amber-950/5"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {/* Top Row: URL, Domain, Status Badges, and Inspect Action */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {item.domain}
                          </span>

                          {/* Risk Badge */}
                          {item.summary.rotRisk === "critical" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              Critical: Wikipedia Dead Link
                            </span>
                          )}
                          {item.summary.rotRisk === "high" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              High Decay Risk
                            </span>
                          )}
                          {item.summary.rotRisk === "low" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              Healthy / Active
                            </span>
                          )}

                          {/* Live Status Badge */}
                          {item.liveStatus && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                                item.liveStatus.isAlive
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              }`}
                            >
                              Live: {item.liveStatus.statusCode ?? "No Response"} (
                              {item.liveStatus.responseTimeMs}ms)
                            </span>
                          )}
                        </div>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-cyan-300 hover:text-cyan-200 hover:underline inline-flex items-center gap-1 break-all"
                        >
                          {item.url} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {onInspectUrl && (
                          <button
                            onClick={() => onInspectUrl(item.url)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-all"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" /> Full Inspection
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dual Column: Common Crawl Timeline & Wikipedia References */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: Common Crawl Results */}
                      <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
                            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                              <Layers className="w-4 h-4 text-cyan-400" /> Common Crawl Timeline ({cohortEntries.length} Cohorts)
                            </h4>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {item.commonCrawl.presentCount} of{" "}
                              {item.commonCrawl.totalCohortsChecked} Present
                            </span>
                          </div>

                          {/* Responsive Horizontal / Wrapped Cohorts Grid */}
                          <div
                            className={`grid gap-2 mb-3 ${
                              cohortEntries.length <= 3
                                ? "grid-cols-3"
                                : cohortEntries.length <= 5
                                ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                                : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
                            }`}
                          >
                            {cohortEntries.map(([year, record]) => (
                              <div
                                key={year}
                                className={`p-2 rounded-lg border text-center ${
                                  record.present && record.status === 200
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                    : record.present && record.status !== 200
                                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                                    : "bg-slate-900 border-slate-800 text-slate-500"
                                }`}
                              >
                                <div className="text-[11px] font-semibold">{year}</div>
                                <div className="text-xs font-mono font-bold mt-0.5">
                                  {record.present
                                    ? record.status === 200
                                      ? "200 OK"
                                      : `${record.status}`
                                    : "Missing"}
                                </div>
                                <div className="text-[9px] text-slate-400 font-mono truncate mt-0.5" title={record.crawlId}>
                                  {record.crawlId}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/60">
                          <span>
                            Survival Pattern:{" "}
                            <strong className="text-slate-200 capitalize">
                              {item.commonCrawl.survivalStatus}
                            </strong>
                          </span>
                          {item.commonCrawl.firstSeenYear && (
                            <span>
                              Seen: {item.commonCrawl.firstSeenYear} → {item.commonCrawl.lastSeenYear}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Wikipedia References & Citations */}
                      <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
                            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-amber-400" /> Wikipedia Citations
                            </h4>
                            {item.wikipedia.isCitedOnWikipedia ? (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Cited in {item.wikipedia.totalCitations} articles
                              </span>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                                Not Cited on Wikipedia
                              </span>
                            )}
                          </div>

                          {item.wikipedia.articles.length > 0 ? (
                            <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                              {item.wikipedia.articles.map((art) => (
                                <div
                                  key={art.pageId}
                                  className="flex items-center justify-between bg-slate-900/90 border border-slate-800/60 px-2.5 py-1.5 rounded-lg text-xs"
                                >
                                  <a
                                    href={art.articleUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-slate-200 hover:text-cyan-400 hover:underline truncate max-w-[240px]"
                                    title={art.title}
                                  >
                                    {art.title}
                                  </a>
                                  <a
                                    href={art.articleUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-slate-200 shrink-0 ml-2"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 text-center text-slate-500 text-xs">
                              No Wikipedia articles were found citing this URL.
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                          <a
                            href={item.wikipedia.wikipediaSearchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                          >
                            Open Wikipedia Special:LinkSearch <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Wayback Fallback summary if present */}
                    {item.wayback && item.wayback.hasArchivedSnapshots && item.wayback.closestSnapshot && (
                      <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Archive className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            Wayback Machine archive preserved ({item.wayback.totalSnapshotCount} snapshots).
                            Latest: <span className="font-mono text-slate-300">{item.wayback.closestSnapshot.formattedDate}</span>
                          </span>
                        </div>
                        <a
                          href={item.wayback.closestSnapshot.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-semibold"
                        >
                          View Preserved Copy <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
