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

1. **Cohort Definition**: Define time-based cohorts representing different historical web crawls (e.g., 2018, 2021, 2024).
2. **URL Sampling & Frozen Baseline**: Generate a canonical baseline dataset of URLs sampled from an initial historical crawl cohort using file-backed DuckDB (`link_rot.duckdb`) and S3-hosted Parquet files. Freeze and store this dataset (`historical_sample.json`) to serve as the benchmark for cross-cohort analysis.
3. **Cross-Cohort Historical Check**: Evaluate bulk historical availability by checking whether the sampled benchmark URLs exist and returned HTTP 200 status in subsequent historical crawl index partitions (e.g. checking 2018 sample URLs against 2021 and 2024 crawl datasets).
4. **On-Demand Targeted Live Verification**: Provide an option to run live HTTP status checks for single URLs when requested by the user, enabling real-time status verification without mass network overhead.
5. **Standalone Wayback Machine & URL Research Module**: Query Internet Archive's Availability API (`https://archive.org/wayback/available?url=...`) and CDX API on demand for *any* individual URL (including custom non-cohort URLs) to fetch first/last archived dates, snapshot counts, and direct links to preserved copies.
6. **Data Analysis**: Aggregate and analyze cross-cohort presence, targeted live status, and archival availability to identify decay rates and mitigation options over historical periods.
7. **Reporting**: Save analyzed cross-cohort data and generate reports for insights into link rot velocity over time.
8. **Iteration and Refinement**: Refine cohort selection, query strategies, and detection criteria based on historical analysis results.
9. **Create a Web UI**: Develop a web-based user interface to visualize historical link rot trends, allowing users to inspect cohort URLs or input custom URLs to trigger live status checks and view/access Wayback Machine archive histories.

## The Crawler

The crawler component of the Link Rot Analyzer is responsible for querying historical web crawl index data and providing targeted single-URL verification. It leverages a file-backed DuckDB engine (`link_rot.duckdb`) to query S3-hosted Parquet files containing Common Crawl index data, ensuring persistent, crash-resilient, and scalable access to large datasets without needing bulk live external HTTP crawling.

The crawler constructs cohort queries to sample initial URLs (using `SELECT setseed(0.42);` for determinism) and executes multi-cohort join/lookup queries against subsequent crawl indexes to test historical presence and status. Additionally, it provides a lightweight live verifier module for targeted, single-URL status checks on demand.

It is designed to be modular and configurable, allowing researchers to define different cohort ranges, sample sizes, and output formats.

## The UI

The user interface (UI) component of the Link Rot Analyzer provides a React-based web platform (built and bundled using Vite) for visualizing and interacting with the results of the link rot analysis. It allows users to explore trends, filter data by cohorts or time periods, and access detailed reports on the historical persistence of sampled URLs across crawl years.

The UI presents key metrics, interactive charts (built directly with D3.js or via React D3 component integrations), and tabular data summarizing link survival across historical crawls. It allows researchers to drill down into cohort URLs or enter any custom URL to inspect historical presence, perform targeted live HTTP checks, and view Internet Archive Wayback Machine snapshot availability and fallback links.

Additionally, the UI supports exporting data and visualizations for offline analysis and reporting.

## Concerns & Solutions

* **Sampling Consistency & Network Impact**: Bulk live HTTP probing across thousands of external URLs risks rate-limiting, IP blocks, and high network overhead. To eliminate bulk network impact and maintain consistency:
  1. **Cross-Cohort Analysis**: Historical rot is evaluated entirely offline/in-database against sequential Common Crawl index snapshots.
  2. **Frozen Baseline**: The crawler samples from an initial Common Crawl cohort with a fixed seed (`SELECT setseed(0.42);`) and saves the result to a canonical baseline dataset on disk (`historical_sample.json`).
  3. **Targeted Live & Wayback Checking**: Live HTTP verification and Wayback Machine lookups are strictly opt-in on-demand operations for single URLs (cohort or custom user-submitted URLs) in the UI or CLI, keeping network impact minimal and controlled.

## Proposed Build Process

The application will be constructed in incremental, testable phases:

### Phase 1: Baseline Sampler & Data Persistence

* Establish the file-backed DuckDB engine (`link_rot.duckdb`) and S3/Parquet reader in [src/crawler.ts](src/crawler.ts).
* Implement deterministic baseline generation using `SELECT setseed(0.42);` to construct `historical_sample.json`.
* Add baseline persistence checks to automatically reload `historical_sample.json` on subsequent runs.

### Phase 2: Cross-Cohort Analysis Engine

* Extend [src/crawler.ts](src/crawler.ts) or create `src/analyzer.ts` to join the frozen baseline dataset against subsequent Common Crawl index Parquet files (e.g., 2021, 2024).
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
