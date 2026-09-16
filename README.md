# Link Rot Analyzer

A modular research and auditing platform to quantify, analyze, and track the decay of hyperlinks across historical web crawl snapshots (Common Crawl), real-time live HTTP probing, Internet Archive Wayback Machine preservation records, and Wikipedia external citation references.

> 📖 **Architecture & Deep-Dive**: See [explainer.md](file:///Users/carlos/code/projects-2025/link-rot-analyzer/explainer.md) for a detailed walkthrough of how the system works, data flow diagrams, classification mathematics, and module inter-relationships.

---

## Features & Workspaces

The application is structured into **independent, decoupled sections** that can each run standalone or within a unified dashboard:

1. **Macro Web Decay Benchmarks (`Overview` & `URL Explorer`)**:
   - Evaluates link survival and decay across historical Common Crawl index snapshots (from 2013 to present).
   - D3-powered survival decay curves, status distribution donuts, and TLD persistence bar charts.
   - Searchable, filterable, and paginated benchmark database.
   - **Lazy-Loaded**: Macro datasets load on-demand without blocking other tools.

2. **Dual-Source URL Tracker (`URL Tracker`)**:
   - Input arbitrary URLs via an interactive form or batch API to simultaneously track historical Common Crawl presence and Wikipedia citation references.
   - **Configurable Crawl Depth**: Choose presets (e.g., 2013 dawn of CDX, 10-year decade, recent 5-year) or customize start years, step intervals, and individual crawl cohorts.
   - Identifies high-risk links cited on Wikipedia that have failed or decayed.

3. **Targeted URL Inspector & Wayback Client (`URL Inspector`)**:
   - Single-URL live HTTP status probing (`HEAD`/`GET` with redirect following) to distinguish active link decay from transient historical crawl omissions.
   - Queries the Internet Archive Availability & CDX APIs for snapshot history and fallback URLs.

4. **Data Export**:
   - Export benchmark datasets, tracked URL analyses, and summary statistics to JSON or CSV.

---

## Architecture & Project Layout

```text
link-rot-analyzer/
├── src/
│   ├── crawler.ts            # Common Crawl collection discovery, cohort catalog (2013–2025), and baseline sampling
│   ├── analyzer.ts           # Cross-cohort persistence engine and rot classification
│   ├── url-tracker.ts        # Dual-source Common Crawl & Wikipedia batch URL tracker
│   ├── wikipedia-client.ts   # MediaWiki API client for external URL citation discovery
│   ├── live-verifier.ts      # Targeted real-time HTTP verification with redirect following
│   ├── wayback-client.ts     # Internet Archive Availability & CDX API client
│   ├── inspector.ts          # Single-URL inspection orchestrator
│   └── server.ts             # Local HTTP REST API server with lazy-loaded datasets
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx                # App header and workspace tab switcher
│   │   │   ├── MacroOverview.tsx         # Standalone macro research benchmarks & D3 charts view
│   │   │   ├── SummaryCards.tsx          # Key metrics cards
│   │   │   ├── SurvivalCurveChart.tsx    # D3 link survival decay curve
│   │   │   ├── StatusDistributionChart.tsx# D3 status ratio donut chart
│   │   │   ├── TldSurvivalChart.tsx      # D3 TLD survival horizontal bar chart
│   │   │   ├── UrlExplorerTable.tsx      # Paginated, searchable URL benchmark table
│   │   │   ├── UrlTracker.tsx            # Form to track custom URLs across Crawl & Wikipedia
│   │   │   ├── UrlInspector.tsx          # Single-URL live check & Wayback archive tool
│   │   │   └── ExportModal.tsx           # Dataset and visualization export dialog
│   │   ├── api.ts            # Frontend API client
│   │   ├── types.ts          # TypeScript shared data interfaces
│   │   └── App.tsx            # Root application with independent workspace routing
│   └── index.html
├── tests/
│   ├── unit-tracker.test.ts  # Unit tests for URL tracker, Wikipedia client, and cohort resolver
│   ├── server.test.ts        # Playwright server API endpoint tests
│   └── ui.test.ts            # Playwright UI integration tests
└── package.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v24+ or v26+ (Active / Current LTS)

### Installation

```bash
git clone https://github.com/carlos/link-rot-analyzer.git
cd link-rot-analyzer
npm install
```

### Running the Application

1. **Start Both Server & Client Concurrently (Recommended)**:
   ```bash
   npm start
   # or: npm run dev
   # Starts backend REST API on http://localhost:3000 and Vite UI on http://localhost:5173 concurrently via concurrently
   ```

2. **Run Backend API Server Only**:
   ```bash
   npm run server
   # Server runs at http://localhost:3000
   ```

3. **Run Client UI Only**:
   ```bash
   npm run client
   # or: npm run ui
   # Vite development server runs at http://localhost:5173 (proxied to API on :3000)
   ```

4. **Build Frontend for Production**:
   ```bash
   npm run build:ui
   ```

---

## Standalone CLI Usage

Every core feature can be run independently directly from the command line:

```bash
# 1. Track URLs across Common Crawl and Wikipedia (Dual-Source Tracker)
npm run track -- https://archive.org https://www.w3.org/TR/html52/

# 2. Search Wikipedia articles citing a specific URL or domain
npm run wiki -- https://archive.org

# 3. Comprehensive single-URL inspection (Live HTTP probe + Wayback Machine snapshots)
npm run inspect -- https://example.com

# 4. Standalone targeted live HTTP status verification
npm run verify-live -- https://example.com

# 5. Standalone Wayback Machine snapshot availability check
npm run wayback -- https://example.com

# 6. Sample baseline URLs from Common Crawl index collections
npm run sample

# 7. Run cross-cohort persistence and link decay analysis
npm run analyze
```

---

## REST API Reference

| Method | Endpoint | Description | Query / Body Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health check | None |
| `POST` | `/api/track` | Track URLs across Common Crawl cohorts & Wikipedia | `{ urls: string[], startYear?: number, stepYears?: number, cohortYears?: number[], options?: object }` |
| `GET` | `/api/track` | Track a single URL or comma-separated URLs | `url`, `startYear`, `stepYears`, `cohortYears` |
| `GET` | `/api/wikipedia` | Search Wikipedia articles linking to a URL or domain | `url`, `limit` (default: 20) |
| `GET` / `POST` | `/api/inspect` | Targeted live HTTP check & Wayback Machine archive history | `url` |
| `GET` | `/api/cohorts` | Available Common Crawl cohorts catalog (2013–2025) and presets | None |
| `GET` | `/api/summary` | Overall macro analysis summary, TLD metrics, and top domains *(lazy-loaded)* | None |
| `GET` | `/api/urls` | Paginated and searchable baseline URL dataset *(lazy-loaded)* | `page`, `limit`, `status` (`alive`\|`rotted`\|`all`), `cohort`, `search` |
| `GET` | `/api/domains` | Domain-level survival metrics *(lazy-loaded)* | `limit` (default: 50) |
| `GET` | `/api/tlds` | TLD-level survival metrics *(lazy-loaded)* | None |
| `POST` | `/api/reanalyze` | Re-run cross-cohort persistence analysis with custom cohorts | `{ startYear?: number, stepYears?: number, cohortYears?: number[], cohorts?: object[] }` |

---

## Common Crawl Cohort Configuration

The analyzer supports historical Common Crawl crawl snapshots dating back to 2013:

### Presets Available:
- **Default Triad (2018 – 2024)**: `[2018, 2021, 2024]`
- **Full 11+ Year Archive (2013 – 2024)**: `[2013, 2016, 2019, 2022, 2024]`
- **10-Year Decade (2014 – 2024)**: `[2014, 2017, 2020, 2022, 2024]`
- **Recent 5-Year (2019 – 2024)**: `[2019, 2021, 2024]`
- **Recent Annual Snapshots (2020 – 2024)**: `[2020, 2021, 2022, 2023, 2024]`
- **All Annual Snapshots (2013 – 2025)**: `[2013, 2014, ..., 2025]`

You can also specify any custom starting year (e.g. `startYear: 2015`), sampling step interval (e.g. `stepYears: 2`), or toggle individual crawl years directly in the UI.

---

## Link Rot Classification Methodology

Status classification follows strict criteria to distinguish transient crawl omissions from true link decay:

1. **HTTP 200 OK / 304 Not Modified**: **ALIVE**.
2. **HTTP 404 Not Found / 410 Gone**: **DEAD (Rotted)**.
3. **HTTP 0 / Network Errors**: Classified as **DEAD** until verified otherwise.
4. **HTTP 301 / 302 Redirects**: Followed automatically to destination URL.
5. **Transient Outages vs. True Decay**: Live HTTP inspection reconciles historical crawl data. If a URL was missing or returned 404 in past crawl indexes but returns `200 OK` live today, it is classified as *Recovered / Transient Historical Outage*, preventing false-positive link rot.
6. **Wikipedia Dead Link Detection**: If a URL is actively cited as a source on Wikipedia but fails real-time HTTP verification, it is flagged as **Critical: Dead Link on Wikipedia**.

---

## Running Tests

```bash
# Run unit tests (URL tracker, Wikipedia client, domain extraction, cohort resolver)
npx tsx tests/unit-tracker.test.ts

# Type-check TypeScript codebase
npx tsc --noEmit

# Run Playwright integration tests
npm test
```

---

## License

MIT © [Carlos Araya](https://publishing-project.rivendellweb.net)
