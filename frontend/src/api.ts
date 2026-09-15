import type {
  SummaryResponse,
  UrlsResponse,
  UrlInspectionReport,
  BatchTrackResponse,
  WikipediaTrackingResult,
  CohortsResponse,
  CohortConfig,
} from "./types.js";

const API_BASE = "";

export async function fetchSummary(): Promise<SummaryResponse> {
  const res = await fetch(`${API_BASE}/api/summary`);
  if (!res.ok) {
    throw new Error(`Failed to fetch summary metrics (${res.status})`);
  }
  return res.json();
}

export async function fetchCohorts(): Promise<CohortsResponse> {
  const res = await fetch(`${API_BASE}/api/cohorts`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Common Crawl cohorts catalog (${res.status})`);
  }
  return res.json();
}

export async function fetchUrls(params: {
  page?: number | undefined;
  limit?: number | undefined;
  status?: ("all" | "alive" | "rotted") | undefined;
  cohort?: number | undefined;
  search?: string | undefined;
}): Promise<UrlsResponse> {
  const urlParams = new URLSearchParams();
  if (params.page) urlParams.set("page", String(params.page));
  if (params.limit) urlParams.set("limit", String(params.limit));
  if (params.status && params.status !== "all") urlParams.set("status", params.status);
  if (params.cohort) urlParams.set("cohort", String(params.cohort));
  if (params.search) urlParams.set("search", params.search);

  const res = await fetch(`${API_BASE}/api/urls?${urlParams.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch URLs dataset (${res.status})`);
  }
  return res.json();
}

export async function inspectUrl(targetUrl: string): Promise<UrlInspectionReport> {
  const res = await fetch(`${API_BASE}/api/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: targetUrl }),
  });
  if (!res.ok) {
    throw new Error(`Failed to inspect URL (${res.status})`);
  }
  return res.json();
}

export async function trackUrls(
  urls: string[],
  options?: {
    checkLive?: boolean | undefined;
    checkWayback?: boolean | undefined;
    limitWikipedia?: number | undefined;
    startYear?: number | undefined;
    endYear?: number | undefined;
    stepYears?: number | undefined;
    cohortYears?: number[] | undefined;
    cohorts?: CohortConfig[] | undefined;
  }
): Promise<BatchTrackResponse> {
  const res = await fetch(`${API_BASE}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls, options }),
  });
  if (!res.ok) {
    throw new Error(`Failed to track URLs (${res.status})`);
  }
  return res.json();
}

export async function searchWikipedia(
  targetUrl: string,
  limit = 20
): Promise<WikipediaTrackingResult> {
  const res = await fetch(
    `${API_BASE}/api/wikipedia?url=${encodeURIComponent(targetUrl)}&limit=${limit}`
  );
  if (!res.ok) {
    throw new Error(`Failed to search Wikipedia usage (${res.status})`);
  }
  return res.json();
}

export async function reanalyzeWithCohorts(options?: {
  startYear?: number | undefined;
  endYear?: number | undefined;
  stepYears?: number | undefined;
  cohortYears?: number[] | undefined;
  cohorts?: CohortConfig[] | undefined;
}): Promise<{ message: string; summary: SummaryResponse["summary"] }> {
  const res = await fetch(`${API_BASE}/api/reanalyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options || {}),
  });
  if (!res.ok) {
    throw new Error(`Failed to reanalyze with cohorts (${res.status})`);
  }
  return res.json();
}