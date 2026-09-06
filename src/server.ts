import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeCrossCohortPersistence,
  type AnalysisResult,
  type HistoricalUrlAnalysis,
} from "./analyzer.js";
import { inspectUrl, type UrlInspectionReport } from "./inspector.js";

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

const PORT = Number(process.env.PORT) || 3000;

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  setCorsHeaders(res);
  res.setHeader("Content-Type", "application/json");
  res.statusCode = statusCode;
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, statusCode: number, message: string): void {
  sendJson(res, statusCode, { error: message });
}

function parseUrlHostname(urlString: string): { domain: string; tld: string } {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();
    const parts = hostname.split(".");
    const tld = parts.length > 1 ? `.${parts[parts.length - 1]}` : ".unknown";
    return { domain: hostname, tld };
  } catch {
    return { domain: "unknown", tld: ".unknown" };
  }
}

export function computeTldMetrics(urls: HistoricalUrlAnalysis[]): TldMetric[] {
  const map = new Map<string, { total: number; alive: number; rotted: number }>();

  for (const item of urls) {
    const { tld } = parseUrlHostname(item.url);
    const stats = map.get(tld) || { total: 0, alive: 0, rotted: 0 };
    stats.total++;
    if (item.isCurrentlyRotted) {
      stats.rotted++;
    } else {
      stats.alive++;
    }
    map.set(tld, stats);
  }

  const result: TldMetric[] = [];
  for (const [tld, stats] of map.entries()) {
    result.push({
      tld,
      total: stats.total,
      alive: stats.alive,
      rotted: stats.rotted,
      survivalRate: Math.round((stats.alive / stats.total) * 10000) / 100,
    });
  }

  return result.sort((a, b) => b.total - a.total);
}

export function computeDomainMetrics(urls: HistoricalUrlAnalysis[]): DomainMetric[] {
  const map = new Map<string, { total: number; alive: number; rotted: number }>();

  for (const item of urls) {
    const { domain } = parseUrlHostname(item.url);
    const stats = map.get(domain) || { total: 0, alive: 0, rotted: 0 };
    stats.total++;
    if (item.isCurrentlyRotted) {
      stats.rotted++;
    } else {
      stats.alive++;
    }
    map.set(domain, stats);
  }

  const result: DomainMetric[] = [];
  for (const [domain, stats] of map.entries()) {
    result.push({
      domain,
      total: stats.total,
      alive: stats.alive,
      rotted: stats.rotted,
      survivalRate: Math.round((stats.alive / stats.total) * 10000) / 100,
    });
  }

  return result.sort((a, b) => b.total - a.total);
}

async function parseRequestBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error("Request payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", (err) => reject(err));
  });
}

export function createServer(getAnalysisData: () => Promise<AnalysisResult>) {
  return http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = reqUrl.pathname;

    try {
      // Health Check
      if (pathname === "/api/health" && req.method === "GET") {
        sendJson(res, 200, { status: "ok", timestamp: new Date().toISOString() });
        return;
      }

      // Overall Analysis Summary & High-Level Metrics
      if ((pathname === "/api/summary" || pathname === "/api/analysis") && req.method === "GET") {
        const analysis = await getAnalysisData();
        const tldMetrics = computeTldMetrics(analysis.urls);
        const topDomains = computeDomainMetrics(analysis.urls).slice(0, 20);

        sendJson(res, 200, {
          summary: analysis.summary,
          tldMetrics: tldMetrics.slice(0, 15),
          topDomains,
        });
        return;
      }

      // TLD Metrics
      if (pathname === "/api/tlds" && req.method === "GET") {
        const analysis = await getAnalysisData();
        const tldMetrics = computeTldMetrics(analysis.urls);
        sendJson(res, 200, { tlds: tldMetrics });
        return;
      }

      // Domain Metrics
      if (pathname === "/api/domains" && req.method === "GET") {
        const analysis = await getAnalysisData();
        const domainMetrics = computeDomainMetrics(analysis.urls);
        const limit = Number(reqUrl.searchParams.get("limit")) || 50;
        sendJson(res, 200, { domains: domainMetrics.slice(0, limit), totalDomains: domainMetrics.length });
        return;
      }

      // Paginated & Filterable URLs Explorer
      if (pathname === "/api/urls" && req.method === "GET") {
        const analysis = await getAnalysisData();

        const search = (reqUrl.searchParams.get("search") || "").toLowerCase().trim();
        const statusFilter = reqUrl.searchParams.get("status"); // "alive" | "rotted" | "all"
        const cohortFilter = Number(reqUrl.searchParams.get("cohort")); // e.g. 2018, 2021, 2024
        const page = Math.max(1, Number(reqUrl.searchParams.get("page")) || 1);
        const limit = Math.max(1, Math.min(200, Number(reqUrl.searchParams.get("limit")) || 50));

        let filtered = analysis.urls;

        if (search) {
          filtered = filtered.filter((u) => u.url.toLowerCase().includes(search));
        }

        if (statusFilter === "alive") {
          filtered = filtered.filter((u) => !u.isCurrentlyRotted);
        } else if (statusFilter === "rotted") {
          filtered = filtered.filter((u) => u.isCurrentlyRotted);
        }

        if (cohortFilter) {
          filtered = filtered.filter(
            (u) =>
              u.initialCrawlYear === cohortFilter ||
              (u.statusByYear[cohortFilter]?.fetchStatus !== null &&
                u.statusByYear[cohortFilter]?.fetchStatus !== undefined)
          );
        }

        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / limit) || 1;
        const startIndex = (page - 1) * limit;
        const items = filtered.slice(startIndex, startIndex + limit);

        sendJson(res, 200, {
          pagination: {
            page,
            limit,
            totalItems,
            totalPages,
          },
          urls: items,
        });
        return;
      }

      // Single-URL Live HTTP & Wayback Machine Inspection
      if (pathname === "/api/inspect") {
        let targetUrl = reqUrl.searchParams.get("url");

        if (req.method === "POST") {
          const body = await parseRequestBody<{ url?: string }>(req);
          if (body.url) {
            targetUrl = body.url;
          }
        }

        if (!targetUrl) {
          sendError(res, 400, "Missing required query param or body field 'url'");
          return;
        }

        const report: UrlInspectionReport = await inspectUrl(targetUrl);
        sendJson(res, 200, report);
        return;
      }

      // Re-trigger Cross-Cohort Analysis
      if (pathname === "/api/reanalyze" && req.method === "POST") {
        console.log("[Server] Re-analysis requested via API...");
        const newAnalysis = await analyzeCrossCohortPersistence(
          "historical_sample.json",
          "link_rot_analysis.json",
          true
        );
        sendJson(res, 200, { message: "Re-analysis complete", summary: newAnalysis.summary });
        return;
      }

      // Serve static frontend assets if built, or fallback to index.html
      if (!pathname.startsWith("/api/")) {
        const distDir = path.resolve(process.cwd(), "dist", "frontend");
        let staticPath = path.join(distDir, pathname === "/" ? "index.html" : pathname);

        try {
          const stats = await fs.stat(staticPath);
          if (stats.isDirectory()) {
            staticPath = path.join(staticPath, "index.html");
          }
        } catch {
          // Fallback to index.html for SPA routing
          staticPath = path.join(distDir, "index.html");
        }

        try {
          const content = await fs.readFile(staticPath);
          const ext = path.extname(staticPath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            ".html": "text/html; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
            ".woff2": "font/woff2",
          };
          res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
          res.statusCode = 200;
          res.end(content);
          return;
        } catch {
          // If frontend hasn't been built yet
        }
      }

      sendError(res, 404, `Endpoint not found: ${pathname}`);
    } catch (err: unknown) {
      console.error(`[Server] Error processing request ${pathname}:`, err);
      sendError(res, 500, err instanceof Error ? err.message : "Internal Server Error");
    }
  });
}

export async function startServer(port = PORT): Promise<http.Server> {
  const getAnalysisData = () => analyzeCrossCohortPersistence();
  const server = createServer(getAnalysisData);

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`[Phase 4] Link Rot Analyzer Local API Server running on http://localhost:${port}`);
      console.log(`[Phase 4] API Endpoints:`);
      console.log(`  - GET  http://localhost:${port}/api/health`);
      console.log(`  - GET  http://localhost:${port}/api/summary`);
      console.log(`  - GET  http://localhost:${port}/api/urls?page=1&limit=50&status=rotted&search=example`);
      console.log(`  - GET  http://localhost:${port}/api/domains`);
      console.log(`  - GET  http://localhost:${port}/api/tlds`);
      console.log(`  - GET  http://localhost:${port}/api/inspect?url=https://example.com`);
      console.log(`  - POST http://localhost:${port}/api/inspect`);
      console.log(`  - POST http://localhost:${port}/api/reanalyze`);
      resolve(server);
    });
  });
}

// Execute server directly if called from CLI
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  startServer();
}