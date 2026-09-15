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

export interface WikipediaArticleMatch {
  pageId: number;
  title: string;
  articleUrl: string;
  matchedUrl: string;
}

export interface WikipediaTrackingResult {
  url: string;
  searchQuery: string;
  isCitedOnWikipedia: boolean;
  totalCitations: number;
  articles: WikipediaArticleMatch[];
  wikipediaSearchUrl: string;
  checkedAt: string;
  error: string | null;
}

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

export interface CohortConfig {
  year: number;
  crawlId: string;
  name?: string | undefined;
}

export interface CohortPreset {
  id: string;
  name: string;
  description: string;
  startYear: number;
  years: number[];
}

export interface CohortsResponse {
  availableCohorts: CohortConfig[];
  presets: CohortPreset[];
  currentCohorts: CohortConfig[];
  earliestYear: number;
  latestYear: number;
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