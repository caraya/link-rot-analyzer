import { test, expect } from "@playwright/test";
import type { Server } from "node:http";
import { createServer } from "../src/server.js";
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

test.describe("Phase 5 React Web UI Integration", () => {
  test("renders dashboard title, summary cards, and D3 chart SVGs", async ({ page }) => {
    await page.goto(baseUrl);

    // Header & Title
    await expect(page.locator("h1")).toContainText("Link Rot Analyzer");

    // Summary Metric Cards
    await expect(page.getByText("Total Benchmark URLs")).toBeVisible();
    await expect(page.getByText("Overall Link Rot Rate")).toBeVisible();

    // Navigation Tabs
    const overviewTab = page.getByRole("button", { name: /Overview & D3 Charts/i });
    const explorerTab = page.getByRole("button", { name: /URL Explorer/i });
    const inspectorTab = page.getByRole("button", { name: /URL Inspector & Wayback/i });

    await expect(overviewTab).toBeVisible();
    await expect(explorerTab).toBeVisible();
    await expect(inspectorTab).toBeVisible();

    // Verify D3 Chart SVGs rendered
    const chartSvgs = page.locator("svg");
    await expect(chartSvgs.first()).toBeVisible();

    // Test Tab Switching to Explorer
    await explorerTab.click();
    await expect(page.getByText("URL Benchmark Explorer")).toBeVisible();
    await expect(page.getByText("https://example.com/page1")).toBeVisible();

    // Test Tab Switching to Inspector
    await inspectorTab.click();
    await expect(page.getByText("Single URL Inspector & Wayback Research Tool")).toBeVisible();
  });
});