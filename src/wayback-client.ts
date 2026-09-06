import { fileURLToPath } from "node:url";
import path from "node:path";

export interface WaybackSnapshot {
  url: string;
  timestamp: string;
  status: string;
  formattedDate: string;
}

export interface WaybackResult {
  url: string;
  hasArchivedSnapshots: boolean;
  closestSnapshot: WaybackSnapshot | null;
  firstSnapshot: WaybackSnapshot | null;
  totalSnapshotCount: number;
  waybackSearchUrl: string;
  error: string | null;
  checkedAt: string;
}

const DEFAULT_USER_AGENT =
  "LinkRotAnalyzer/1.0 (Research Tool; +https://github.com/carlos/link-rot-analyzer)";

function parseWaybackTimestamp(ts: string): string {
  if (ts.length < 14) return ts;
  const year = ts.substring(0, 4);
  const month = ts.substring(4, 6);
  const day = ts.substring(6, 8);
  const hour = ts.substring(8, 10);
  const min = ts.substring(10, 12);
  const sec = ts.substring(12, 14);
  return `${year}-${month}-${day} ${hour}:${min}:${sec} UTC`;
}

/**
 * Queries the Internet Archive Wayback Machine APIs for an individual URL.
 * Fetches availability status, closest/first archived snapshots, and snapshot counts.
 */
export async function checkWaybackAvailability(
  url: string,
  timeoutMs = 6000,
  verbose = false
): Promise<WaybackResult> {
  const checkedAt = new Date().toISOString();
  let targetUrl = url;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `http://${targetUrl}`;
  }

  const waybackSearchUrl = `https://web.archive.org/web/*/${targetUrl}`;

  const log = (msg: string) => {
    if (verbose || isMain) {
      console.log(`[Wayback] ${msg}`);
    }
  };

  log(`Initiating Wayback Machine queries for ${targetUrl} (timeout: ${timeoutMs}ms)...`);

  // Query Availability API
  const fetchAvailability = async (): Promise<WaybackSnapshot | null> => {
    const startTime = Date.now();
    log(`Querying Availability API: https://archive.org/wayback/available?url=...`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const availUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(availUrl, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
        signal: controller.signal,
      });

      log(`Availability API responded in ${Date.now() - startTime}ms (status ${res.status})`);

      if (!res.ok) return null;

      const data = (await res.json()) as {
        archived_snapshots?: {
          closest?: {
            status?: string;
            available?: boolean;
            url?: string;
            timestamp?: string;
          };
        };
      };

      const closest = data.archived_snapshots?.closest;
      if (closest && closest.available && closest.url && closest.timestamp) {
        return {
          url: closest.url,
          timestamp: closest.timestamp,
          status: closest.status || "200",
          formattedDate: parseWaybackTimestamp(closest.timestamp),
        };
      }
      return null;
    } catch (err) {
      const duration = Date.now() - startTime;
      if (err instanceof Error && err.name === "AbortError") {
        log(`Availability API timed out after ${duration}ms`);
      } else {
        log(`Availability API query failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // Query CDX API
  const fetchCdxData = async (): Promise<{
    firstSnapshot: WaybackSnapshot | null;
    totalCount: number;
  }> => {
    const startTime = Date.now();
    log(`Querying CDX Server API: https://web.archive.org/cdx/search/cdx?...`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(
        targetUrl
      )}&output=json&fl=timestamp,original,statuscode&filter=statuscode:200&limit=1000`;

      const res = await fetch(cdxUrl, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
        signal: controller.signal,
      });

      log(`CDX Server API responded in ${Date.now() - startTime}ms (status ${res.status})`);

      if (!res.ok) return { firstSnapshot: null, totalCount: 0 };

      const cdxData = (await res.json()) as string[][];
      if (Array.isArray(cdxData) && cdxData.length > 1) {
        const snapshotRows = cdxData.slice(1);
        const firstRow = snapshotRows[0];
        let firstSnapshot: WaybackSnapshot | null = null;

        if (firstRow && firstRow[0]) {
          const ts = firstRow[0];
          const original = firstRow[1] || targetUrl;
          const status = firstRow[2] || "200";
          firstSnapshot = {
            url: `https://web.archive.org/web/${ts}/${original}`,
            timestamp: ts,
            status,
            formattedDate: parseWaybackTimestamp(ts),
          };
        }

        return {
          firstSnapshot,
          totalCount: snapshotRows.length,
        };
      }

      return { firstSnapshot: null, totalCount: 0 };
    } catch (err) {
      const duration = Date.now() - startTime;
      if (err instanceof Error && err.name === "AbortError") {
        log(`CDX Server API timed out after ${duration}ms`);
      } else {
        log(`CDX Server API query failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return { firstSnapshot: null, totalCount: 0 };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    // Run Availability API and CDX API queries in parallel using Promise.allSettled
    const results = await Promise.allSettled([
      fetchAvailability(),
      fetchCdxData(),
    ]);

    const closestSnapshot =
      results[0].status === "fulfilled" ? results[0].value : null;
    const { firstSnapshot, totalCount: cdxCount } =
      results[1].status === "fulfilled"
        ? results[1].value
        : { firstSnapshot: null, totalCount: 0 };

    const hasArchivedSnapshots = closestSnapshot !== null || firstSnapshot !== null;
    const totalSnapshotCount = cdxCount || (hasArchivedSnapshots ? 1 : 0);

    log(`Query complete. Archived copies found: ${hasArchivedSnapshots} (Total snapshots: ${totalSnapshotCount})`);

    return {
      url: targetUrl,
      hasArchivedSnapshots,
      closestSnapshot,
      firstSnapshot,
      totalSnapshotCount,
      waybackSearchUrl,
      error: null,
      checkedAt,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to query Wayback Machine";
    log(`Error during execution: ${errorMessage}`);
    return {
      url: targetUrl,
      hasArchivedSnapshots: false,
      closestSnapshot: null,
      firstSnapshot: null,
      totalSnapshotCount: 0,
      waybackSearchUrl,
      error: errorMessage,
      checkedAt,
    };
  }
}

// Execute Wayback Machine client directly from CLI if provided a URL argument
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const targetUrl = process.argv[2] || "https://example.com";
  console.log(`[Phase 3] Wayback Machine Client querying: ${targetUrl}...`);
  checkWaybackAvailability(targetUrl).then((result) => {
    console.log(`URL: ${result.url}`);
    console.log(`Archived Snapshots Found: ${result.hasArchivedSnapshots}`);
    console.log(`Total Snapshot Count: ${result.totalSnapshotCount}`);
    if (result.closestSnapshot) {
      console.log(`Closest Snapshot: ${result.closestSnapshot.url} (${result.closestSnapshot.formattedDate})`);
    }
    if (result.firstSnapshot) {
      console.log(`First Snapshot: ${result.firstSnapshot.url} (${result.firstSnapshot.formattedDate})`);
    }
    console.log(`Wayback Search: ${result.waybackSearchUrl}`);
  });
}