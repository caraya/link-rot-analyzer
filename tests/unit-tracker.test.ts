import assert from "node:assert/strict";
import { normalizeUrlForWikipedia, searchWikipediaUrlUsage } from "../src/wikipedia-client.js";
import {
  extractDomain,
  computeTrackedSummary,
  trackCommonCrawlUrl,
  trackUrl,
  trackMultipleUrls,
} from "../src/url-tracker.js";

async function runTests() {
  console.log("▶ Running Unit Tests for URL Tracker & Wikipedia Client...\n");

  // 1. normalizeUrlForWikipedia
  console.log("Test 1: normalizeUrlForWikipedia removes protocols and fragments correctly");
  const norm1 = normalizeUrlForWikipedia("https://en.wikipedia.org/wiki/Link_rot#History");
  assert.equal(norm1.cleanQuery, "en.wikipedia.org/wiki/Link_rot");
  assert.equal(norm1.protocol, "https");

  const norm2 = normalizeUrlForWikipedia("http://example.com/some/path?query=1");
  assert.equal(norm2.cleanQuery, "example.com/some/path?query=1");
  assert.equal(norm2.protocol, "http");

  const norm3 = normalizeUrlForWikipedia("example.org");
  assert.equal(norm3.cleanQuery, "example.org");
  assert.equal(norm3.protocol, null);
  console.log("  ✔ Passed\n");

  // 2. extractDomain
  console.log("Test 2: extractDomain extracts clean hostnames");
  assert.equal(extractDomain("https://WWW.Archive.Org/web"), "www.archive.org");
  assert.equal(extractDomain("developer.mozilla.org/en-US"), "developer.mozilla.org");
  assert.equal(extractDomain("http://example.com:8080/test"), "example.com");
  console.log("  ✔ Passed\n");

  // 3. computeTrackedSummary logic & risk assessment
  console.log("Test 3: computeTrackedSummary classifies risks accurately");
  // Case A: Critical risk: Cited on Wikipedia, but dead live
  const criticalSummary = computeTrackedSummary(
    {
      url: "https://dead-example.com",
      cohorts: {},
      totalCohortsChecked: 3,
      presentCount: 2,
      survivalStatus: "rotted",
      firstSeenYear: 2018,
      lastSeenYear: 2021,
      checkedAt: new Date().toISOString(),
      error: null,
    },
    {
      url: "https://dead-example.com",
      searchQuery: "dead-example.com",
      isCitedOnWikipedia: true,
      totalCitations: 3,
      articles: [],
      wikipediaSearchUrl: "https://en.wikipedia.org/wiki/Special:LinkSearch?target=dead-example.com",
      checkedAt: new Date().toISOString(),
      error: null,
    },
    {
      url: "https://dead-example.com",
      statusCode: 404,
      statusText: "Not Found",
      finalUrl: "https://dead-example.com",
      isAlive: false,
      contentType: null,
      responseTimeMs: 120,
      error: "HTTP 404 Not Found",
      checkedAt: new Date().toISOString(),
    }
  );
  assert.equal(criticalSummary.rotRisk, "critical");
  assert.equal(criticalSummary.inWikipedia, true);
  assert.equal(criticalSummary.isAliveLive, false);

  // Case B: Healthy: Active live and on Wikipedia
  const healthySummary = computeTrackedSummary(
    {
      url: "https://archive.org",
      cohorts: {},
      totalCohortsChecked: 3,
      presentCount: 3,
      survivalStatus: "persisted",
      firstSeenYear: 2018,
      lastSeenYear: 2024,
      checkedAt: new Date().toISOString(),
      error: null,
    },
    {
      url: "https://archive.org",
      searchQuery: "archive.org",
      isCitedOnWikipedia: true,
      totalCitations: 5,
      articles: [],
      wikipediaSearchUrl: "https://en.wikipedia.org/wiki/Special:LinkSearch?target=archive.org",
      checkedAt: new Date().toISOString(),
      error: null,
    },
    {
      url: "https://archive.org",
      statusCode: 200,
      statusText: "OK",
      finalUrl: "https://archive.org",
      isAlive: true,
      contentType: "text/html",
      responseTimeMs: 80,
      error: null,
      checkedAt: new Date().toISOString(),
    }
  );
  assert.equal(healthySummary.rotRisk, "low");
  assert.equal(healthySummary.inWikipedia, true);
  assert.equal(healthySummary.isAliveLive, true);
  console.log("  ✔ Passed\n");

  // 4. searchWikipediaUrlUsage
  console.log("Test 4: searchWikipediaUrlUsage returns structured results");
  const wikiRes = await searchWikipediaUrlUsage("https://archive.org", 5);
  assert.equal(wikiRes.isCitedOnWikipedia, true);
  assert.ok(wikiRes.totalCitations > 0);
  assert.ok(wikiRes.articles.length > 0);
  assert.ok(wikiRes.wikipediaSearchUrl.includes("Special:LinkSearch"));
  console.log(`  ✔ Found ${wikiRes.totalCitations} Wikipedia articles citing archive.org\n`);

  // 5. trackCommonCrawlUrl
  console.log("Test 5: trackCommonCrawlUrl evaluates cohorts");
  const ccRes = await trackCommonCrawlUrl("https://archive.org");
  assert.equal(ccRes.totalCohortsChecked, 3);
  assert.ok(ccRes.presentCount > 0);
  assert.ok(ccRes.cohorts[2018] !== undefined);
  assert.ok(ccRes.cohorts[2021] !== undefined);
  assert.ok(ccRes.cohorts[2024] !== undefined);
  console.log("  ✔ Passed\n");

  // 6. trackMultipleUrls batch tracking
  console.log("Test 6: trackMultipleUrls tracks batch URLs and computes metrics");
  const batchRes = await trackMultipleUrls(
    [
      "https://archive.org",
      "https://w3.org/TR/html52/",
    ],
    { checkLive: false, checkWayback: false }
  );

  assert.equal(batchRes.summary.totalUrls, 2);
  assert.ok(batchRes.summary.inWikipediaCount >= 1);
  assert.ok(batchRes.summary.inCommonCrawlCount >= 1);
  assert.equal(batchRes.results.length, 2);
  assert.equal(batchRes.cohortsQueried.length, 3);
  console.log("  ✔ Batch tracking successfully processed all URLs\n");

  // 7. resolveCohorts & Configurable Historical Depth (how far back to go)
  console.log("Test 7: resolveCohorts handles configurable startYear, stepYears, and custom cohorts");
  const { resolveCohorts, ALL_COMMON_CRAWL_COHORTS, COHORT_PRESETS } = await import("../src/crawler.js");

  // Default: 2018, 2021, 2024
  const defCohorts = resolveCohorts();
  assert.deepEqual(defCohorts.map((c) => c.year), [2018, 2021, 2024]);

  // Go all the way back to 2013 (start of Common Crawl CDX) with step 3
  const deepCohorts = resolveCohorts({ startYear: 2013, stepYears: 3 });
  assert.deepEqual(deepCohorts.map((c) => c.year), [2013, 2016, 2019, 2022, 2024]);
  assert.equal(deepCohorts[0]?.crawlId, "CC-MAIN-2013-20");

  // Go back to 2014 with step 2
  const decadeCohorts = resolveCohorts({ startYear: 2014, stepYears: 2 });
  assert.deepEqual(decadeCohorts.map((c) => c.year), [2014, 2016, 2018, 2020, 2022, 2024]);

  // Custom cohort years list
  const customCohorts = resolveCohorts({ cohortYears: [2015, 2019, 2023] });
  assert.deepEqual(customCohorts.map((c) => c.year), [2015, 2019, 2023]);

  // Presets validity
  assert.ok(COHORT_PRESETS.length >= 4);
  assert.ok(ALL_COMMON_CRAWL_COHORTS.length >= 12);
  console.log(`  ✔ Successfully validated ${ALL_COMMON_CRAWL_COHORTS.length} historical cohorts from 2013 to 2025\n`);

  // 8. Track URLs with configurable startYear (going back to 2013)
  console.log("Test 8: trackMultipleUrls with startYear: 2013 (full depth)");
  const fullDepthTrack = await trackMultipleUrls(
    ["https://archive.org"],
    { startYear: 2013, stepYears: 3, checkLive: false, checkWayback: false }
  );
  assert.equal(fullDepthTrack.results.length, 1);
  assert.equal(fullDepthTrack.cohortsQueried.length, 5);
  assert.ok(fullDepthTrack.results[0]?.commonCrawl.cohorts[2013] !== undefined);
  assert.ok(fullDepthTrack.results[0]?.commonCrawl.cohorts[2024] !== undefined);
  console.log("  ✔ Successfully tracked URL across 5 historical cohorts dating back to 2013\n");

  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
