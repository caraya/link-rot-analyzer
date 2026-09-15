# Link Rot Analyzer

A tool to quantify, analyze, and track the decay of hyperlinks across historical web crawl snapshots (Common Crawl), real-time live HTTP probing, Internet Archive Wayback Machine preservation records, and Wikipedia external citation references.

---

## Features

- **Historical Cross-Cohort Analysis**: Evaluates link survival and decay across historical Common Crawl index snapshots (from 2013 to present).
- **Configurable Crawl Cohorts & Historical Depth**: Choose how far back to evaluate web history (e.g. from 2013 at the dawn of Common Crawl CDX, 10-year decade spans, or custom year ranges and sampling intervals).
- **Dual-Source URL Tracker**: Input arbitrary URLs via an interactive form or batch API to simultaneously track historical Common Crawl presence and Wikipedia citation references.
- **Wikipedia Link Rot & Citation Discovery**: Queries the official MediaWiki `exturlusage` API to detect which Wikipedia articles cite any given URL and flag dead link risks.
- **Targeted Live HTTP Verification**: Probes real-time status (`HEAD`/`GET` with redirect following) to distinguish active link decay from transient historical crawl omissions.
- **Wayback Machine Research Module**: Queries the Internet Archive Availability & CDX APIs to retrieve preserved snapshot counts, timestamps, and direct fallback links.
- **Interactive React & D3 Dashboard**: Built with React, Vite, Tailwind CSS, and D3.js to render survival decay curves, status distribution donuts, TLD survival rates, and domain tables.
- **Data Export**: Export benchmark datasets, tracked URL analyses, and summary statistics to JSON or CSV.

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
│   └── server.ts             # Local HTTP REST API server & static asset host
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx                # App header and tab navigation
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
│   │   └── App.tsx            # Root application component
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

- [Node.js](https://nodejs.org/) v18+ or v20+

### Installation

```bash
git clone https://github.com/carlos/link-rot-analyzer.git
cd link-rot-analyzer
npm install
```

### Running the Application

1. **Start the API Server**:
   ```bash
   npm start
   # Server runs at http://localhost:3000
   ```

2. **Start the Frontend (Development Mode with HMR)**:
   ```bash
   npm run dev
   # Vite development server runs at http://localhost:5173 (proxied to API on :3000)
   ```

3. **Build Frontend for Production**:
   ```bash
   npm run build:ui
   ```

---

## CLI Usage

Run specific modules directly from the command line:

```bash
# 1. Sample baseline URLs from Common Crawl
npm run sample

# 2. Run cross-cohort persistence analysis
npm run analyze

# 3. Track URLs across Common Crawl and Wikipedia (Dual-Source Tracker)
npm run track https://archive.org https://www.w3.org/TR/html52/

# 4. Search Wikipedia articles citing a specific URL/domain
npm run wiki https://archive.org

# 5. Inspect a single URL (Live HTTP status + Wayback Machine snapshots)
npm run inspect https://example.com

# 6. Verify live HTTP status for a URL
npm run verify-live https://example.com

# 7. Check Wayback Machine availability
npm run wayback https://example.com
```

---

## REST API Reference

| Method | Endpoint | Description | Query / Body Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health check | None |
| `GET` | `/api/summary` | Overall analysis summary, TLD metrics, and top domains | None |
| `GET` | `/api/urls` | Paginated and searchable baseline URL dataset | `page`, `limit`, `status` (`alive`\|`rotted`\|`all`), `cohort`, `search` |
| `GET` | `/api/domains` | Domain-level survival metrics | `limit` (default: 50) |
| `GET` | `/api/tlds` | TLD-level survival metrics | None |
| `GET` | `/api/cohorts` | Available Common Crawl cohorts catalog (2013–2025) and presets | None |
| `POST` | `/api/track` | Track URLs across Common Crawl cohorts & Wikipedia | `{ urls: string[], startYear?: number, stepYears?: number, cohortYears?: number[], options?: object }` |
| `GET` | `/api/track` | Track a single URL or comma-separated URLs | `url`, `startYear`, `stepYears`, `cohortYears` |
| `GET` | `/api/wikipedia` | Search Wikipedia articles linking to a URL or domain | `url`, `limit` (default: 20) |
| `GET` / `POST` | `/api/inspect` | Targeted live HTTP check & Wayback Machine archive history | `url` |
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
