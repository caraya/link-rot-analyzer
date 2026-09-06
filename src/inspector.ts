import { fileURLToPath } from "node:url";
import path from "node:path";
import { verifyUrlLive, type LiveVerificationResult } from "./live-verifier.js";
import { checkWaybackAvailability, type WaybackResult } from "./wayback-client.js";

export interface UrlInspectionReport {
  url: string;
  liveStatus: LiveVerificationResult;
  wayback: WaybackResult;
  recommendation: string;
}

/**
 * Conducts a comprehensive single-URL research inspection:
 * Performs a live HTTP status check and queries Internet Archive Wayback Machine in parallel.
 * Works for any arbitrary URL (cohort or custom).
 */
export async function inspectUrl(
  url: string,
  timeoutMs = 6000,
  verbose = false
): Promise<UrlInspectionReport> {
  if (verbose || isMain) {
    console.log(`[Inspector] Starting parallel inspection for ${url}...`);
  }

  const results = await Promise.allSettled([
    verifyUrlLive(url, timeoutMs),
    checkWaybackAvailability(url, timeoutMs, verbose),
  ]);

  const liveStatus: LiveVerificationResult =
    results[0].status === "fulfilled"
      ? results[0].value
      : {
          url,
          statusCode: null,
          statusText: null,
          finalUrl: url,
          isAlive: false,
          contentType: null,
          responseTimeMs: 0,
          error: results[0].reason?.message || "Live verification failed",
          checkedAt: new Date().toISOString(),
        };

  const wayback: WaybackResult =
    results[1].status === "fulfilled"
      ? results[1].value
      : {
          url,
          hasArchivedSnapshots: false,
          closestSnapshot: null,
          firstSnapshot: null,
          totalSnapshotCount: 0,
          waybackSearchUrl: `https://web.archive.org/web/*/${url}`,
          error: results[1].reason?.message || "Wayback Machine check failed",
          checkedAt: new Date().toISOString(),
        };

  let recommendation = "";
  if (liveStatus.isAlive) {
    recommendation = "URL is live and reachable.";
  } else if (wayback.hasArchivedSnapshots && wayback.closestSnapshot) {
    recommendation = `URL is unreachable (${liveStatus.error}). Preserved copy available at Wayback Machine: ${wayback.closestSnapshot.url}`;
  } else {
    recommendation = `URL is unreachable (${liveStatus.error}) and no preserved copies were found in Wayback Machine archives.`;
  }

  return {
    url: liveStatus.url,
    liveStatus,
    wayback,
    recommendation,
  };
}

// Execute inspector directly from CLI if provided a URL argument
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const targetUrl = process.argv[2] || "https://example.com";
  console.log(`[Phase 3] Conducting URL Inspection for: ${targetUrl}\n`);
  inspectUrl(targetUrl).then((report) => {
    console.log(`=== URL Inspection Report ===`);
    console.log(`Target URL:     ${report.url}`);
    console.log(`Live Status:    ${report.liveStatus.isAlive ? "ALIVE (200 OK)" : "DEAD / UNREACHABLE"}`);
    if (report.liveStatus.error) {
      console.log(`Live Error:     ${report.liveStatus.error}`);
    }
    console.log(`Response Time:  ${report.liveStatus.responseTimeMs}ms`);
    console.log(`Archived:       ${report.wayback.hasArchivedSnapshots ? "YES" : "NO"}`);
    console.log(`Total Snapshots:${report.wayback.totalSnapshotCount}`);
    if (report.wayback.closestSnapshot) {
      console.log(`Latest Archive: ${report.wayback.closestSnapshot.url}`);
    }
    console.log(`\nRecommendation: ${report.recommendation}`);
  });
}