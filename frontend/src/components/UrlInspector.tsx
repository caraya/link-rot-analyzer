import React, { useState, useEffect } from "react";
import type { UrlInspectionReport } from "../types.js";
import { inspectUrl } from "../api.js";
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Archive,
  Clock,
  Globe,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface UrlInspectorProps {
  initialUrl?: string | undefined;
}

export const UrlInspector: React.FC<UrlInspectorProps> = ({ initialUrl }) => {
  const [inputUrl, setInputUrl] = useState(initialUrl || "");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<UrlInspectionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runInspection = async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await inspectUrl(targetUrl.trim());
      setReport(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inspection failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialUrl) {
      setInputUrl(initialUrl);
      runInspection(initialUrl);
    }
  }, [initialUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runInspection(inputUrl);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Single URL Inspector & Wayback Research Tool
          </h2>
          <p className="text-xs text-slate-400">
            Test real-time live HTTP status and retrieve Internet Archive Wayback Machine snapshot histories for any URL
          </p>
        </div>
      </div>

      {/* URL Input Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Paste any URL (e.g. https://example.com/article)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !inputUrl.trim()}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs shadow-md transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Inspect...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Inspect URL
            </>
          )}
        </button>
      </form>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5 mb-6">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Inspection Failed</p>
            <p className="mt-0.5 text-rose-300">{error}</p>
          </div>
        </div>
      )}

      {/* Inspection Results */}
      {report && (
        <div className="space-y-6">
          {/* Recommendation Banner */}
          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed flex items-start gap-3 ${
              report.liveStatus.isAlive
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : report.wayback.hasArchivedSnapshots
                ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className="p-1.5 rounded-lg bg-black/20 shrink-0">
              {report.liveStatus.isAlive ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div>
              <p className="font-semibold text-sm mb-0.5">Automated Finding</p>
              <p>{report.recommendation}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Verification Box */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
                <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" /> Real-Time Live Status
                </h3>
                {report.liveStatus.isAlive ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                    Alive ({report.liveStatus.statusCode ?? 200})
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-medium">
                    Dead / Unreachable
                  </span>
                )}
              </div>

              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Tested URL:</dt>
                  <dd className="font-mono text-slate-200 truncate max-w-[200px]" title={report.liveStatus.url}>
                    {report.liveStatus.url}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Response Code:</dt>
                  <dd className="font-mono text-slate-200">
                    {report.liveStatus.statusCode
                      ? `${report.liveStatus.statusCode} ${report.liveStatus.statusText || ""}`
                      : "No Response"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Response Time:</dt>
                  <dd className="font-mono text-slate-200">{report.liveStatus.responseTimeMs} ms</dd>
                </div>
                {report.liveStatus.contentType && (
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Content Type:</dt>
                    <dd className="font-mono text-slate-200 truncate max-w-[200px]">
                      {report.liveStatus.contentType}
                    </dd>
                  </div>
                )}
                {report.liveStatus.error && (
                  <div className="pt-2 border-t border-slate-800/60 text-rose-400">
                    <dt className="font-medium mb-0.5">Error Detail:</dt>
                    <dd className="font-mono text-[11px] bg-rose-500/10 p-2 rounded border border-rose-500/20">
                      {report.liveStatus.error}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Wayback Machine Box */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
                <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-amber-400" /> Internet Archive Wayback
                </h3>
                {report.wayback.hasArchivedSnapshots ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-medium">
                    Archived ({report.wayback.totalSnapshotCount} snapshots)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50 text-[11px] font-medium">
                    No Archives Found
                  </span>
                )}
              </div>

              {report.wayback.hasArchivedSnapshots ? (
                <dl className="space-y-2.5 text-xs">
                  {report.wayback.closestSnapshot && (
                    <div className="pt-1">
                      <dt className="text-slate-400 flex items-center gap-1 mb-1">
                        <Clock className="w-3 h-3 text-amber-400" /> Latest Archived Copy:
                      </dt>
                      <dd className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
                        <div className="text-amber-200 font-mono text-[11px]">
                          {report.wayback.closestSnapshot.formattedDate}
                        </div>
                        <a
                          href={report.wayback.closestSnapshot.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-cyan-400 hover:underline mt-1 font-sans text-xs"
                        >
                          View Preserved Snapshot <ExternalLink className="w-3 h-3" />
                        </a>
                      </dd>
                    </div>
                  )}

                  {report.wayback.firstSnapshot && (
                    <div className="flex justify-between pt-1">
                      <dt className="text-slate-400">First Capture Date:</dt>
                      <dd className="font-mono text-slate-200">
                        {report.wayback.firstSnapshot.formattedDate}
                      </dd>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800/60">
                    <a
                      href={report.wayback.waybackSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 text-xs"
                    >
                      Browse full Wayback timeline <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </dl>
              ) : (
                <div className="p-4 text-center text-slate-500 text-xs">
                  No snapshot entries were returned by Wayback Machine for this URL.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};