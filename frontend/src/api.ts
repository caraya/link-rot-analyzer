import type {
  SummaryResponse,
  UrlsResponse,
  UrlInspectionReport,
} from "./types.js";

const API_BASE = "";

export async function fetchSummary(): Promise<SummaryResponse> {
  const res = await fetch(`${API_BASE}/api/summary`);
  if (!res.ok) {
    throw new Error(`Failed to fetch summary metrics (${res.status})`);
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