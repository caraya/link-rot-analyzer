# Link Rot Analyzer Specifications

## Objective

The objective of the Link Rot Analyzer is to identify and analyze the decay of hyperlinks over time, particularly focusing on historical web crawls. The tool aims to sample URLs from historical crawl cohorts and evaluate link survival/rot by checking whether URLs present in earlier crawl snapshots continue to appear as live (status 200) across subsequent historical web crawls.

## Features

* Sampling URLs from historical web crawls based on time-based cohorts.
* Cross-cohort availability evaluation: determining URL persistence across sequential historical crawl indexes.
* Targeted on-demand live HTTP verification for individual URLs.
* Standalone Wayback Machine URL Inspector: querying Internet Archive availability, snapshot histories, and fallback links for *any* arbitrary URL (whether part of a cohort or independently submitted for research).
* Analyzing the distribution and decay patterns of link rot over historical timeframes.
* Generating structured reports and summaries of historical link rot statistics.

## Methodology

1. **Collection Discovery**: Fetch `https://index.commoncrawl.org/collinfo.json` to discover available historical web crawl index collections and their respective CDX API endpoints (e.g. `https://index.commoncrawl.org/CC-MAIN-2018-17-index`).
2. **URL Sampling & Frozen Baseline**: Query Common Crawl CDX APIs across target historical cohorts to extract a representative baseline dataset of URLs. Freeze and store this dataset (`historical_sample.json`) to serve as the benchmark for cross-cohort analysis.
3. **Cross-Cohort Historical Check**: Evaluate bulk historical availability by querying Common Crawl CDX index endpoints for subsequent crawl snapshots (e.g. checking 2018 sample URLs against 2021 and 2024 crawl CDX APIs) to verify whether URLs returned HTTP 200 status.
4. **On-Demand Targeted Live Verification**: Provide an option to run live HTTP status checks for single URLs when requested by the user, enabling real-time status verification without mass network overhead.
5. **Standalone Wayback Machine & URL Research Module**: Query Internet Archive's Availability API (`https://archive.org/wayback/available?url=...`) and CDX API on demand for *any* individual URL (including custom non-cohort URLs) to fetch first/last archived dates, snapshot counts, and direct links to preserved copies.
6. **Data Analysis**: Aggregate and analyze cross-cohort presence, targeted live status, and archival availability to identify decay rates and mitigation options over historical periods.
7. **Reporting**: Save analyzed cross-cohort data and generate reports for insights into link rot velocity over time.
8. **Iteration and Refinement**: Refine cohort selection, query strategies, and detection criteria based on historical analysis results.
9. **Create a Web UI**: Develop a web-based user interface to visualize historical link rot trends, allowing users to inspect cohort URLs or input custom URLs to trigger live status checks and view/access Wayback Machine archive histories.

## The Crawler

The crawler component of the Link Rot Analyzer is responsible for querying historical web crawl index data and providing targeted single-URL verification. It fetches `https://index.commoncrawl.org/collinfo.json` to inspect available crawl collections and queries Common Crawl CDX index APIs directly over HTTPS, ensuring simple, unauthenticated, and reliable access to crawl metadata without requiring AWS credentials or local Parquet file configurations.

The crawler constructs cohort queries to sample initial URLs and executes multi-cohort CDX index queries against subsequent crawl snapshots to test historical presence and status. Additionally, it provides a lightweight live verifier module for targeted, single-URL status checks on demand.

It is designed to be modular and configurable, allowing researchers to define different cohort ranges, sample sizes, and output formats.

## The UI

The user interface (UI) component of the Link Rot Analyzer provides a React-based web platform (built and bundled using Vite) for visualizing and interacting with the results of the link rot analysis. It allows users to explore trends, filter data by cohorts or time periods, and access detailed reports on the historical persistence of sampled URLs across crawl years.

The UI presents key metrics, interactive charts (built directly with D3.js or via React D3 component integrations), and tabular data summarizing link survival across historical crawls. It allows researchers to drill down into cohort URLs or enter any custom URL to inspect historical presence, perform targeted live HTTP checks, and view Internet Archive Wayback Machine snapshot availability and fallback links.

Additionally, the UI supports exporting data and visualizations for offline analysis and reporting.

## Concerns & Solutions

* **Sampling Consistency & Network Impact**: Bulk live HTTP probing across thousands of external URLs risks rate-limiting, IP blocks, and high network overhead. To eliminate bulk network impact and maintain consistency:
  1. **Cross-Cohort Analysis**: Historical rot is evaluated offline against sequential Common Crawl CDX index endpoints discovered via `https://index.commoncrawl.org/collinfo.json`.
  2. **Frozen Baseline**: The crawler samples from an initial Common Crawl cohort and saves the result to a canonical baseline dataset on disk (`historical_sample.json`).
  3. **Targeted Live & Wayback Checking**: Live HTTP verification and Wayback Machine lookups are strictly opt-in on-demand operations for single URLs (cohort or custom user-submitted URLs) in the UI or CLI, keeping network impact minimal and controlled.

* **Status Classification & Link Rot Criteria**:
  HTTP status codes strictly govern whether a URL is considered **ALIVE** or **DEAD (Rotted)**:
  1. **HTTP 0 / Network Errors**: Any network-level failures or unreachable hosts are treated as **DEAD (Rotted)** until verified otherwise.
  2. If all three of the crawls return network errors, 404, or other unreachable statuses, the URL is considered **DEAD (Rotted)** until verified otherwise.
  3. If the latest crawl returns a successful status (200/304) while previous crawls indicate errors or 404s, the URL is considered **ALIVE** unless subsequent live verification proves otherwise.
  4. If the latest crawl returns an error or 404 while previous crawls indicate success, the URL is considered **DEAD (Rotted)** unless subsequent live verification proves otherwise.
  5. **HTTP 404 Not Found / 410 Gone**: Explicitly **DEAD (Rotted)**. Any live URL returning 404 (such as `http://www.mit.edu/activities/safe/data/summary.html`) is confirmed as link rot. The system flags the link as dead and triggers the Wayback Machine research module to find archived fallback copies.
  6. **HTTP 200 OK / 304 Not Modified**: **ALIVE**.
  7. **HTTP 301 / 302 Redirects**: Followed automatically to the destination URL. If the final destination returns 200/304, the link is **ALIVE**; if it resolves to 404, the link is **DEAD**.
  8. **Crawl Partition Omissions**: If a URL is absent in a specific historical Common Crawl index partition (e.g. omitted during crawl sampling), the system cross-checks it against live status or other cohorts to determine if it was merely omitted or genuinely dead.

* **Handling False Positives (Historical Absence vs. True Link Decay)**:
  False positives in raw crawl datasets stem from:
  1. **HTTP to HTTPS Migration**: Sites migrating from `http://` to `https://` cause exact-string query misses in un-normalized index lookups.
  2. **Crawl Coverage & Partition Limits**: Common Crawl samples a subset of the web per monthly run. Omission from a specific crawl partition does not prove site death on its own.
  3. **Transient Outages & Dynamic Routing**: Temporary server errors or repository ref changes (such as `https://github.com/01org/rib/commit/master` returning 404 during a 2021 crawl sweep due to ref updates or temporary rate limits, but returning `200 OK` live today).

  **System Reconciliations for False Positives**:
  * **Live Verification Supersedes Historical Crawl 404s**: Real-time HTTP checks (`HEAD`/`GET` with redirect-following) reconcile historical crawl data. If a URL returned `404 Not Found` or was missing in a historical crawl (e.g. `https://github.com/01org/rib/commit/master`), but returns `200 OK` on live inspection today, it is classified as **"Live Today / Transient Historical Outage"**, NOT active link rot. Conversely, if live status returns `404 Not Found` today, link rot is confirmed.
  * **URL Normalization**: Canonicalizing protocol schemes (`http` / `https`), trailing slashes, and hostnames (`www.` prefix) during index lookups.
  * **Dual-Status UI Representation**: Explicitly distinguishing **"Historical Crawl Snapshot Status"** from **"Current Real-Time Status"** so researchers can see the full timeline without mistaking past transient 404s for current link rot.

## Proposed Build Process

The application will be constructed in incremental, testable phases:

### Phase 1: Collection Discovery & Baseline Sampler

* Fetch collection definitions dynamically from `https://index.commoncrawl.org/collinfo.json`.
* Query Common Crawl CDX index APIs directly to construct and persist `historical_sample.json`.
* Add baseline persistence checks to automatically reload `historical_sample.json` on subsequent runs.

### Phase 2: Cross-Cohort Analysis Engine

* Query Common Crawl CDX index endpoints across target crawl years to evaluate baseline URL status history.
* Generate a structured output dataset (`link_rot_analysis.json`) recording each URL's status history across crawl cohorts (e.g. `2018: 200`, `2021: 200`, `2024: missing/404`).

### Phase 3: Targeted Single-URL Live Verifier & Wayback Research Tool

* Implement a lightweight verifier module (`src/live-verifier.ts`) that executes an on-demand `HEAD`/`GET` HTTP request for a single specified URL.
* Support HTTP status detection, redirect following, and error classification (`ETIMEDOUT`, `ENOTFOUND`, `404`, etc.).
* Integrate the Internet Archive Wayback Machine Availability & CDX APIs (`src/wayback-client.ts`) as a standalone research tool capable of analyzing *any* URL (cohort or custom):
  * Most recent archived snapshot URL and timestamp.
  * First archived snapshot timestamp and total snapshot counts over time.
  * Direct fallback links to preserved web pages for rotted or broken URLs.

### Phase 4: Local API / Data Aggregator

* Create an API service or export utility (`src/server.ts` or CLI export script) that surfaces:
  * Global link rot metrics (decay percentage over time, TLD survival rates).
  * Domain-level aggregation and historical cohort comparisons.
  * An endpoint/handler to trigger targeted live HTTP verification and Wayback Machine snapshot lookups for single URLs (supporting cohort drill-downs and custom user input URLs).

### Phase 5: React Web UI

* Scaffold a React SPA in `ui/` or `frontend/` powered by Vite for fast development, bundling, and hot module replacement (HMR).
* Build interactive visual dashboards using **D3 directly** (with React `useRef`/`useEffect` hooks) or via a **React D3 component library**:
  * **Overview Charts**: Survival curves, decay rate trends, and HTTP status distributions across crawl years rendered using D3.
  * **URL Explorer & Filter**: Searchable table with filtering by domain, cohort, and status.
  * **Single URL Research Tool & Drill-Down**: Interactive inspector that lets users select a cohort URL or paste any arbitrary URL to trigger live status checks and view direct Wayback Machine archive histories and preserved snapshots.
* Support exporting visual reports and JSON/CSV datasets.
