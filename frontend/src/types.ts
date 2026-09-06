export interface CohortStatus {
  crawlId: string;
  fetchStatus: number | null;
  fetchTime?: string;
}

export interface HistoricalUrlAnalysis {
  url: string;
  initialCrawlYear: number;
  initialCrawlId: string;
  statusByYear: Record<number, CohortStatus>;
  isCurrentlyRotted: boolean;
}

export interface AnalysisSummary {
  totalAnalyzed: number;
  cohortYears: number[];
  survivalByYear: Record<number, { total: number; alive: number; survivalRate: number }>;
  rotRatePercentage: number;
}

export interface TldMetric {
  tld: string;
  total: number;
  alive: number;
  rotted: number;
  survivalRate: number;
}

export interface DomainMetric {
  domain: string;
  total: number;
  alive: number;
  rotted: number;
  survivalRate: number;
}

export interface SummaryResponse {
  summary: AnalysisSummary;
  tldMetrics: TldMetric[];
  topDomains: DomainMetric[];
}

export interface UrlsResponse {
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  urls: HistoricalUrlAnalysis[];
}

export interface LiveVerificationResult {
  url: string;
  statusCode: number | null;
  statusText: string | null;
  finalUrl: string;
  isAlive: boolean;
  contentType: string | null;
  responseTimeMs: number;
  error: string | null;
  checkedAt: string;
}

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

export interface UrlInspectionReport {
  url: string;
  liveStatus: LiveVerificationResult;
  wayback: WaybackResult;
  recommendation: string;
}