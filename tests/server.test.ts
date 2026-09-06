import { test, expect } from "@playwright/test";
import type { Server } from "node:http";
import { createServer, computeTldMetrics, computeDomainMetrics } from "../src/server.js";
import type { AnalysisResult } from "../src/analyzer.js";

const mockAnalysisData: AnalysisResult = {
  summary: {
    totalAnalyzed: 3,
    cohortYears: [2018, 2021, 2024],
    survivalByYear: {
      2018: { total: 3, alive: 3, survivalRate: 100 },
      2021: { total: 3, alive: 2, survivalRate: 66.67 },
      2024: { total: 3, alive: 1, survivalRate: 33.33 },
    },
    rotRatePercentage: 66.67,
  },
  urls: [
    {
      url: "https://example.com/page1",
      initialCrawlYear: 2018,
      initialCrawlId: "CC-MAIN-2018-17",
      statusByYear: {
        2018: { crawlId: "CC-MAIN-2018-17", fetchStatus: 200 },
        2021: { crawlId: "CC-MAIN-2021-21", fetchStatus: 200 },
        2024: { crawlId: "CC-MAIN-2024-18", fetchStatus: 200 },
      },
      isCurrentlyRotted: false,
    },
    {
      url: "https://example.org/about",
      initialCrawlYear: 2018,
      initialCrawlId: "CC-MAIN-2018-17",
      statusByYear: {
        2018: { crawlId: "CC-MAIN-2018-17", fetchStatus: 200 },
        2021: { crawlId: "CC-MAIN-2021-21", fetchStatus: 200 },
        2024: { crawlId: "CC-MAIN-2024-18", fetchStatus: 404 },
      },
      isCurrentlyRotted: true,
    },
    {
      url: "https://example.edu/research",
      initialCrawlYear: 2021,
      initialCrawlId: "CC-MAIN-2021-21",
      statusByYear: {
        2018: { crawlId: "CC-MAIN-2018-17", fetchStatus: null },
        2021: { crawlId: "CC-MAIN-2021-21", fetchStatus: 200 },
        2024: { crawlId: "CC-MAIN-2024-18", fetchStatus: 404 },
      },
      isCurrentlyRotted: true,
    },
  ],
};

let server: Server;
let baseUrl: string;

test.beforeAll(async () => {
  server = createServer(async () => mockAnalysisData);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to get server test port");
  }
  baseUrl = `http://localhost:${address.port}`;
});

test.afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test.describe("Phase 4 API Server Endpoints", () => {
  test("GET /api/health returns 200 and status ok", async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });

  test("GET /api/summary returns overall summary and metrics", async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/summary`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.summary.totalAnalyzed).toBe(3);
    expect(body.summary.rotRatePercentage).toBe(66.67);
    expect(body.tldMetrics).toHaveLength(3);
    expect(body.topDomains).toHaveLength(3);
  });

  test("GET /api/urls supports status filtering", async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/urls?status=rotted`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.pagination.totalItems).toBe(2);
    expect(body.urls).toHaveLength(2);
    expect(body.urls.every((u: { isCurrentlyRotted: boolean }) => u.isCurrentlyRotted)).toBe(true);
  });

  test("GET /api/domains returns computed domain metrics", async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/domains`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.totalDomains).toBe(3);
    expect(body.domains).toHaveLength(3);
  });

  test("computeTldMetrics & computeDomainMetrics helper functions", () => {
    const tlds = computeTldMetrics(mockAnalysisData.urls);
    const orgTld = tlds.find((t) => t.tld === ".org");
    expect(orgTld).toBeDefined();
    expect(orgTld?.survivalRate).toBe(0);

    const comTld = tlds.find((t) => t.tld === ".com");
    expect(comTld).toBeDefined();
    expect(comTld?.survivalRate).toBe(100);

    const domains = computeDomainMetrics(mockAnalysisData.urls);
    expect(domains).toHaveLength(3);
  });
});