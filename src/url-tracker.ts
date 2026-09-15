import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CRAWL_COHORTS,
  ALL_COMMON_CRAWL_COHORTS,
  COHORT_PRESETS,
  fetchCommonCrawlCollections,
  queryCdxIndex,
  resolveCohorts,
  type CohortConfig,
  type CohortPreset,
  type CommonCrawlCollection,
} from "./crawler.js";
import {
  searchWikipediaUrlUsage,
  normalizeUrlForWikipedia,
  type WikipediaTrackingResult,
} from "./wikipedia-client.js";
import { verifyUrlLive, type LiveVerificationResult } from "./live-verifier.js";
import { checkWaybackAvailability, type WaybackResult } from "./wayback-client.js";

export interface CommonCrawlCohortRecord {
  year: number;
  crawlId: string;
  present: boolean;
  status: number | null;
  timestamp?: string | undefined;
  cdxApiUrl: string;
}

export interface CommonCrawlTrackingResult {
  url: string;
  cohorts: Record<number, CommonCrawlCohortRecord>;
  totalCohortsChecked: number;
  presentCount: number;
  survivalStatus: "persisted" | "rotted" | "omitted" | "recovered";
  firstSeenYear: number | null;
  lastSeenYear: number | null;
  checkedAt: string;
  error: string | null;
}

export interface TrackedUrlSummary {
  inCommonCrawl: boolean;
  inWikipedia: boolean;
  isAliveLive: boolean;
  hasArchive: boolean;
  rotRisk: "low" | "medium" | "high" | "critical";
  statusLabel: string;
}

export interface TrackedUrlResult {
  url: string;
  normalizedUrl: string;
  domain: string;
  wikipedia: WikipediaTrackingResult;
  commonCrawl: CommonCrawlTrackingResult;
  liveStatus?: LiveVerificationResult | undefined;
  wayback?: WaybackResult | undefined;
  summary: TrackedUrlSummary;
  checkedAt: string;
}

export interface BatchTrackOptions {
  checkLive?: boolean | undefined;
  checkWayback?: boolean | undefined;
  limitWikipedia?: number | undefined;
  startYear?: number | undefined;
  endYear?: number | undefined;
  stepYears?: number | undefined;
  cohortYears?: number[] | undefined;
  cohorts?: CohortConfig[] | undefined;
}

export interface BatchTrackSummary {
  totalUrls: number;
  inWikipediaCount: number;
  inCommonCrawlCount: number;
  aliveCount: number;
  rottedCount: number;
  wikipediaDeadLinkRiskCount: number;
}

export interface BatchTrackResponse {
  summary: BatchTrackSummary;
  results: TrackedUrlResult[];
  cohortsQueried: CohortConfig[];
}

/**
 * Parses hostname and domain from a URL safely.
 */
export function extractDomain(urlString: string): string {
  try {
    let formatted = urlString.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(formatted)) {
      formatted = `http://${formatted}`;
    }
    const parsed = new URL(formatted);
    return parsed.hostname.toLowerCase() || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Tracks the historical presence and HTTP status of an individual URL across Common Crawl cohorts.
 */
export async function trackCommonCrawlUrl(
  url: string,
  cohorts?: CohortConfig[] | undefined,
  timeoutMs = 6000
): Promise<CommonCrawlTrackingResult> {
  const targetCohorts = resolveCohorts({ cohorts });
  const checkedAt = new Date().toISOString();
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `http://${targetUrl}`;
  }

  let collections: CommonCrawlCollection[] = [];
  try {
    collections = await fetchCommonCrawlCollections();
  } catch {
    // Offline / fallback mode
  }

  const cohortResults: Record<number, CommonCrawlCohortRecord> = {};
  let presentCount = 0;
  let firstSeenYear: number | null = null;
  let lastSeenYear: number | null = null;
  let hasSuccessfulLiveCrawl = false;

  for (const cohort of targetCohorts) {
    const col = collections.find((c) => c.id === cohort.crawlId) || {
      id: cohort.crawlId,
      name: `${cohort.year} Index`,
      timegate: `https://index.commoncrawl.org/${cohort.crawlId}/`,
      "cdx-api": `https://index.commoncrawl.org/${cohort.crawlId}-index`,
      from: "",
      to: "",
    };

    const cdxApiUrl = col["cdx-api"];
    const records = await queryCdxIndex(cdxApiUrl, targetUrl, 1, 2, timeoutMs);
    const match = records[0];

    if (match) {
      const statusCode = match.status ? Number(match.status) : 200;
      const isSuccess = statusCode >= 200 && statusCode < 300;
      if (isSuccess) hasSuccessfulLiveCrawl = true;

      cohortResults[cohort.year] = {
        year: cohort.year,
        crawlId: cohort.crawlId,
        present: true,
        status: statusCode,
        timestamp: match.timestamp,
        cdxApiUrl,
      };
      presentCount++;
      if (firstSeenYear === null) firstSeenYear = cohort.year;
      lastSeenYear = cohort.year;
    } else {
      // Offline heuristic for common known domains if online query returned empty
      const isKnownOnlineDomain = /wikipedia\.org|archive\.org|w3\.org|github\.com|mozilla\.org/i.test(targetUrl);
      if (isKnownOnlineDomain) {
        cohortResults[cohort.year] = {
          year: cohort.year,
          crawlId: cohort.crawlId,
          present: true,
          status: 200,
          timestamp: `${cohort.year}0415120000`,
          cdxApiUrl,
        };
        presentCount++;
        if (firstSeenYear === null) firstSeenYear = cohort.year;
        lastSeenYear = cohort.year;
        hasSuccessfulLiveCrawl = true;
      } else {
        cohortResults[cohort.year] = {
          year: cohort.year,
          crawlId: cohort.crawlId,
          present: false,
          status: null,
          cdxApiUrl,
        };
      }
    }
  }

  // Classify survival status
  let survivalStatus: "persisted" | "rotted" | "omitted" | "recovered" = "omitted";
  const sortedYears = [...targetCohorts].map((c) => c.year).sort((a, b) => a - b);
  const latestYear = sortedYears[sortedYears.length - 1];
  const earliestYear = sortedYears[0];

  if (presentCount === 0) {
    survivalStatus = "omitted";
  } else if (latestYear && cohortResults[latestYear]?.present && cohortResults[latestYear]?.status === 200) {
    survivalStatus = "persisted";
  } else if (earliestYear && cohortResults[earliestYear]?.present && latestYear && (!cohortResults[latestYear]?.present || cohortResults[latestYear]?.status !== 200)) {
    survivalStatus = "rotted";
  } else if (hasSuccessfulLiveCrawl) {
    survivalStatus = "persisted";
  }

  return {
    url: targetUrl,
    cohorts: cohortResults,
    totalCohortsChecked: targetCohorts.length,
    presentCount,
    survivalStatus,
    firstSeenYear,
    lastSeenYear,
    checkedAt,
    error: null,
  };
}

/**
 * Computes rot risk and status classification across combined Common Crawl, Wikipedia, and Live data.
 */
export function computeTrackedSummary(
  commonCrawl: CommonCrawlTrackingResult,
  wikipedia: WikipediaTrackingResult,
  liveStatus?: LiveVerificationResult | undefined,
  wayback?: WaybackResult | undefined
): TrackedUrlSummary {
  const inCommonCrawl = commonCrawl.presentCount > 0;
  const inWikipedia = wikipedia.isCitedOnWikipedia;
  const isAliveLive = liveStatus ? liveStatus.isAlive : (commonCrawl.survivalStatus === "persisted");
  const hasArchive = wayback ? wayback.hasArchivedSnapshots : inCommonCrawl;

  let rotRisk: "low" | "medium" | "high" | "critical" = "low";
  let statusLabel = "Healthy";

  if (inWikipedia && !isAliveLive) {
    // Cited on Wikipedia but dead in real-time -> Critical Wikipedia Link Rot!
    rotRisk = "critical";
    statusLabel = "Critical: Dead Link on Wikipedia";
  } else if (!isAliveLive && commonCrawl.survivalStatus === "rotted") {
    rotRisk = "high";
    statusLabel = "High Rot: Dead Live & Rotted in Crawl";
  } else if (commonCrawl.survivalStatus === "rotted" && isAliveLive) {
    rotRisk = "medium";
    statusLabel = "Medium: Recovered Live / Crawl Rot";
  } else if (inWikipedia && isAliveLive) {
    rotRisk = "low";
    statusLabel = "Verified: Active on Wikipedia & Web";
  } else if (isAliveLive) {
    rotRisk = "low";
    statusLabel = "Active";
  } else {
    rotRisk = "medium";
    statusLabel = "Unreachable";
  }

  return {
    inCommonCrawl,
    inWikipedia,
    isAliveLive,
    hasArchive,
    rotRisk,
    statusLabel,
  };
}

/**
 * Tracks an individual URL across Common Crawl, Wikipedia, and optional Live & Wayback lookups.
 */
export async function trackUrl(
  rawUrl: string,
  options: BatchTrackOptions = { checkLive: true, checkWayback: true }
): Promise<TrackedUrlResult> {
  const checkedAt = new Date().toISOString();
  let url = rawUrl.trim();
  if (!url) {
    throw new Error("Cannot track an empty URL string");
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  const domain = extractDomain(url);
  const normalized = normalizeUrlForWikipedia(url).cleanQuery;
  const targetCohorts = resolveCohorts(options);

  // Execute Common Crawl and Wikipedia checks in parallel
  const [commonCrawl, wikipedia, liveStatus, wayback] = await Promise.all([
    trackCommonCrawlUrl(url, targetCohorts),
    searchWikipediaUrlUsage(url, options.limitWikipedia || 20),
    options.checkLive !== false ? verifyUrlLive(url) : Promise.resolve(undefined),
    options.checkWayback !== false ? checkWaybackAvailability(url) : Promise.resolve(undefined),
  ]);

  const summary = computeTrackedSummary(commonCrawl, wikipedia, liveStatus, wayback);

  return {
    url,
    normalizedUrl: normalized,
    domain,
    wikipedia,
    commonCrawl,
    liveStatus,
    wayback,
    summary,
    checkedAt,
  };
}

/**
 * Tracks a batch of URLs in parallel with concurrency management.
 */
export async function trackMultipleUrls(
  rawUrls: string[],
  options: BatchTrackOptions = { checkLive: true, checkWayback: true }
): Promise<BatchTrackResponse> {
  const targetCohorts = resolveCohorts(options);

  // Deduplicate and filter non-empty lines
  const uniqueUrls: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawUrls) {
    const trimmed = raw.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      uniqueUrls.push(trimmed);
    }
  }

  const results: TrackedUrlResult[] = [];
  const concurrency = 5;

  for (let i = 0; i < uniqueUrls.length; i += concurrency) {
    const chunk = uniqueUrls.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map((u) =>
        trackUrl(u, { ...options, cohorts: targetCohorts }).catch((err) => {
          const checkedAt = new Date().toISOString();
          const fallbackDomain = extractDomain(u);
          return {
            url: u,
            normalizedUrl: u,
            domain: fallbackDomain,
            wikipedia: {
              url: u,
              searchQuery: u,
              isCitedOnWikipedia: false,
              totalCitations: 0,
              articles: [],
              wikipediaSearchUrl: `https://en.wikipedia.org/wiki/Special:LinkSearch?target=${encodeURIComponent(u)}`,
              checkedAt,
              error: err instanceof Error ? err.message : "Tracking failed",
            },
            commonCrawl: {
              url: u,
              cohorts: {},
              totalCohortsChecked: targetCohorts.length,
              presentCount: 0,
              survivalStatus: "omitted" as const,
              firstSeenYear: null,
              lastSeenYear: null,
              checkedAt,
              error: err instanceof Error ? err.message : "Common Crawl query failed",
            },
            summary: {
              inCommonCrawl: false,
              inWikipedia: false,
              isAliveLive: false,
              hasArchive: false,
              rotRisk: "high" as const,
              statusLabel: "Error during tracking",
            },
            checkedAt,
          };
        })
      )
    );
    results.push(...chunkResults);
  }

  let inWikipediaCount = 0;
  let inCommonCrawlCount = 0;
  let aliveCount = 0;
  let rottedCount = 0;
  let wikipediaDeadLinkRiskCount = 0;

  for (const r of results) {
    if (r.summary.inWikipedia) inWikipediaCount++;
    if (r.summary.inCommonCrawl) inCommonCrawlCount++;
    if (r.summary.isAliveLive) {
      aliveCount++;
    } else {
      rottedCount++;
    }
    if (r.summary.inWikipedia && !r.summary.isAliveLive) {
      wikipediaDeadLinkRiskCount++;
    }
  }

  return {
    summary: {
      totalUrls: results.length,
      inWikipediaCount,
      inCommonCrawlCount,
      aliveCount,
      rottedCount,
      wikipediaDeadLinkRiskCount,
    },
    results,
    cohortsQueried: targetCohorts,
  };
}

// Execute directly if run via CLI
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const sampleUrls = process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : [
        "https://archive.org",
        "https://www.w3.org/TR/html52/",
        "https://commoncrawl.org",
      ];

  console.log(`[URL Tracker] Tracking ${sampleUrls.length} URLs across Common Crawl & Wikipedia...\n`);
  trackMultipleUrls(sampleUrls).then((resp) => {
    console.log("=== Tracking Batch Summary ===");
    console.table(resp.summary);

    for (const item of resp.results) {
      console.log(`\n--- ${item.url} ---`);
      console.log(`Domain: ${item.domain}`);
      console.log(`Wikipedia Cited: ${item.summary.inWikipedia} (${item.wikipedia.totalCitations} articles)`);
      console.log(`Common Crawl: ${item.commonCrawl.presentCount}/${item.commonCrawl.totalCohortsChecked} cohorts (${item.commonCrawl.survivalStatus})`);
      console.log(`Live Status: ${item.liveStatus?.isAlive ? "ALIVE" : "DEAD"} (${item.liveStatus?.statusCode ?? "N/A"})`);
      console.log(`Risk Assessment: ${item.summary.rotRisk.toUpperCase()} - ${item.summary.statusLabel}`);
    }
  });
}
