import assert from "node:assert/strict";
import { createServer } from "../src/server.js";
import type { AnalysisResult } from "../src/analyzer.js";

const mockAnalysisData: AnalysisResult = {
  summary: {
    totalAnalyzed: 2,
    cohortYears: [2018, 2021, 2024],
    survivalByYear: {
      2018: { total: 2, alive: 2, survivalRate: 100 },
      2021: { total: 2, alive: 1, survivalRate: 50 },
      2024: { total: 2, alive: 1, survivalRate: 50 },
    },
    rotRatePercentage: 50,
  },
  urls: [
    {
      url: "https://archive.org",
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
      url: "https://example.com/dead-path",
      initialCrawlYear: 2018,
      initialCrawlId: "CC-MAIN-2018-17",
      statusByYear: {
        2018: { crawlId: "CC-MAIN-2018-17", fetchStatus: 200 },
        2021: { crawlId: "CC-MAIN-2021-21", fetchStatus: 404 },
        2024: { crawlId: "CC-MAIN-2024-18", fetchStatus: 404 },
      },
      isCurrentlyRotted: true,
    },
  ],
};

async function runServerTests() {
  console.log("▶ Running Integration Tests for Server API...\n");

  const server = createServer(async () => mockAnalysisData);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to obtain server address");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Health check
    console.log("Test 1: GET /api/health");
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthBody = await healthRes.json();
    assert.equal(healthBody.status, "ok");
    console.log("  ✔ Passed\n");

    // 2. Summary
    console.log("Test 2: GET /api/summary");
    const summaryRes = await fetch(`${baseUrl}/api/summary`);
    assert.equal(summaryRes.status, 200);
    const summaryBody = await summaryRes.json();
    assert.equal(summaryBody.summary.totalAnalyzed, 2);
    console.log("  ✔ Passed\n");

    // 3. POST /api/track
    console.log("Test 3: POST /api/track (batch tracking across Common Crawl & Wikipedia)");
    const trackRes = await fetch(`${baseUrl}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: ["https://archive.org", "https://w3.org/TR/html52/"],
        options: { checkLive: false, checkWayback: false },
      }),
    });
    assert.equal(trackRes.status, 200);
    const trackBody = await trackRes.json();
    assert.equal(trackBody.summary.totalUrls, 2);
    assert.equal(trackBody.results.length, 2);
    assert.equal(trackBody.results[0].domain, "archive.org");
    assert.ok(trackBody.results[0].wikipedia !== undefined);
    assert.ok(trackBody.results[0].commonCrawl !== undefined);
    console.log("  ✔ Passed\n");

    // 4. GET /api/track
    console.log("Test 4: GET /api/track?url=https://archive.org");
    const trackGetRes = await fetch(`${baseUrl}/api/track?url=https://archive.org`);
    assert.equal(trackGetRes.status, 200);
    const trackGetBody = await trackGetRes.json();
    assert.equal(trackGetBody.summary.totalUrls, 1);
    console.log("  ✔ Passed\n");

    // 5. GET /api/wikipedia
    console.log("Test 5: GET /api/wikipedia?url=https://archive.org");
    const wikiRes = await fetch(`${baseUrl}/api/wikipedia?url=https://archive.org&limit=5`);
    assert.equal(wikiRes.status, 200);
    const wikiBody = await wikiRes.json();
    assert.equal(wikiBody.url, "https://archive.org");
    assert.equal(wikiBody.isCitedOnWikipedia, true);
    console.log("  ✔ Passed\n");

    console.log("🎉 ALL SERVER INTEGRATION TESTS PASSED!");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

runServerTests().catch((err) => {
  console.error("❌ Server test failed:", err);
  process.exit(1);
});
